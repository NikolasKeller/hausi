import { Hono } from 'hono';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '../lib/db.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import {
  canManageEvent,
  commentType,
  countRsvps,
  toEventDetail,
  toEventSummary,
  toPublicUser,
} from '../lib/serialize.js';
import { makeSlug } from '../lib/slug.js';
import { normalizePhone, phoneCountry } from '../lib/phone.js';
import { sendSms, smsEnabled } from '../lib/sms.js';
import { unlinkImage } from '../lib/uploads.js';
import { findMutuals, rememberPartyConnections } from '../lib/mutuals.js';
import { ledger } from '../lib/ledger.js';
import {
  CATEGORIES,
  COVER_THEMES,
  DESCRIPTION_SCALE,
  EFFECTS,
  LIMITS,
  MAX_PLUS_ONES,
  RSVP_CHOICES,
  TITLE_FONTS,
} from '../../../app/shared/types.js';

export const eventInclude = {
  host: true,
  cohosts: { include: { user: true } },
  cohostInvites: { include: { invitedBy: true } },
  rsvps: {
    include: { user: true, plusOneGuests: { include: { user: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  comments: { include: { user: true }, orderBy: { createdAt: 'asc' as const } },
};

const eventInputSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.title),
  description: z.string().trim().max(LIMITS.description).optional(),
  descriptionScale: z
    .number()
    .int()
    .min(DESCRIPTION_SCALE.min)
    .max(DESCRIPTION_SCALE.max)
    .optional(),
  coverTheme: z.enum(COVER_THEMES).optional(),
  // Path to an uploaded cover image (from POST /api/uploads), e.g. /uploads/x.jpg.
  coverImage: z.string().trim().max(500).optional(),
  titleFont: z.enum(TITLE_FONTS).optional(),
  effect: z.enum(EFFECTS).optional(),
  date: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')
    .transform((s) => new Date(s)),
  // Required on create — a party needs a where. Realness (that it's an
  // on-the-map place) is enforced by the client LocationPicker, mirroring how
  // the City search gates cities; the server just guarantees presence. On PATCH
  // the schema is .partial()'d, so this only applies when location is sent.
  location: z.string().trim().min(1).max(LIMITS.location),
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
});

// A +1 is either an existing iykyk user (picked from mutuals) or a manual
// name + phone entry. Extra keys are ignored, so { userId } wins if both appear.
const plusOneSchema = z.union([
  z.object({ userId: z.string().min(1) }),
  z.object({
    name: z.string().trim().min(1).max(LIMITS.name),
    phone: z.string().trim().min(3).max(30),
  }),
]);

const commentSchema = z.object({
  text: z.string().trim().min(1).max(LIMITS.comment),
});

const blastSchema = z.object({
  text: z.string().trim().min(1).max(LIMITS.blast),
});

// Co-hosts are now invited by phone number (E.164-ish, same shape as auth),
// mirroring the phone-first sign-in flow.
const cohostSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()\-]{6,20}$/, 'Enter a phone number like +14155551234'),
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
// Runs inside the caller's transaction; writes system entries.
async function promoteWaitlist(tx: Prisma.TransactionClient, eventId: string) {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    include: { rsvps: true },
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
        text: 'is off the waitlist - going! 🎉',
        type: 'system',
      },
    });
  }
}

export const eventRoutes = new Hono<{ Variables: AuthVariables }>();
eventRoutes.use('*', requireAuth);

// Feed: events I host, co-host or have RSVP'd to.
eventRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const events = await db.event.findMany({
    where: {
      canceledAt: null,
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
      descriptionScale: data.descriptionScale ?? DESCRIPTION_SCALE.default,
      coverTheme: data.coverTheme ?? 'sunset',
      coverImage: data.coverImage ?? '',
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
      // The host organizes the event; they are not a "going" guest, so no
      // self-RSVP is created. Their event still shows in their feed via hostId.
    },
    include: eventInclude,
  });
  ledger({
    action: 'created',
    eventSlug: event.slug,
    eventTitle: event.title,
    category: event.category,
    isPublic: event.isPublic,
    actorId: userId,
    actorName: me.name,
  });
  return c.json({ event: toEventDetail(event, userId) }, 201);
});

eventRoutes.get('/by-slug/:slug', async (c) => {
  const userId = c.get('userId');
  const event = await db.event.findUnique({
    where: { slug: c.req.param('slug') },
    include: eventInclude,
  });
  // Canceled events are treated as gone — the page 404s like a deleted one.
  if (!event || event.canceledAt) return c.json({ error: 'Event not found' }, 404);
  // The viewer's phone lets toEventDetail surface a pending co-host invite
  // addressed to them (Accept/Decline banner on the event page).
  const viewer = await db.user.findUnique({ where: { id: userId }, select: { phone: true } });
  return c.json({ event: toEventDetail(event, userId, viewer?.phone) });
});

// Given a list of slugs, return the subset that still exists. The app caches
// "recently viewed" events locally per device, so this lets it prune entries
// whose event has since been deleted (by any host, on any device).
const existsSchema = z.object({
  slugs: z.array(z.string().trim().min(1)).max(50),
});
eventRoutes.post('/exists', async (c) => {
  const parsed = existsSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);
  if (parsed.data.slugs.length === 0) return c.json({ slugs: [] });
  const rows = await db.event.findMany({
    where: { slug: { in: parsed.data.slugs }, canceledAt: null },
    select: { slug: true },
  });
  return c.json({ slugs: rows.map((r) => r.slug) });
});

eventRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  const event = await db.event.findUnique({
    where: { id: c.req.param('id') },
    include: eventInclude,
  });
  if (!event || event.canceledAt) return c.json({ error: 'Event not found' }, 404);
  const viewer = await db.user.findUnique({ where: { id: userId }, select: { phone: true } });
  return c.json({ event: toEventDetail(event, userId, viewer?.phone) });
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
    await tx.event.update({
      where: { id: existing.id },
      data,
      include: eventInclude,
    });

    // A lowered plus-one limit clamps existing parties so nobody is stuck
    // above the new cap (and the freed seats can go to the waitlist). Drop the
    // named +1 rows too, keeping the oldest, so the count stays in sync.
    if (data.plusOneLimit != null) {
      const over = await tx.rsvp.findMany({
        where: { eventId: existing.id, plusOnes: { gt: data.plusOneLimit } },
        include: { plusOneGuests: { orderBy: { createdAt: 'asc' } } },
      });
      for (const r of over) {
        const excess = r.plusOneGuests.slice(data.plusOneLimit);
        if (excess.length) {
          await tx.plusOne.deleteMany({ where: { id: { in: excess.map((g) => g.id) } } });
        }
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

    return tx.event.findUniqueOrThrow({ where: { id: existing.id }, include: eventInclude });
  });

  // A replaced cover leaves the old file orphaned on the volume — reclaim it.
  if (data.coverImage !== undefined && data.coverImage !== existing.coverImage) {
    await unlinkImage(existing.coverImage);
  }

  const editor = await db.user.findUniqueOrThrow({ where: { id: userId } });
  ledger({
    action: 'updated',
    eventSlug: event.slug,
    eventTitle: event.title,
    category: event.category,
    isPublic: event.isPublic,
    actorId: userId,
    actorName: editor.name,
  });
  return c.json({ event: toEventDetail(event, userId) });
});

// Canceling soft-hides the event: guests are notified, then it disappears from
// every list and its page 404s. (The delete endpoint below hard-removes the row.)
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
    return tx.event.findUniqueOrThrow({ where: { id: existing.id }, include: eventInclude });
  });

  const canceler = await db.user.findUniqueOrThrow({ where: { id: userId } });
  ledger({
    action: 'canceled',
    eventSlug: event.slug,
    eventTitle: event.title,
    category: event.category,
    isPublic: event.isPublic,
    actorId: userId,
    actorName: canceler.name,
  });
  return c.json({ event: toEventDetail(event, userId) });
});

eventRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const existing = await db.event.findUnique({
    where: { id: c.req.param('id') },
    include: { rsvps: { include: { plusOneGuests: true } }, cohosts: true },
  });
  if (!existing) return c.json({ error: 'Event not found' }, 404);
  if (existing.hostId !== userId)
    return c.json({ error: 'Only the host can delete this event' }, 403);

  await db.$transaction(async (tx) => {
    // Preserve who partied here before the cascade wipes the RSVPs, so these
    // people stay in everyone's mutuals even once the event is gone.
    await rememberPartyConnections(tx, existing);
    await tx.event.delete({ where: { id: existing.id } });
  });
  await unlinkImage(existing.coverImage);
  const deleter = await db.user.findUniqueOrThrow({ where: { id: userId } });
  ledger({
    action: 'deleted',
    eventSlug: existing.slug,
    eventTitle: existing.title,
    category: existing.category,
    isPublic: existing.isPublic,
    actorId: userId,
    actorName: deleter.name,
  });
  return c.json({ ok: true });
});

eventRoutes.put('/:id/rsvp', async (c) => {
  const userId = c.get('userId');
  const eventId = c.req.param('id');

  const parsed = rsvpSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid RSVP' }, 400);
  const requestedStatus = parsed.data.status;

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

      // Plus-ones ride along with a GOING status and are managed on their own
      // endpoint — here we only carry the existing count forward, and drop them
      // entirely when the guest steps back to MAYBE/CANT.
      const plusOnes = requestedStatus === 'GOING' ? (previous?.plusOnes ?? 0) : 0;

      // Closed RSVPs block a new join, but guests must always be able to
      // withdraw (CANT/MAYBE) or re-confirm a spot they already hold.
      const isDowngrade = previous != null && (requestedStatus !== 'GOING' || previous.status === 'GOING');
      if (!event.rsvpsOpen && !isManager && !isDowngrade) {
        throw new HttpError('RSVPs are closed', 409);
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
      const saved = await tx.rsvp.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: { eventId, userId, status, plusOnes, waitlistedAt },
        update: { status, plusOnes, waitlistedAt },
      });

      // Stepping away from GOING releases any +1 the guest was bringing.
      if (requestedStatus !== 'GOING') {
        await tx.plusOne.deleteMany({ where: { rsvpId: saved.id } });
      }

      // Activity-feed entry on the Party Wall when the status actually changes.
      if (!previous || previous.status !== status) {
        await tx.comment.create({
          data: { eventId, userId, text: rsvpPhrase(status, plusOnes), type: 'system' },
        });
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

// Bring a +1 to an event you're going to — either an iykyk user picked from
// your mutuals, or a manual name + phone. A guest may bring several, up to
// min(event.plusOneLimit, MAX_PLUS_ONES). Each +1 counts as one extra head
// toward capacity via Rsvp.plusOnes.
eventRoutes.post('/:id/plus-one', async (c) => {
  const userId = c.get('userId');
  const eventId = c.req.param('id');

  const parsed = plusOneSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Enter a name and phone number for your plus one' }, 400);
  }
  const input = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: { rsvps: { include: { user: true, plusOneGuests: true } }, cohosts: true },
      });
      if (!event) throw new HttpError('Event not found', 404);
      if (event.canceledAt) throw new HttpError('This event was canceled', 409);

      const isManager = canManageEvent(event, userId);
      const mine = event.rsvps.find((r) => r.userId === userId);
      if (!mine || mine.status !== 'GOING') {
        throw new HttpError("Say you're going before adding a plus one", 400);
      }
      if (!event.rsvpsOpen && !isManager) throw new HttpError('RSVPs are closed', 409);
      if (event.plusOneLimit <= 0) throw new HttpError('No plus ones for this event', 400);
      // Effective allowance = the host's per-event limit, capped at the global
      // hard max so nobody can pack in more than MAX_PLUS_ONES.
      const maxPlusOnes = Math.min(event.plusOneLimit, MAX_PLUS_ONES);
      if (mine.plusOneGuests.length >= maxPlusOnes) {
        throw new HttpError(
          maxPlusOnes === 1
            ? 'You can only bring one plus one'
            : `You can bring at most ${maxPlusOnes} plus ones`,
          409
        );
      }
      // The +1 adds one head; a full event has no room for it (no waitlisting).
      if (event.maxGuests != null && countRsvps(event.rsvps).going + 1 > event.maxGuests) {
        throw new HttpError('Not enough spots left for a plus one', 409);
      }

      let name: string;
      let phone: string | null;
      let linkedUserId: string | null;
      if ('userId' in input) {
        if (input.userId === userId) {
          throw new HttpError("You're already going - pick someone else", 400);
        }
        const guest = await tx.user.findUnique({ where: { id: input.userId } });
        if (!guest) throw new HttpError('That person is no longer on iykyk', 404);
        // Also block a duplicate account of yourself (same number, different id):
        // picking it links a +1 to your own person and collapses to a self-+1
        // once the two accounts are deduped.
        if (
          guest.phone &&
          mine.user.phone &&
          normalizePhone(guest.phone) === normalizePhone(mine.user.phone)
        ) {
          throw new HttpError("You're already going - pick someone else", 400);
        }
        // Linked +1s must be someone you've actually partied with. The client
        // only offers mutuals; this closes the direct-API bypass (attaching a
        // stranger's name/avatar to the guest list without any connection).
        const mutuals = await findMutuals(tx, userId);
        if (!mutuals.has(guest.id)) {
          throw new HttpError("You can only bring people you've partied with", 403);
        }
        // Don't double-count someone already on the list or already brought by
        // another guest.
        const onList = event.rsvps.some((r) => r.userId === guest.id && r.status !== 'CANT');
        const alreadyPlusOne = event.rsvps.some((r) =>
          r.plusOneGuests.some((g) => g.userId === guest.id)
        );
        if (onList || alreadyPlusOne) {
          throw new HttpError(`${guest.name} is already on the guest list`, 409);
        }
        name = guest.name;
        phone = guest.phone;
        linkedUserId = guest.id;
      } else {
        name = input.name;
        // Canonicalize so the spot links up when this number signs in later,
        // and so the same person can't be added twice under different spellings.
        // Fold a bare national number (no "+") using the adder's own country, so
        // typing your own "4155551234" maps to the same "+14155551234" as your
        // account — otherwise the self-check below (and the sign-in link) misses.
        phone = normalizePhone(input.phone, phoneCountry(mine.user.phone));
        if (!/^\+[0-9]{7,15}$/.test(phone)) {
          throw new HttpError('Enter a valid phone number, like +14155551234', 400);
        }
        linkedUserId = null;
        const holder = await tx.user.findUnique({ where: { phone } });
        // You can't bring yourself. Compare against your own number directly:
        // the holder lookup below can miss a self-add when your account's stored
        // phone was never canonicalized to E.164, so "+1 415…" vs "4155551234…"
        // wouldn't match and the spot would slip through as "olivia brings Olivia."
        const myPhone = mine.user.phone ? normalizePhone(mine.user.phone) : null;
        if ((myPhone && myPhone === phone) || (holder && holder.id === userId)) {
          throw new HttpError("You're already going - you can't bring yourself", 400);
        }
        if (holder && event.rsvps.some((r) => r.userId === holder.id && r.status !== 'CANT')) {
          throw new HttpError(
            `${holder.name.trim() || 'That person'} is already on the guest list`,
            409
          );
        }
        if (
          event.rsvps.some((r) =>
            r.plusOneGuests.some((g) => g.phone === phone || (holder && g.userId === holder.id))
          )
        ) {
          throw new HttpError("That number is already someone's plus one", 409);
        }
      }

      await tx.plusOne.create({ data: { rsvpId: mine.id, name, phone, userId: linkedUserId } });
      // Recompute the denormalized count from the rows so it can never drift.
      const guestCount = await tx.plusOne.count({ where: { rsvpId: mine.id } });
      await tx.rsvp.update({ where: { id: mine.id }, data: { plusOnes: guestCount } });

      await tx.comment.create({
        data: { eventId, userId, text: `is bringing ${name} 🎟️`, type: 'system' },
      });
    });
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.code);
    throw e;
  }

  const updated = await db.event.findUniqueOrThrow({ where: { id: eventId }, include: eventInclude });
  return c.json({ event: toEventDetail(updated, userId) }, 201);
});

// Remove a +1 — the guest who added it, or a host/cohost, can drop it. The
// freed seat may let the waitlist advance.
eventRoutes.delete('/:id/plus-one/:plusOneId', async (c) => {
  const userId = c.get('userId');
  const eventId = c.req.param('id');
  const plusOneId = c.req.param('plusOneId');

  try {
    await db.$transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: eventId }, include: { cohosts: true } });
      if (!event) throw new HttpError('Event not found', 404);
      const plusOne = await tx.plusOne.findUnique({
        where: { id: plusOneId },
        include: { rsvp: true },
      });
      if (!plusOne || plusOne.rsvp.eventId !== eventId) {
        throw new HttpError('Plus one not found', 404);
      }
      if (plusOne.rsvp.userId !== userId && !canManageEvent(event, userId)) {
        throw new HttpError('You can only remove your own plus one', 403);
      }
      await tx.plusOne.delete({ where: { id: plusOne.id } });
      // Recompute the count from the surviving rows (self-heals any drift).
      const guestCount = await tx.plusOne.count({ where: { rsvpId: plusOne.rsvpId } });
      await tx.rsvp.update({ where: { id: plusOne.rsvpId }, data: { plusOnes: guestCount } });
      await promoteWaitlist(tx, eventId);
    });
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.code);
    throw e;
  }

  const updated = await db.event.findUniqueOrThrow({ where: { id: eventId }, include: eventInclude });
  return c.json({ event: toEventDetail(updated, userId) });
});

// Cohost management — creator only. Inviting is by phone: we create a PENDING
// CohostInvite and text the invitee an event link. They become an actual
// co-host only once they sign in and accept (see the /me/cohost-invites routes).
eventRoutes.post('/:id/cohosts', async (c) => {
  const me = c.get('userId');
  const eventId = c.req.param('id');
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { cohosts: { include: { user: true } }, host: true },
  });
  if (!event) return c.json({ error: 'Event not found' }, 404);
  if (event.hostId !== me) return c.json({ error: 'Only the host can add co-hosts' }, 403);
  if (event.canceledAt) return c.json({ error: "Canceled events can't get new co-hosts" }, 409);

  const parsed = cohostSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Enter a valid phone number' }, 400);

  // Canonicalize to E.164, folding a bare national number using the host's own
  // country — the same treatment sign-in gives numbers, so the invite matches
  // the account the invitee eventually creates.
  const phone = normalizePhone(parsed.data.phone, phoneCountry(event.host.phone));
  if (!/^\+[0-9]{7,15}$/.test(phone)) {
    return c.json({ error: 'Enter a valid phone number, like +14155551234' }, 400);
  }

  // Can't invite yourself (the host), whether typed as your own number or not.
  if (event.host.phone && normalizePhone(event.host.phone) === phone) {
    return c.json({ error: "You're already the host" }, 409);
  }
  // Already a co-host (match on the account's canonicalized phone).
  const existingCohost = event.cohosts.find(
    (ch) => ch.user.phone && normalizePhone(ch.user.phone) === phone
  );
  if (existingCohost) {
    return c.json({ error: `${existingCohost.user.name || 'They'} is already a co-host` }, 409);
  }

  // One open invite per number: reuse the row (a prior decline flips back to
  // PENDING) so re-inviting is idempotent and never trips the unique constraint.
  const prior = await db.cohostInvite.findUnique({
    where: { eventId_phone: { eventId, phone } },
  });
  if (prior && prior.status === 'PENDING') {
    return c.json({ error: 'That number already has a pending invite' }, 409);
  }
  await db.cohostInvite.upsert({
    where: { eventId_phone: { eventId, phone } },
    create: { eventId, phone, invitedById: me, status: 'PENDING' },
    update: { status: 'PENDING', invitedById: me },
  });

  // Build a tappable link back to the event (same origin logic as text blasts),
  // falling back to APP_URL. Sent over SMS when Twilio is configured; otherwise
  // returned for the on-screen dev preview, mirroring the login-code flow.
  const configured = process.env.APP_URL?.trim();
  const fwdHost = c.req.header('x-forwarded-host') ?? c.req.header('host');
  const fwdProto = c.req.header('x-forwarded-proto') ?? 'https';
  const base = (configured || (fwdHost ? `${fwdProto}://${fwdHost}` : '')).replace(/\/$/, '');
  const link = base ? `${base}/e/${event.slug}` : '';
  const body = `${event.host.name || 'A host'} invited you to co-host "${event.title}" on iykyk 🤝${
    link ? `\nAccept here: ${link}` : ''
  }`;

  let sent = false;
  if (smsEnabled) {
    try {
      await sendSms(phone, body);
      sent = true;
    } catch (e) {
      console.error('Co-host invite SMS failed:', e);
      // The invite row still exists — surface a soft warning rather than failing
      // the whole request (the host can re-send / share the link manually).
    }
  }

  const updated = await db.event.findUniqueOrThrow({
    where: { id: eventId },
    include: eventInclude,
  });
  // devLink lets local dev / no-SMS deploys show the invite link on screen,
  // exactly like the login-code devCode fallback.
  return c.json(
    { event: toEventDetail(updated, me), sent, devLink: sent ? undefined : link || undefined },
    201
  );
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
      user: toPublicUser(co.user),
      text: co.text,
      type: commentType(co.type),
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
    return created;
  });

  return c.json(
    {
      comment: {
        id: comment.id,
        user: toPublicUser(comment.user),
        text: comment.text,
        type: 'comment' as const,
        createdAt: comment.createdAt.toISOString(),
      },
    },
    201
  );
});

// Host "text blast": post an announcement to the event page AND text every
// guest automatically, server-side (Twilio when configured) — no native
// compose sheet, no per-message confirmation. Stored as a Comment with
// type 'blast' so it rides the event page, but renders in its own
// Announcements section rather than the Party Wall.
eventRoutes.post('/:id/blast', async (c) => {
  const userId = c.get('userId');
  const eventId = c.req.param('id');

  const event = await db.event.findUnique({ where: { id: eventId }, include: eventInclude });
  if (!event) return c.json({ error: 'Event not found' }, 404);
  if (event.canceledAt) return c.json({ error: 'This event was canceled' }, 409);
  if (!canManageEvent(event, userId)) {
    return c.json({ error: 'Only hosts can send a text blast' }, 403);
  }

  const parsed = blastSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Write something to blast' }, 400);
  const text = parsed.data.text;

  // The sender is the host or a co-host (canManageEvent guaranteed it) — read
  // their name/phone from the already-loaded event, no extra query.
  const sender =
    event.host.id === userId
      ? event.host
      : event.cohosts.find((ch) => ch.userId === userId)?.user ?? event.host;

  const created = await db.comment.create({
    data: { eventId, userId, text, type: 'blast' },
    include: { user: true },
  });

  // Recipients: everyone still on the guest list (skip CANT) plus their named
  // +1s — anyone with a phone, deduped. Texting is best-effort: a provider
  // hiccup must not fail the blast (it's already posted to the page).
  const recipients = new Map<string, string>();
  for (const r of event.rsvps) {
    if (r.status === 'CANT') continue;
    if (r.user.phone) recipients.set(normalizePhone(r.user.phone), r.user.name);
    for (const g of r.plusOneGuests) {
      if (g.phone) recipients.set(normalizePhone(g.phone), g.name);
    }
  }
  // Never text the sender, however their number reached the list (own RSVP, a
  // duplicate account, or being brought as someone else's +1).
  if (sender.phone) recipients.delete(normalizePhone(sender.phone));

  // Build a tappable link from the request origin (Railway sets x-forwarded-*),
  // falling back to APP_URL — so the text always carries a way back to the event.
  const configured = process.env.APP_URL?.trim();
  const fwdHost = c.req.header('x-forwarded-host') ?? c.req.header('host');
  const fwdProto = c.req.header('x-forwarded-proto') ?? 'https';
  const base = (configured || (fwdHost ? `${fwdProto}://${fwdHost}` : '')).replace(/\/$/, '');
  const link = base ? `\n${base}/e/${event.slug}` : '';
  const body = `📣 ${event.title} — from ${sender.name}\n${text}${link}`;

  let sent = 0;
  if (smsEnabled && recipients.size) {
    const results = await Promise.allSettled(
      [...recipients.keys()].map((phone) => sendSms(phone, body))
    );
    sent = results.filter((r) => r.status === 'fulfilled').length;
  }

  // Splice the just-created blast into the loaded event so the response carries
  // it without a second full read. `notified` is who we targeted; `sent` is how
  // many texts actually went out (0 in local dev / no SMS provider) — the
  // composer keys its success copy off `sent`, not the recipient count.
  event.comments.push(created);
  return c.json({ event: toEventDetail(event, userId), notified: recipients.size, sent }, 201);
});
