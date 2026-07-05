import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { toPublicUser } from '../lib/serialize.js';
import { findMutuals } from '../lib/mutuals.js';
import { notify } from '../lib/notify.js';
import {
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

async function computeBadges(userId: string): Promise<Badge[]> {
  const [hosted, attended, comments] = await Promise.all([
    db.event.count({ where: { hostId: userId, canceledAt: null } }),
    db.rsvp.count({ where: { userId, status: 'GOING', event: { hostId: { not: userId } } } }),
    db.comment.count({ where: { userId, type: 'comment' } }),
  ]);

  const badges: Badge[] = [];
  if (attended > 0)
    badges.push({ key: 'attended', label: 'parties attended', emoji: '🌐', value: attended });
  if (hosted > 0) badges.push({ key: 'hosted', label: 'hosted', emoji: '🎉', value: hosted });
  if (comments >= 3)
    badges.push({ key: 'hype', label: 'wall messages', emoji: '💬', value: comments });
  return badges;
}

export const meRoutes = new Hono<{ Variables: AuthVariables }>();
meRoutes.use('*', requireAuth);

meRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });

  const [mutualMap, badges, myCrushes] = await Promise.all([
    findMutuals(db, userId),
    computeBadges(userId),
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

// Toggle a crush on another user; a reciprocal crush notifies both.
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
      const meUser = await tx.user.findUniqueOrThrow({ where: { id: me } });
      await notify(tx, [me], {
        type: 'CRUSH_MATCH',
        text: `You and ${targetUser.name} have a crush on each other 💘`,
      });
      await notify(tx, [target], {
        type: 'CRUSH_MATCH',
        text: `You and ${meUser.name} have a crush on each other 💘`,
      });
      return true;
    }
    return false;
  });

  return c.json({ crushed: true, matched });
});
