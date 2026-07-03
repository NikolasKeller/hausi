import type { MiddlewareHandler } from 'hono';
import { sign, verify } from 'hono/jwt';

const JWT_SECRET = process.env.JWT_SECRET ?? 'hausi-dev-secret-change-me';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function createToken(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: userId, iat: now, exp: now + TOKEN_TTL_SECONDS }, JWT_SECRET);
}

export type AuthVariables = { userId: string };

export const requireAuth: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing Authorization header' }, 401);
  }
  try {
    const payload = await verify(header.slice('Bearer '.length), JWT_SECRET, 'HS256');
    if (typeof payload.sub !== 'string') throw new Error('bad sub');
    c.set('userId', payload.sub);
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
  await next();
};
