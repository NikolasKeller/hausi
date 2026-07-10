import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { toEventDetail, toPublicUser } from '../lib/serialize.js';
import { normalizePhone } from '../lib/phone.js';
import { eventInclude } from './events.js';
import { unlinkImage } from '../lib/uploads.js';
import { findMutuals } from '../lib/mutuals.js';
import { computeBadges } from '../lib/badges.js';
import { pairStates } from '../lib/friends.js';
import {
  LIMITS,
  type CoverTheme,
  type Friend,
  type FriendRequest,
  type MyProfile,
  type Mutual,
  type PendingCohostInvite,
  type TitleFont,
} from '../../../app/shared/types.js';

// Only our own upload paths are acceptable — never an external URL (which would
// let a user turn every viewer's client into a tracking beacon) or a traversal
// string. '' clears the photo back to the emoji.
const UPLOAD_PATH = /^\/uploads\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/;

const updateSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.name).optional(),
  avatarEmoji: z.string().trim().min(1).max(8).optional(),
  // Path to an uploaded profile photo (from POST /api/uploads); '' clears it.
  avatarImage: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || UPLOAD_PATH.test(v), 'Invalid image path')
    .optional(),
  // '' clears the bio.
  bio: z.string().trim().max(LIMITS.bio).optional(),
  city: z.string().trim().min(1).max(80).optional(),
});

export const meRoutes = new Hono<{ Variables: AuthVariables }>();
meRoutes.use('*', requireAuth);

meRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });

  const [mutualMap, badges, myCrushes, friendships] = await Promise.all([
    findMutuals(db, userId),
    computeBadges(userId),
    db.crush.findMany({ where: { fromId: userId }, select: { toId: true } }),
    db.friendship.findMany({
      where: { OR: [{ fromId: userId }, { toId: userId }] },
      include: { from: true, to: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const friends: Friend[] = [];
  const incomingRequests: FriendRequest[] = [];
  const outgoingRequests: FriendRequest[] = [];
  for (const row of friendships) {
    const other = row.fromId === userId ? row.to : row.from;
    if (row.status === 'ACCEPTED') {
      friends.push({ user: toPublicUser(other), since: row.updatedAt.toISOString() });
    } else if (row.status === 'PENDING') {
      const entry: FriendRequest = {
        id: row.id,
        user: toPublicUser(other),
        createdAt: row.createdAt.toISOString(),
      };
      (row.toId === userId ? incomingRequests : outgoingRequests).push(entry);
    }
  }

  const crushedIds = new Set(myCrushes.map((cr) => cr.toId));
  const mutualUsers = await db.user.findMany({
    where: { id: { in: [...mutualMap.keys()] } },
  });
  const states = await pairStates(db, userId, mutualUsers.map((u) => u.id));
  const mutuals: Mutual[] = mutualUsers.map((u) => ({
    user: toPublicUser(u),
    sharedEventTitle: mutualMap.get(u.id)?.title ?? '',
    sharedEventSlug: mutualMap.get(u.id)?.slug ?? '',
    crushed: crushedIds.has(u.id),
    friendState: states.get(u.id)?.state ?? 'none',
  }));

  const profile: MyProfile = {
    id: me.id,
    name: me.name,
    email: me.email,
    phone: me.phone,
    avatarEmoji: me.avatarEmoji,
    avatarImage: me.avatarImage,
    bio: me.bio,
    city: me.city,
    joinedAt: me.createdAt.toISOString(),
    badges,
    mutuals,
    friends,
    incomingRequests,
    outgoingRequests,
  };
  return c.json({ profile });
});

meRoutes.patch('/', async (c) => {
  const userId = c.get('userId');
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid profile data' }, 400);

  // A user may only point their avatar at a file they uploaded — otherwise they
  // could reference (and, via the reclaim below, delete) someone else's upload.
  if (parsed.data.avatarImage) {
    const owned = await db.upload.findFirst({
      where: { path: parsed.data.avatarImage, userId },
    });
    if (!owned) return c.json({ error: 'Invalid image' }, 400);
  }

  const existing = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const me = await db.user.update({ where: { id: userId }, data: parsed.data });
  // Replacing or clearing the profile photo orphans the old upload — reclaim it.
  if (parsed.data.avatarImage !== undefined && existing.avatarImage !== me.avatarImage) {
    await unlinkImage(existing.avatarImage);
    await db.upload.deleteMany({ where: { path: existing.avatarImage } });
  }
  return c.json({
    user: {
      id: me.id,
      name: me.name,
      email: me.email,
      avatarEmoji: me.avatarEmoji,
      avatarImage: me.avatarImage,
      bio: me.bio,
      city: me.city,
    },
  });
});

// Pending co-host invitations addressed to my phone number. Matched on the
// canonicalized (E.164) phone the host invited, so it lines up with the number
// my account signed in with. Canceled events are filtered out (moot invites).
meRoutes.get('/cohost-invites', async (c) => {
  const userId = c.get('userId');
  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!me.phone) return c.json({ invites: [] });

  const invites = await db.cohostInvite.findMany({
    where: { phone: normalizePhone(me.phone), status: 'PENDING', event: { canceledAt: null } },
    include: { invitedBy: true, event: true },
    orderBy: { createdAt: 'desc' },
  });

  const result: PendingCohostInvite[] = invites.map((i) => ({
    id: i.id,
    invitedBy: toPublicUser(i.invitedBy),
    createdAt: i.createdAt.toISOString(),
    event: {
      id: i.event.id,
      slug: i.event.slug,
      title: i.event.title,
      coverTheme: i.event.coverTheme as CoverTheme,
      coverImage: i.event.coverImage,
      titleFont: i.event.titleFont as TitleFont,
      date: i.event.date.toISOString(),
      canceledAt: i.event.canceledAt ? i.event.canceledAt.toISOString() : null,
    },
  }));
  return c.json({ invites: result });
});

// Accept a co-host invite: this is the moment we actually make the person a
// co-host — create the EventCohost row (+ a GOING rsvp, same as the old direct
// add) and mark the invite ACCEPTED. Acceptance is required even for existing
// accounts, so nothing happened until now.
meRoutes.post('/cohost-invites/:inviteId/accept', async (c) => {
  const userId = c.get('userId');
  const inviteId = c.req.param('inviteId');
  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });

  const invite = await db.cohostInvite.findUnique({
    where: { id: inviteId },
    include: { event: true },
  });
  if (!invite) return c.json({ error: 'Invite not found' }, 404);
  // Only the person the invite was addressed to (by phone) can act on it.
  if (!me.phone || normalizePhone(me.phone) !== normalizePhone(invite.phone)) {
    return c.json({ error: "This invite isn't for you" }, 403);
  }
  if (invite.status === 'DECLINED') {
    return c.json({ error: 'You already declined this invite' }, 409);
  }
  if (invite.event.canceledAt) return c.json({ error: 'This event was canceled' }, 409);
  if (invite.event.hostId === userId) {
    return c.json({ error: "You're already the host" }, 409);
  }

  const eventId = invite.eventId;
  await db.$transaction(async (tx) => {
    await tx.eventCohost.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId },
      update: {},
    });
    // Co-hosts are at their own party; don't run the capacity check for them.
    await tx.rsvp.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, status: 'GOING' },
      update: { status: 'GOING' },
    });
    await tx.cohostInvite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED' } });
  });

  const updated = await db.event.findUniqueOrThrow({ where: { id: eventId }, include: eventInclude });
  return c.json({ event: toEventDetail(updated, userId, me.phone) });
});

// Decline a co-host invite — flips it to DECLINED so it drops off my pending
// list. The host can always re-invite (which flips the row back to PENDING).
meRoutes.post('/cohost-invites/:inviteId/decline', async (c) => {
  const userId = c.get('userId');
  const inviteId = c.req.param('inviteId');
  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });

  const invite = await db.cohostInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return c.json({ error: 'Invite not found' }, 404);
  if (!me.phone || normalizePhone(me.phone) !== normalizePhone(invite.phone)) {
    return c.json({ error: "This invite isn't for you" }, 403);
  }
  if (invite.status === 'PENDING') {
    await db.cohostInvite.update({ where: { id: invite.id }, data: { status: 'DECLINED' } });
  }
  return c.json({ ok: true });
});

// Toggle a crush on another user; reciprocal crushes are a match.
meRoutes.post('/crush/:userId', async (c) => {
  const me = c.get('userId');
  const target = c.req.param('userId');
  if (target === me) return c.json({ error: 'Aim outward 💘' }, 400);

  const targetUser = await db.user.findUnique({ where: { id: target } });
  if (!targetUser) return c.json({ error: 'User not found' }, 404);

  const existing = await db.crush.findUnique({
    where: { fromId_toId: { fromId: me, toId: target } },
  });
  if (existing) {
    await db.crush.delete({ where: { id: existing.id } });
    return c.json({ crushed: false, matched: false });
  }

  const matched = await db.$transaction(async (tx) => {
    await tx.crush.create({ data: { fromId: me, toId: target } });
    const reciprocal = await tx.crush.findUnique({
      where: { fromId_toId: { fromId: target, toId: me } },
    });
    if (reciprocal) {
      return true;
    }
    return false;
  });

  return c.json({ crushed: true, matched });
});
