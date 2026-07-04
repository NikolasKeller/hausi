import { Hono } from 'hono';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { saveImage } from '../lib/uploads.js';

export const uploadRoutes = new Hono<{ Variables: AuthVariables }>();
uploadRoutes.use('*', requireAuth);

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
    return c.json({ url }, 201);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Upload failed' }, 400);
  }
});
