import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { createToken } from '../lib/auth.js';
import type { AuthResponse } from '../../../app/shared/types.js';

const CODE_TTL_MS = 10 * 60 * 1000;

const phoneSchema = z.object({
  // E.164-ish: +, 7-15 digits.
  phone: z
    .string()
    .trim()
    .regex(/^\+[0-9]{7,15}$/, 'Enter a phone number like +14155551234'),
});

const verifySchema = phoneSchema.extend({
  code: z.string().trim().regex(/^[0-9]{6}$/),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

async function authResponse(user: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarEmoji: string;
}): Promise<AuthResponse> {
  return {
    token: await createToken(user.id),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarEmoji: user.avatarEmoji,
    },
  };
}

export const authRoutes = new Hono();

// The OTP endpoints are unauthenticated and phone/request writes a user row
// per unique phone, so cap them per IP. In-memory is fine: one instance, and
// a restart resetting the counters is harmless.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;
const rateBuckets = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (rateBuckets.size > 10000) rateBuckets.clear();
  hits.push(now);
  rateBuckets.set(ip, hits);
  return hits.length > RATE_LIMIT;
}

authRoutes.use('/phone/*', async (c, next) => {
  // Railway sits behind a proxy, so the client IP arrives in x-forwarded-for.
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (rateLimited(ip)) {
    return c.json({ error: 'Too many attempts — wait a minute and try again' }, 429);
  }
  await next();
});

// Step 1: request an SMS code. Without an SMS provider configured (local
// dev / until the Supabase Auth migration), the code is returned in the
// response so the app can show it as a simulated text message.
authRoutes.post('/phone/request', async (c) => {
  const parsed = phoneSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Enter a valid phone number' }, 400);
  const { phone } = parsed.data;

  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await db.user.upsert({
    where: { phone },
    create: { phone, phoneCode: code, phoneCodeExpiresAt: expiresAt },
    update: { phoneCode: code, phoneCodeExpiresAt: expiresAt },
  });

  if (process.env.SMS_PROVIDER) {
    // No sender is implemented yet — fail loudly rather than swallowing every
    // code and making signup impossible. Leave SMS_PROVIDER unset.
    throw new Error('SMS_PROVIDER is set but no SMS sender is implemented');
  }
  return c.json({ sent: true, devCode: code });
});

// Step 2: verify the code → session token. isNew signals the app to run
// the profile-setup step (name + avatar).
authRoutes.post('/phone/verify', async (c) => {
  const parsed = verifySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Enter the 6-digit code' }, 400);
  const { phone, code } = parsed.data;

  const user = await db.user.findUnique({ where: { phone } });
  if (
    !user ||
    !user.phoneCode ||
    !user.phoneCodeExpiresAt ||
    user.phoneCodeExpiresAt < new Date() ||
    user.phoneCode !== code
  ) {
    return c.json({ error: 'Wrong or expired code — try again' }, 401);
  }

  const cleared = await db.user.update({
    where: { id: user.id },
    data: { phoneCode: null, phoneCodeExpiresAt: null },
  });

  return c.json({ ...(await authResponse(cleared)), isNew: cleared.name.trim() === '' });
});

// Legacy dev login for seeded email accounts; not exposed in the app UI.
authRoutes.post('/login', async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid login data' }, 400);
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return c.json({ error: 'Wrong email or password' }, 401);
  }
  return c.json(await authResponse(user));
});
