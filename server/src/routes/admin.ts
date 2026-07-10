import { Hono } from 'hono';
import { db } from '../lib/db.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { toPublicUser } from '../lib/serialize.js';
import type { AdminEventSubmission, Category } from '../../../app/shared/types.js';

export const adminRoutes = new Hono<{ Variables: AuthVariables }>();
adminRoutes.use('*', requireAuth);
adminRoutes.use('*', async (c, next) => {
  const admin = await db.user.findUnique({
    where: { id: c.get('userId') },
    select: { isAdmin: true },
  });
  if (!admin?.isAdmin) return c.json({ error: 'Admin access required' }, 403);
  await next();
});

function submission(event: {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: Date;
  location: string;
  city: string;
  coverImage: string;
  category: string;
  costPerPerson: string;
  publicationStatus: string;
  createdAt: Date;
  host: {
    id: string;
    name: string;
    username: string | null;
    avatarEmoji: string;
    avatarImage: string;
  };
}): AdminEventSubmission {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    date: event.date.toISOString(),
    location: event.location,
    city: event.city,
    coverImage: event.coverImage,
    category: event.category as Category,
    costPerPerson: event.costPerPerson,
    publicationStatus: event.publicationStatus as AdminEventSubmission['publicationStatus'],
    createdAt: event.createdAt.toISOString(),
    host: toPublicUser(event.host),
  };
}

adminRoutes.get('/events', async (c) => {
  const status = c.req.query('status') === 'REJECTED' ? 'REJECTED' : 'PENDING';
  const events = await db.event.findMany({
    where: { publicationStatus: status, canceledAt: null },
    include: { host: true },
    orderBy: { createdAt: 'asc' },
  });
  return c.json({ events: events.map(submission) });
});

adminRoutes.post('/events/:id/approve', async (c) => {
  const event = await db.event.findUnique({ where: { id: c.req.param('id') } });
  if (!event || event.canceledAt) return c.json({ error: 'Event not found' }, 404);
  const updated = await db.event.update({
    where: { id: event.id },
    data: { publicationStatus: 'APPROVED', isPublic: true },
    include: { host: true },
  });
  return c.json({ event: submission(updated) });
});

adminRoutes.post('/events/:id/reject', async (c) => {
  const event = await db.event.findUnique({ where: { id: c.req.param('id') } });
  if (!event || event.canceledAt) return c.json({ error: 'Event not found' }, 404);
  const updated = await db.event.update({
    where: { id: event.id },
    data: { publicationStatus: 'REJECTED', isPublic: false },
    include: { host: true },
  });
  return c.json({ event: submission(updated) });
});
