import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { countRsvps, toEventDetail, toEventSummary } from '../lib/serialize.js';
import { makeSlug } from '../lib/slug.js';
import { COVER_THEMES, LIMITS, RSVP_STATUSES } from '../../../app/shared/types.js';

const eventInclude = {
  host: true,
  rsvps: { include: { user: true }, orderBy: { createdAt: 'asc' as const } },
  comments: { include: { user: true }, orderBy: { createdAt: 'asc' as const } },
};

const eventInputSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.title),
  description: z.string().trim().max(LIMITS.description).optional(),
  coverTheme: z.enum(COVER_THEMES).optional(),
  date: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')
    .transform((s) => new Date(s)),
  location: z.string().trim().max(LIMITS.location).optional(),
  maxGuests: z.number().int().min(1).max(LIMITS.maxGuests).nullable().optional(),
});

const rsvpSchema = z.object({
  status: z.enum(RSVP_STATUSES as [string, ...string[]]),
  plusOnes: z.number().int().min(0).max(LIMITS.plusOnes).optional(),
});

const commentSchema = z.object({
  text: z.string().trim().min(1).max(LIMITS.comment),
});

export const eventRoutes = new Hono<{ Variables: AuthVariables }>();
eventRoutes.use('*', requireAuth);

// Feed: events I host or have RSVP'd to.
eventRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const events = await db.event.findMany({
    where: { OR: [{ hostId: userId }, { rsvps: { some: { userId } } }] },
    include: { host: true, rsvps: { include: { user: true } } },
    orderBy: { date: 'asc' },
  });
  return c.json({ events: events.map((e) => toEventSummary(e, userId)) });
});

eventRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const parsed = eventInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid event data' }, 400);
  const { title, description, coverTheme, date, location, maxGuests } = parsed.data;

  const event = await db.event.create({
    data: {
      slug: makeSlug(title),
      title,
      description: description ?? '',
      coverTheme: coverTheme ?? 'sunset',
      date,
      location: location ?? '',
      maxGuests: maxGuests ?? null,
      hostId: userId,
      // The host is going to their own party.
      rsvps: { create: { userId, status: 'GOING' } },
    },
    include: eventInclude,
  });
  return c.json({ event: toEventDetail(event, userId) }, 201);
});

eventRoutes.get('/by-slug/:slug', async (c) => {
  const event = await db.event.findUnique({
    where: { slug: c.req.param('slug') },
    include: eventInclude,
  });
  if (!event) return c.json({ error: 'Event not found' }, 404);
  return c.json({ event: toEventDetail(event, c.get('userId')) });
});

eventRoutes.get('/:id', async (c) => {
  const event = await db.event.findUnique({
    where: { id: c.req.param('id') },
    include: eventInclude,
  });
  if (!event) return c.json({ error: 'Event not found' }, 404);
  return c.json({ event: toEventDetail(event, c.get('userId')) });
});

eventRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const existing = await db.event.findUnique({ where: { id: c.req.param('id') } });
  if (!existing) return c.json({ error: 'Event not found' }, 404);
  if (existing.hostId !== userId) return c.json({ error: 'Only the host can edit this event' }, 403);

  const parsed = eventInputSchema.partial().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid event data' }, 400);

  const event = await db.event.update({
    where: { id: existing.id },
    data: parsed.data,
    include: eventInclude,
  });
  return c.json({ event: toEventDetail(event, userId) });
});

eventRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const existing = await db.event.findUnique({ where: { id: c.req.param('id') } });
  if (!existing) return c.json({ error: 'Event not found' }, 404);
  if (existing.hostId !== userId)
    return c.json({ error: 'Only the host can delete this event' }, 403);

  await db.event.delete({ where: { id: existing.id } });
  return c.json({ ok: true });
});

class RsvpError extends Error {
  constructor(
    message: string,
    public code: 404 | 409
  ) {
    super(message);
  }
}

eventRoutes.put('/:id/rsvp', async (c) => {
  const userId = c.get('userId');
  const eventId = c.req.param('id');

  const parsed = rsvpSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid RSVP' }, 400);
  const status = parsed.data.status;
  const plusOnes = status === 'GOING' ? (parsed.data.plusOnes ?? 0) : 0;

  try {
    // Interactive transaction so concurrent RSVPs can't race past the capacity check.
    await db.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: { rsvps: true },
      });
      if (!event) throw new RsvpError('Event not found', 404);

      if (status === 'GOING' && event.maxGuests != null) {
        const others = event.rsvps.filter((r) => r.userId !== userId);
        const goingCount = countRsvps(others).going;
        if (goingCount + 1 + plusOnes > event.maxGuests) {
          throw new RsvpError('This event is full', 409);
        }
      }

      const previous = event.rsvps.find((r) => r.userId === userId);
      await tx.rsvp.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: { eventId, userId, status, plusOnes },
        update: { status, plusOnes },
      });

      // Activity-feed entry on the Party Wall when the status actually changes.
      if (!previous || previous.status !== status) {
        const phrase =
          status === 'GOING'
            ? plusOnes > 0
              ? `is going with +${plusOnes} 🎉`
              : 'is going 🎉'
            : status === 'MAYBE'
              ? 'might come 🤔'
              : "can't make it 😢";
        await tx.comment.create({
          data: { eventId, userId, text: phrase, type: 'system' },
        });
      }
    });
  } catch (e) {
    if (e instanceof RsvpError) return c.json({ error: e.message }, e.code);
    throw e;
  }

  const updated = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: eventInclude,
  });
  return c.json({ event: toEventDetail(updated, userId) });
});

// Host removes a guest from the list (Partiful-style silent removal).
eventRoutes.delete('/:id/rsvp/:userId', async (c) => {
  const me = c.get('userId');
  const eventId = c.req.param('id');
  const targetUserId = c.req.param('userId');

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return c.json({ error: 'Event not found' }, 404);
  if (event.hostId !== me) return c.json({ error: 'Only the host can remove guests' }, 403);
  if (targetUserId === event.hostId) {
    return c.json({ error: "The host can't be removed from their own event" }, 400);
  }

  await db.rsvp.deleteMany({ where: { eventId, userId: targetUserId } });

  const updated = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: eventInclude,
  });
  return c.json({ event: toEventDetail(updated, me) });
});

eventRoutes.get('/:id/comments', async (c) => {
  const eventId = c.req.param('id');
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return c.json({ error: 'Event not found' }, 404);

  const comments = await db.comment.findMany({
    where: { eventId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });
  return c.json({
    comments: comments.map((co) => ({
      id: co.id,
      user: { id: co.user.id, name: co.user.name, avatarEmoji: co.user.avatarEmoji },
      text: co.text,
      type: co.type === 'system' ? 'system' : 'comment',
      createdAt: co.createdAt.toISOString(),
    })),
  });
});

eventRoutes.post('/:id/comments', async (c) => {
  const userId = c.get('userId');
  const eventId = c.req.param('id');
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return c.json({ error: 'Event not found' }, 404);

  const parsed = commentSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid comment' }, 400);

  const comment = await db.comment.create({
    data: { eventId, userId, text: parsed.data.text },
    include: { user: true },
  });
  return c.json(
    {
      comment: {
        id: comment.id,
        user: {
          id: comment.user.id,
          name: comment.user.name,
          avatarEmoji: comment.user.avatarEmoji,
        },
        text: comment.text,
        type: 'comment' as const,
        createdAt: comment.createdAt.toISOString(),
      },
    },
    201
  );
});
