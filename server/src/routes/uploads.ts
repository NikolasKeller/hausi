import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { db } from '../lib/db.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { saveImage } from '../lib/uploads.js';

export const uploadRoutes = new Hono<{ Variables: AuthVariables }>();
uploadRoutes.use('*', requireAuth);

// Per-IP throttle so one account can't spam uploads and fill the volume.
const recent = new Map<string, number[]>();
const UPLOAD_LIMIT = 30;
const UPLOAD_WINDOW_MS = 60 * 1000;
uploadRoutes.use('*', async (c, next) => {
  const ip = c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim() ?? 'unknown';
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < UPLOAD_WINDOW_MS);
  if (recent.size > 5000) recent.clear();
  hits.push(now);
  recent.set(ip, hits);
  if (hits.length > UPLOAD_LIMIT) {
    return c.json({ error: 'Too many uploads — slow down a moment' }, 429);
  }
  await next();
});

// Reject oversized bodies before they're buffered into memory — the decoded
// 6 MB cap in saveImage is defense-in-depth behind this.
uploadRoutes.use(
  '*',
  bodyLimit({
    maxSize: 8 * 1024 * 1024,
    onError: (c) => c.json({ error: 'Image too large (max 6 MB)' }, 413),
  })
);

// Accepts { data: <base64, no data-URL prefix>, contentType: "image/jpeg" }
// and returns { url: "/uploads/<file>" } to store on the event.
uploadRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    data?: string;
    contentType?: string;
  } | null;
  if (!body?.data || !body?.contentType) {
    return c.json({ error: 'Missing image data' }, 400);
  }
  try {
    const url = await saveImage(body.data, body.contentType);
    // Remember who owns this file so ownership can be enforced later (e.g. only
    // letting a user set their own upload as a profile photo).
    await db.upload.create({ data: { path: url, userId: c.get('userId') } });
    return c.json({ url }, 201);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Upload failed' }, 400);
  }
});
