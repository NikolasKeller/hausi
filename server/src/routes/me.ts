import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { toCardEntry, toPublicUser } from '../lib/serialize.js';
import { findMutuals } from '../lib/mutuals.js';
import {
  CARD_THEMES,
  LIMITS,
  type Badge,
  type MyProfile,
  type Mutual,
} from '../../../app/shared/types.js';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.name).optional(),
  avatarEmoji: z.string().trim().min(1).max(8).optional(),
  city: z.string().trim().min(1).max(80).optional(),
});

const cardSchema = z.object({
  // Optional: set to deliver in-app to a mutual. Omitted for share-by-link cards.
  toUserId: z.string().min(1).optional(),
  theme: z.enum(CARD_THEMES),
  message: z.string().trim().min(1).max(500),
});

async function computeBadges(userId: string): Promise<Badge[]> {
  const [hosted, attended, comments, cardsSent] = await Promise.all([
    db.event.count({ where: { hostId: userId, canceledAt: null } }),
    db.rsvp.count({ where: { userId, status: 'GOING', event: { hostId: { not: userId } } } }),
    db.comment.count({ where: { userId, type: 'comment' } }),
    db.card.count({ where: { fromId: userId } }),
  ]);

  const badges: Badge[] = [];
  if (attended > 0)
    badges.push({ key: 'attended', label: 'parties attended', emoji: '🌐', value: attended });
  if (hosted > 0) badges.push({ key: 'hosted', label: 'hosted', emoji: '🎉', value: hosted });
  if (comments >= 3)
    badges.push({ key: 'hype', label: 'wall messages', emoji: '💬', value: comments });
  if (cardsSent > 0)
    badges.push({ key: 'cards', label: 'cards sent', emoji: '💌', value: cardsSent });
  return badges;
}

export const meRoutes = new Hono<{ Variables: AuthVariables }>();
meRoutes.use('*', requireAuth);

meRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });

  const [mutualMap, badges, cards, myCrushes] = await Promise.all([
    findMutuals(db, userId),
    computeBadges(userId),
    db.card.findMany({
      // Skip cards the viewer archived on their own side (sent or received).
      where: {
        OR: [
          { fromId: userId, fromArchivedAt: null },
          { toId: userId, toArchivedAt: null },
        ],
      },
      include: { from: true, to: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    db.crush.findMany({ where: { fromId: userId }, select: { toId: true } }),
  ]);

  const crushedIds = new Set(myCrushes.map((cr) => cr.toId));
  const mutualUsers = await db.user.findMany({
    where: { id: { in: [...mutualMap.keys()] } },
  });
  const mutuals: Mutual[] = mutualUsers.map((u) => ({
    user: toPublicUser(u),
    sharedEventTitle: mutualMap.get(u.id)?.title ?? '',
    sharedEventSlug: mutualMap.get(u.id)?.slug ?? '',
    crushed: crushedIds.has(u.id),
  }));

  const profile: MyProfile = {
    id: me.id,
    name: me.name,
    email: me.email,
    phone: me.phone,
    avatarEmoji: me.avatarEmoji,
    city: me.city,
    joinedAt: me.createdAt.toISOString(),
    badges,
    mutuals,
    cards: cards.map(toCardEntry),
  };
  return c.json({ profile });
});

meRoutes.patch('/', async (c) => {
  const userId = c.get('userId');
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid profile data' }, 400);

  const me = await db.user.update({ where: { id: userId }, data: parsed.data });
  return c.json({
    user: { id: me.id, name: me.name, email: me.email, avatarEmoji: me.avatarEmoji, city: me.city },
  });
});

// Create a digital card. With `toUserId`, it's delivered in-app to that mutual
// (and they're notified). Without it, the card is shared by link — its id is the
// shareable handle (GET /api/cards/:id).
meRoutes.post('/cards', async (c) => {
  const userId = c.get('userId');
  const parsed = cardSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid card' }, 400);
  const { toUserId, theme, message } = parsed.data;
  if (toUserId === userId) return c.json({ error: "You can't send a card to yourself" }, 400);

  if (toUserId) {
    const recipient = await db.user.findUnique({ where: { id: toUserId } });
    if (!recipient) return c.json({ error: 'Recipient not found' }, 404);
  }

  const card = await db.$transaction(async (tx) => {
    const created = await tx.card.create({
      data: { fromId: userId, toId: toUserId ?? null, theme, message },
      include: { from: true, to: true },
    });
    return created;
  });

  return c.json({ card: toCardEntry(card) }, 201);
});

// Archive a card from your own "My cards" list. Stamps whichever side you are
// (sender or recipient), so it disappears for you while the other party keeps
// their copy; a share-by-link card stays reachable at GET /api/cards/:id.
meRoutes.post('/cards/:id/archive', async (c) => {
  const userId = c.get('userId');
  const card = await db.card.findUnique({ where: { id: c.req.param('id') } });
  if (!card) return c.json({ error: 'Card not found' }, 404);
  if (card.fromId !== userId && card.toId !== userId)
    return c.json({ error: 'Not your card' }, 403);

  await db.card.update({
    where: { id: card.id },
    data: card.fromId === userId ? { fromArchivedAt: new Date() } : { toArchivedAt: new Date() },
  });
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
