import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { db } from './db.js';

// The dev fallback is public knowledge (it's in the repo) — with it, anyone
// could mint tokens for any user. Refuse to boot in production without a real
// secret.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
const JWT_SECRET = process.env.JWT_SECRET ?? 'iykyk-dev-secret-change-me';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function createToken(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: userId, iat: now, exp: now + TOKEN_TTL_SECONDS }, JWT_SECRET);
}

// Same JWT, also stored as a first-party cookie. On iOS Safari, server-set
// cookies survive far longer than script-writable storage (localStorage is
// capped/evicted by ITP), so this keeps web/PWA users logged in across reopens.
export const SESSION_COOKIE = 'iykyk_session';

export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: TOKEN_TTL_SECONDS,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export type AuthVariables = { userId: string };

export const requireAuth: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  const header = c.req.header('Authorization');
  const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  // Fall back to the session cookie when there's no Bearer token — e.g. a
  // returning web user whose localStorage was cleared but whose cookie lives.
  const raw = bearer ?? getCookie(c, SESSION_COOKIE);
  if (!raw) {
    return c.json({ error: 'Missing Authorization header' }, 401);
  }
  let userId: string;
  try {
    const payload = await verify(raw, JWT_SECRET, 'HS256');
    if (typeof payload.sub !== 'string') throw new Error('bad sub');
    userId = payload.sub;
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
  // The token may outlive its user (e.g. after re-seeding the database).
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return c.json({ error: 'Invalid or expired token' }, 401);
  c.set('userId', user.id);
  await next();
};
