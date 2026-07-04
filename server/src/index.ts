import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth.js';
import { eventRoutes } from './routes/events.js';
import { notificationRoutes } from './routes/notifications.js';

const app = new Hono();

app.use('*', logger());
app.use('/api/*', cors());

// The API lives under /api so it can never collide with the web app's own
// routes (the SPA has a /notifications page, the API a /notifications feed).
const api = new Hono();
api.get('/health', (c) => c.json({ name: 'Hausi API', ok: true }));
api.route('/auth', authRoutes);
api.route('/events', eventRoutes);
api.route('/notifications', notificationRoutes);
app.route('/api', api);
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

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
  // SPA fallback: /login, /e/:slug etc. only exist client-side.
  app.get('*', serveStatic({ path: join(webRoot, 'index.html'), onFound: cacheHeaders }));
} else {
  app.get('/', (c) => c.json({ name: 'Hausi API', ok: true, web: 'not bundled' }));
}

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Hausi listening on port ${info.port}`);
});
