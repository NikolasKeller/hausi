import { Hono, type Context } from 'hono';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { db } from '../lib/db.js';
import {
  createToken,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
  type AuthVariables,
} from '../lib/auth.js';
import { normalizePhone } from '../lib/phone.js';
import {
  checkVerification,
  sendSms,
  smsEnabled,
  startVerification,
  verifyEnabled,
} from '../lib/sms.js';
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
  avatarImage: string;
}): Promise<AuthResponse> {
  return {
    token: await createToken(user.id),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarEmoji: user.avatarEmoji,
      avatarImage: user.avatarImage,
    },
  };
}

// Build the auth response, set the durable session cookie, and reply. Every
// sign-in path goes through here so the cookie is always issued alongside the
// token the client stores locally.
async function sessionJson(
  c: Context,
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatarEmoji: string;
    avatarImage: string;
  },
  extra: Record<string, unknown> = {}
) {
  const resp = await authResponse(user);
  setSessionCookie(c, resp.token);
  return c.json({ ...resp, ...extra });
}

export const authRoutes = new Hono<{ Variables: AuthVariables }>();

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
  // Only the LAST entry is trustworthy — it's appended by Railway's edge;
  // anything before it is client-supplied and spoofable.
  const ip = c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim() ?? 'unknown';
  if (rateLimited(ip)) {
    return c.json({ error: 'Too many attempts — wait a minute and try again' }, 429);
  }
  await next();
});

// Optional shared passcode. Because there is no SMS provider, the OTP is
// returned to the caller (see below) — so on a public URL anyone who knows a
// phone number could otherwise log in as that person. Setting INVITE_CODE
// gates code requests behind a secret the host shares with friends out-of-band.
// Unset (the default) keeps signup fully open, which is fine for a private link.
export const INVITE_CODE = process.env.INVITE_CODE?.trim() || null;

// Step 1: request an SMS code. When Twilio is configured (TWILIO_* env vars),
// the code is texted and NOT returned. Otherwise — local dev, or a deploy
// without Twilio — it's returned so the app can show it as a mock text.
authRoutes.post('/phone/request', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (INVITE_CODE && (body as { invite?: string } | null)?.invite?.trim() !== INVITE_CODE) {
    return c.json({ error: 'Wrong invite code — ask the host for it' }, 403);
  }
  const parsed = phoneSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Enter a valid phone number' }, 400);
  // Canonicalize to E.164 so "+49 0176…" and "+49 176…" resolve to one account.
  const phone = normalizePhone(parsed.data.phone);

  // Twilio Verify owns the code end-to-end — we only make sure a profile row
  // exists for this phone and let Twilio send. Nothing is stored on our side.
  if (verifyEnabled) {
    await db.user.upsert({ where: { phone }, create: { phone }, update: {} });
    try {
      await startVerification(phone);
    } catch (e) {
      console.error('Verify start failed:', e);
      const detail = e instanceof Error ? e.message : 'unknown error';
      return c.json({ error: `Could not send the code — ${detail}` }, 502);
    }
    return c.json({ sent: true });
  }

  // Otherwise we generate and store our own code (texted via Messages API, or
  // returned on screen in dev).
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await db.user.upsert({
    where: { phone },
    create: { phone, phoneCode: code, phoneCodeExpiresAt: expiresAt },
    update: { phoneCode: code, phoneCodeExpiresAt: expiresAt },
  });

  if (smsEnabled) {
    try {
      await sendSms(phone, `${code} is your Hausi verification code`);
    } catch (e) {
      console.error('SMS send failed:', e);
      return c.json({ error: 'Could not send the code — check the number and try again' }, 502);
    }
    return c.json({ sent: true });
  }
  return c.json({ sent: true, devCode: code });
});

// Plus-one spots reserved for this phone before the account existed get
// linked on sign-in, so the invitee shows up on guest lists with their own
// profile (avatar and all) instead of the name their friend typed.
async function claimPlusOneSpots(userId: string, phone: string) {
  await db.plusOne.updateMany({ where: { phone, userId: null }, data: { userId } });
}

// Step 2: verify the code → session token. isNew signals the app to run
// the profile-setup step (name + avatar).
authRoutes.post('/phone/verify', async (c) => {
  const parsed = verifySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Enter the 6-digit code' }, 400);
  const { code } = parsed.data;
  // Must match the canonicalization used when the code was requested.
  const phone = normalizePhone(parsed.data.phone);

  // Twilio Verify checks the code; on approval we upsert the profile (the
  // request step created it, but be safe) and mint the session.
  if (verifyEnabled) {
    let approved = false;
    try {
      approved = await checkVerification(phone, code);
    } catch (e) {
      console.error('Verify check failed:', e);
      const detail = e instanceof Error ? e.message : 'unknown error';
      return c.json({ error: `Could not verify the code — ${detail}` }, 502);
    }
    if (!approved) return c.json({ error: 'Wrong or expired code — try again' }, 401);
    const user = await db.user.upsert({ where: { phone }, create: { phone }, update: {} });
    await claimPlusOneSpots(user.id, phone);
    return sessionJson(c, user, { isNew: user.name.trim() === '' });
  }

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
  await claimPlusOneSpots(cleared.id, phone);

  return sessionJson(c, cleared, { isNew: cleared.name.trim() === '' });
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
  return sessionJson(c, user);
});

// Restore a session from the durable cookie when the client has no stored token
// (e.g. iOS Safari evicted localStorage). Re-issues the cookie to slide expiry.
authRoutes.get('/session', requireAuth, async (c) => {
  const user = await db.user.findUniqueOrThrow({ where: { id: c.get('userId') } });
  return sessionJson(c, user);
});

// Clear the durable cookie on logout (the client also clears its local copy).
authRoutes.post('/logout', (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});
