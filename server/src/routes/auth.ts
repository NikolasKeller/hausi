import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { createToken } from '../lib/auth.js';
import { LIMITS, type AuthResponse } from '../../../app/shared/types.js';

const signupSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.name),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(200),
  avatarEmoji: z.string().trim().min(1).max(8).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

async function authResponse(user: {
  id: string;
  name: string;
  email: string;
  avatarEmoji: string;
}): Promise<AuthResponse> {
  return {
    token: await createToken(user.id),
    user: { id: user.id, name: user.name, email: user.email, avatarEmoji: user.avatarEmoji },
  };
}

export const authRoutes = new Hono();

authRoutes.post('/signup', async (c) => {
  const parsed = signupSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid signup data' }, 400);
  const { name, email, password, avatarEmoji } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return c.json({ error: 'An account with this email already exists' }, 409);

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      avatarEmoji: avatarEmoji ?? '🙂',
    },
  });
  return c.json(await authResponse(user), 201);
});

authRoutes.post('/login', async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid login data' }, 400);
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return c.json({ error: 'Wrong email or password' }, 401);
  }
  return c.json(await authResponse(user));
});
