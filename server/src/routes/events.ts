import { Hono } from 'hono';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '../lib/db.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import {
  canManageEvent,
  countRsvps,
  toEventDetail,
  toEventSummary,
} from '../lib/serialize.js';
import { makeSlug } from '../lib/slug.js';
import { notify } from '../lib/notify.js';
import {
  CATEGORIES,
  COVER_THEMES,
  EFFECTS,
  LIMITS,
  RSVP_CHOICES,
  TITLE_FONTS,
} from '../../../app/shared/types.js';

const eventInclude = {
  host: true,
  cohosts: { include: { user: true } },
  rsvps: { include: { user: true }, orderBy: { createdAt: 'asc' as const } },
  comments: { include: { user: true }, orderBy: { createdAt: 'asc' as const } },
};

const eventInputSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.title),
  description: z.string().trim().max(LIMITS.description).optional(),
  coverTheme: z.enum(COVER_THEMES).optional(),
  titleFont: z.enum(TITLE_FONTS).optional(),
  effect: z.enum(EFFECTS).optional(),
  date: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')
    .transform((s) => new Date(s)),
  location: z.string().trim().max(LIMITS.location).optional(),
  city: z.string().trim().max(80).optional(),
  category: z.enum(CATEGORIES).optional(),
  isPublic: z.boolean().optional(),
  costPerPerson: z.string().trim().max(60).optional(),
  dressCode: z.string().trim().max(120).optional(),
  maxGuests: z.number().int().min(1).max(LIMITS.maxGuests).nullable().optional(),
  plusOneLimit: z.number().int().min(0).max(LIMITS.plusOnes).optional(),
  rsvpsOpen: z.boolean().optional(),
});

const rsvpSchema = z.object({
  status: z.enum(RSVP_CHOICES),
  plusOnes: z.number().int().min(0).max(LIMITS.plusOnes).optional(),
});

const commentSchema = z.object({
  text: z.string().trim().min(1).max(LIMITS.comment),
});

const cohostSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

class HttpError extends Error {
  constructor(
    message: string,
    public code: 400 | 403 | 404 | 409
  ) {
    super(message);
  }
}

const RSVP_PHRASES: Record<string, string> = {
  GOING: 'is going 🎉',
  MAYBE: 'might come 🤔',
  CANT: "can't make it 😢",
  WAITLIST: 'joined the waitlist ⏳',
};

function rsvpPhrase(status: string, plusOnes: number): string {
  if (status === 'GOING' && plusOnes > 0) return `is going with +${plusOnes} 🎉`;
  return RSVP_PHRASES[status] ?? 'updated their RSVP';
}

// Promote waitlisted guests FIFO (by waitlist-join time) while capacity allows.
// Paused while RSVPs are closed — the host froze the list; reopening resumes it.
// Runs inside the caller's transaction; writes system entries and notifications.
async function promoteWaitlist(tx: Prisma.TransactionClient, eventId: string) {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    include: {
      rsvps: { include: { user: true } },
      cohosts: true,
    },
  });
  if (!event || event.canceledAt || !event.rsvpsOpen) return;

  const waitlist = event.rsvps
    .filter((r) => r.status === 'WAITLIST')
    .sort(
      (a, b) =>
        (a.waitlistedAt?.getTime() ?? a.createdAt.getTime()) -
        (b.waitlistedAt?.getTime() ?? b.createdAt.getTime())
    );
  if (!waitlist.length) return;

  let capacityLeft =
    event.maxGuests == null
      ? Number.POSITIVE_INFINITY
      : event.maxGuests - countRsvps(event.rsvps).going;

  for (const entry of waitlist) {
    const needed = 1 + entry.plusOnes;
    if (needed > capacityLeft) break; // strict FIFO: don't skip ahead of the queue
    capacityLeft -= needed;
    await tx.rsvp.update({
      where: { id: entry.id },
      data: { status: 'GOING', waitlistedAt: null },
    });
    await tx.comment.create({
      data: {
        eventId,
        userId: entry.userId,
        text: 'is off the waitlist — going! 🎉',
        type: 'system',
      },
    });
    await notify(tx, [entry.userId], {
      type: 'WAITLIST_PROMOTED',
      text: `You're off the waitlist for "${event.title}" — you're going! 🎉`,
      eventSlug: event.slug,
    });
    await notify(
      tx,
      managerIds(event).filter((id) => id !== entry.userId),
      {
        type: 'RSVP',
        text: `${entry.user.name} is off the waitlist — going 🎉 — "${event.title}"`,
        eventSlug: event.slug,
      }
    );
  }
}

function managerIds(event: { hostId: string; cohosts: { userId: string }[] }): string[] {
  return [event.hostId, ...event.cohosts.map((c) => c.userId)];
}

export const eventRoutes = new Hono<{ Variables: AuthVariables }>();
eventRoutes.use('*', requireAuth);

// Feed: events I host, co-host or have RSVP'd to.
eventRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const events = await db.event.findMany({
    where: {
      OR: [
        { hostId: userId },
        { cohosts: { some: { userId } } },
        { rsvps: { some: { userId } } },
      ],
    },
    include: { host: true, cohosts: { include: { user: true } }, rsvps: { include: { user: true } } },
    orderBy: { date: 'asc' },
  });
  return c.json({ events: events.map((e) => toEventSummary(e, userId)) });
});

eventRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const parsed = eventInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid event data' }, 400);
  const data = parsed.data;

  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const event = await db.event.create({
    data: {
      slug: makeSlug(data.title),
      title: data.title,
      description: data.description ?? '',
      coverTheme: data.coverTheme ?? 'sunset',
      titleFont: data.titleFont ?? 'classic',
      effect: data.effect ?? 'none',
      date: data.date,
      location: data.location ?? '',
      city: data.city ?? me.city,
      category: data.category ?? 'community',
      isPublic: data.isPublic ?? false,
      costPerPerson: data.costPerPerson ?? '',
      dressCode: data.dressCode ?? '',
      maxGuests: data.maxGuests ?? null,
      plusOneLimit: data.plusOneLimit ?? 1,
      rsvpsOpen: data.rsvpsOpen ?? true,
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
  const existing = await db.event.findUnique({
    where: { id: c.req.param('id') },
    include: { cohosts: true, rsvps: true },
  });
  if (!existing) return c.json({ error: 'Event not found' }, 404);
  if (!canManageEvent(existing, userId)) {
    return c.json({ error: 'Only hosts can edit this event' }, 403);
  }
  if (existing.canceledAt) {
    return c.json({ error: "Canceled events can't be edited" }, 409);
  }

  const parsed = eventInputSchema.partial().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid event data' }, 400);
  const data = parsed.data;

  const event = await db.$transaction(async (tx) => {
    const updated = await tx.event.update({
      where: { id: existing.id },
      data,
      include: eventInclude,
    });

    // A lowered plus-one limit clamps existing parties so nobody is stuck
    // above the new cap (and the freed seats can go to the waitlist).
    if (data.plusOneLimit != null) {
      const over = await tx.rsvp.findMany({
        where: { eventId: existing.id, plusOnes: { gt: data.plusOneLimit } },
      });
      for (const r of over) {
        await tx.rsvp.update({
          where: { id: r.id },
          data: { plusOnes: data.plusOneLimit },
        });
      }
    }

    // Capacity may have grown (cap raised/dropped, parties clamped, RSVPs reopened).
    if ('maxGuests' in data || data.plusOneLimit != null || data.rsvpsOpen === true) {
      await promoteWaitlist(tx, existing.id);
    }

    // Tell guests when the plan materially changes.
    const dateChanged =
      data.date != null && data.date.getTime() !== existing.date.getTime();
    const locationChanged = data.location != null && data.location !== existing.location;
    const titleChanged = data.title != null && data.title !== existing.title;
    if (dateChanged || locationChanged || titleChanged) {
      const guests = existing.rsvps.map((r) => r.userId).filter((id) => id !== userId);
      await notify(tx, guests, {
        type: 'EVENT_UPDATED',
        text: `"${updated.title}" was updated — check the new details 📝`,
        eventSlug: updated.slug,
      });
    }

    return tx.event.findUniqueOrThrow({ where: { id: existing.id }, include: eventInclude });
  });

  return c.json({ event: toEventDetail(event, userId) });
});

// Cancel keeps the page alive with a banner; delete removes it entirely.
eventRoutes.post('/:id/cancel', async (c) => {
  const userId = c.get('userId');
  const existing = await db.event.findUnique({
    where: { id: c.req.param('id') },
    include: { rsvps: true },
  });
  if (!existing) return c.json({ error: 'Event not found' }, 404);
  if (existing.hostId !== userId) {
    return c.json({ error: 'Only the host can cancel this event' }, 403);
  }
  if (existing.canceledAt) return c.json({ error: 'Event is already canceled' }, 409);

  const event = await db.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: existing.id },
      data: { canceledAt: new Date(), rsvpsOpen: false },
    });
    await tx.comment.create({
      data: { eventId: existing.id, userId, text: 'canceled the event 😢', type: 'system' },
    });
    const guests = existing.rsvps.map((r) => r.userId).filter((id) => id !== userId);
    await notify(tx, guests, {
      type: 'EVENT_CANCELED',
      text: `"${existing.title}" was canceled 😢`,
      eventSlug: existing.slug,
    });
    return tx.event.findUniqueOrThrow({ where: { id: existing.id }, include: eventInclude });
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

eventRoutes.put('/:id/rsvp', async (c) => {
  const userId = c.get('userId');
  const eventId = c.req.param('id');

  const parsed = rsvpSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid RSVP' }, 400);
  const requestedStatus = parsed.data.status;
  const plusOnes = requestedStatus === 'GOING' ? (parsed.data.plusOnes ?? 0) : 0;

  try {
    // Interactive transaction so concurrent RSVPs can't race past the capacity check.
    await db.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: { rsvps: { include: { user: true } }, cohosts: true },
      });
      if (!event) throw new HttpError('Event not found', 404);
      if (event.canceledAt) throw new HttpError('This event was canceled', 409);

      const isManager = canManageEvent(event, userId);
      const previous = event.rsvps.find((r) => r.userId === userId);

      // Closed RSVPs block joining or growing a party, but guests must always
      // be able to withdraw (CANT/MAYBE) or shrink their plus ones.
      const isDowngrade =
        previous != null &&
        (requestedStatus !== 'GOING' ||
          (previous.status === 'GOING' && plusOnes <= previous.plusOnes));
      if (!event.rsvpsOpen && !isManager && !isDowngrade) {
        throw new HttpError('RSVPs are closed', 409);
      }
      if (plusOnes > event.plusOneLimit) {
        throw new HttpError(
          event.plusOneLimit === 0
            ? 'No plus ones for this event'
            : `Max +${event.plusOneLimit} for this event`,
          400
        );
      }

      // A full event puts NEW going requests on the waitlist. A guest who
      // already holds a GOING spot is never demoted — an over-capacity
      // party-size increase is rejected instead.
      let status: string = requestedStatus;
      if (requestedStatus === 'GOING' && event.maxGuests != null) {
        const others = event.rsvps.filter((r) => r.userId !== userId);
        const goingCount = countRsvps(others).going;
        if (goingCount + 1 + plusOnes > event.maxGuests) {
          if (previous?.status === 'GOING') {
            throw new HttpError('Not enough spots left for that many plus ones', 409);
          }
          status = 'WAITLIST';
        }
      }

      // Entering the waitlist stamps the FIFO position; re-submitting while
      // already waitlisted keeps it.
      const waitlistedAt =
        status === 'WAITLIST'
          ? previous?.status === 'WAITLIST'
            ? previous.waitlistedAt
            : new Date()
          : null;
      await tx.rsvp.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: { eventId, userId, status, plusOnes, waitlistedAt },
        update: { status, plusOnes, waitlistedAt },
      });

      // Activity-feed entry on the Party Wall when the status actually changes.
      if (!previous || previous.status !== status) {
        await tx.comment.create({
          data: { eventId, userId, text: rsvpPhrase(status, plusOnes), type: 'system' },
        });
        const me = previous?.user ?? (await tx.user.findUniqueOrThrow({ where: { id: userId } }));
        await notify(
          tx,
          managerIds(event).filter((id) => id !== userId),
          {
            type: 'RSVP',
            text: `${me.name} ${rsvpPhrase(status, plusOnes)} — "${event.title}"`,
            eventSlug: event.slug,
          }
        );
      }

      // Leaving GOING (or shrinking a party) can free spots for the queue.
      await promoteWaitlist(tx, eventId);
    });
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.code);
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

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { cohosts: true },
  });
  if (!event) return c.json({ error: 'Event not found' }, 404);
  if (!canManageEvent(event, me)) return c.json({ error: 'Only hosts can remove guests' }, 403);
  if (targetUserId === event.hostId) {
    return c.json({ error: "The host can't be removed from their own event" }, 400);
  }
  if (event.cohosts.some((ch) => ch.userId === targetUserId)) {
    return c.json({ error: 'Remove them as co-host first' }, 400);
  }

  await db.$transaction(async (tx) => {
    await tx.rsvp.deleteMany({ where: { eventId, userId: targetUserId } });
    await promoteWaitlist(tx, eventId);
  });

  const updated = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: eventInclude,
  });
  return c.json({ event: toEventDetail(updated, me) });
});

// Cohost management — creator only.
eventRoutes.post('/:id/cohosts', async (c) => {
  const me = c.get('userId');
  const eventId = c.req.param('id');
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { cohosts: true },
  });
  if (!event) return c.json({ error: 'Event not found' }, 404);
  if (event.hostId !== me) return c.json({ error: 'Only the host can add co-hosts' }, 403);
  if (event.canceledAt) return c.json({ error: "Canceled events can't get new co-hosts" }, 409);

  const parsed = cohostSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Enter a valid email' }, 400);

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return c.json({ error: 'No Hausi account with that email' }, 404);
  if (user.id === event.hostId) return c.json({ error: "You're already the host" }, 409);
  if (event.cohosts.some((ch) => ch.userId === user.id)) {
    return c.json({ error: `${user.name} is already a co-host` }, 409);
  }

  await db.$transaction(async (tx) => {
    await tx.eventCohost.create({ data: { eventId, userId: user.id } });
    // Co-hosts are at their own party; don't run the capacity check for them.
    await tx.rsvp.upsert({
      where: { eventId_userId: { eventId, userId: user.id } },
      create: { eventId, userId: user.id, status: 'GOING' },
      update: { status: 'GOING' },
    });
    await notify(tx, [user.id], {
      type: 'COHOST_ADDED',
      text: `You're now a co-host of "${event.title}" 🤝`,
      eventSlug: event.slug,
    });
  });

  const updated = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: eventInclude,
  });
  return c.json({ event: toEventDetail(updated, me) }, 201);
});

eventRoutes.delete('/:id/cohosts/:userId', async (c) => {
  const me = c.get('userId');
  const eventId = c.req.param('id');
  const targetUserId = c.req.param('userId');

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return c.json({ error: 'Event not found' }, 404);
  if (event.hostId !== me) return c.json({ error: 'Only the host can remove co-hosts' }, 403);

  await db.eventCohost.deleteMany({ where: { eventId, userId: targetUserId } });

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
  const event = await db.event.findUnique({ where: { id: eventId }, include: { cohosts: true } });
  if (!event) return c.json({ error: 'Event not found' }, 404);

  const parsed = commentSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid comment' }, 400);

  const comment = await db.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: { eventId, userId, text: parsed.data.text },
      include: { user: true },
    });
    await notify(
      tx,
      managerIds(event).filter((id) => id !== userId),
      {
        type: 'COMMENT',
        text: `${created.user.name} commented on "${event.title}" 💬`,
        eventSlug: event.slug,
      }
    );
    return created;
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
