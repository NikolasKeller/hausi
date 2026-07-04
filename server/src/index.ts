import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes, INVITE_CODE } from './routes/auth.js';
import { cardRoutes } from './routes/cards.js';
import { eventRoutes } from './routes/events.js';
import { notificationRoutes } from './routes/notifications.js';
import { discoverRoutes } from './routes/discover.js';
import { meRoutes } from './routes/me.js';
import { dedupeUsersByPhone } from './lib/dedupeUsers.js';
import { db } from './lib/db.js';
import { uploadRoutes } from './routes/uploads.js';
import { MIME_BY_EXT, UPLOAD_DIR } from './lib/uploads.js';

const app = new Hono();

app.use('*', logger());
app.use('/api/*', cors());

// The API lives under /api so it can never collide with the web app's own
// routes (the SPA has a /notifications page, the API a /notifications feed).
const api = new Hono();
api.get('/health', (c) => c.json({ name: 'Hausi API', ok: true }));
// Public client config — lets the app know whether to ask for an invite code.
api.get('/config', (c) => c.json({ inviteRequired: INVITE_CODE != null }));
api.route('/auth', authRoutes);
api.route('/events', eventRoutes);
api.route('/notifications', notificationRoutes);
api.route('/discover', discoverRoutes);
api.route('/me', meRoutes);
api.route('/cards', cardRoutes);
api.route('/uploads', uploadRoutes);
app.route('/api', api);
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

// Serve uploaded images from the volume. The strict filename pattern blocks
// path traversal; registered before the SPA fallback so it isn't shadowed.
app.get('/uploads/:name', async (c) => {
  const name = c.req.param('name');
  if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(name)) return c.notFound();
  try {
    const buffer = await readFile(join(UPLOAD_DIR, name));
    const ext = name.split('.').pop()!.toLowerCase();
    c.header('Content-Type', MIME_BY_EXT[ext] ?? 'application/octet-stream');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
    return c.body(new Uint8Array(buffer));
  } catch {
    return c.notFound();
  }
});

// In production the container copies the Expo web export next to the server
// and serves it from here; in dev the folder doesn't exist and the server is
// API-only (the app runs on Metro). Paths resolve against process.cwd().
const webRoot = process.env.WEB_ROOT ?? './public';
if (existsSync(join(webRoot, 'index.html'))) {
  const cacheHeaders = (path: string, c: { header: (k: string, v: string) => void }) => {
    // Expo content-hashes everything under _expo/static; the shell must not
    // be cached or clients would keep stale bundle references after deploys.
    c.header(
      'Cache-Control',
      path.includes('/_expo/') ? 'public, max-age=31536000, immutable' : 'no-cache'
    );
  };
  app.use('*', serveStatic({ root: webRoot, onFound: cacheHeaders }));
  // SPA fallback: /welcome, /e/:slug etc. only exist client-side.
  app.get('*', serveStatic({ path: join(webRoot, 'index.html'), onFound: cacheHeaders }));
} else {
  app.get('/', (c) => c.json({ name: 'Hausi API', ok: true, web: 'not bundled' }));
}

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Collapse any pre-canonicalization duplicate accounts on boot. Best-effort:
// a failure here must never stop the server from coming up.
try {
  await dedupeUsersByPhone();
} catch (e) {
  console.error('User dedupe skipped:', e);
}

// Persistence check: if this count keeps resetting after a redeploy, the
// SQLite DB at DATABASE_URL is NOT on a persistent volume — that (not the app)
// is why logins don't stick, since every deploy drops all accounts and
// invalidates their tokens. On Railway, mount a volume at /data.
try {
  console.log(`Accounts in DB at boot: ${await db.user.count()}`);
} catch (e) {
  console.error('Account count failed:', e);
}

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Hausi listening on port ${info.port}`);
});
