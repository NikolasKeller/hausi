import { Hono } from 'hono';
import { db } from '../lib/db.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import type { NotificationEntry } from '../../../app/shared/types.js';

export const notificationRoutes = new Hono<{ Variables: AuthVariables }>();
notificationRoutes.use('*', requireAuth);

notificationRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const notifications: NotificationEntry[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    text: n.text,
    eventSlug: n.eventSlug,
    read: n.readAt != null,
    createdAt: n.createdAt.toISOString(),
  }));
  return c.json({
    notifications,
    unread: notifications.filter((n) => !n.read).length,
  });
});

notificationRoutes.post('/read-all', async (c) => {
  const userId = c.get('userId');
  // `before` scopes the mark to what the client actually fetched, so
  // notifications that arrive mid-visit aren't marked read unseen.
  const body = await c.req.json().catch(() => ({}));
  const before =
    typeof body?.before === 'string' && !Number.isNaN(Date.parse(body.before))
      ? new Date(body.before)
      : null;
  await db.notification.updateMany({
    where: { userId, readAt: null, ...(before ? { createdAt: { lte: before } } : {}) },
    data: { readAt: new Date() },
  });
  return c.json({ ok: true });
});
