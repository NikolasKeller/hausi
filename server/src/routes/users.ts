import { Hono } from 'hono';
import { db } from '../lib/db.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { toPublicUser } from '../lib/serialize.js';
import { computeBadges } from '../lib/badges.js';
import { findFriendIds, findPairRow, pairState, pairStates } from '../lib/friends.js';
import { findMutuals } from '../lib/mutuals.js';
import { publicUsername } from '../lib/username.js';
import type { PublicProfile, UserSearchResult } from '../../../app/shared/types.js';

export const userRoutes = new Hono<{ Variables: AuthVariables }>();
userRoutes.use('*', requireAuth);

// Search by unique @handle or display name. The result carries the caller's
// current friendship state so search can be an actionable people picker.
userRoutes.get('/search', async (c) => {
  const viewerId = c.get('userId');
  const raw = c.req.query('q')?.trim() ?? '';
  const q = raw.replace(/^@+/, '').toLowerCase();
  if (q.length < 2) return c.json({ users: [] });

  const users = await db.user.findMany({
    where: {
      id: { not: viewerId },
      isOrganization: false,
      name: { not: '' },
      OR: [{ username: { contains: q } }, { name: { contains: raw } }],
    },
    orderBy: [{ username: 'asc' }, { name: 'asc' }],
    take: 20,
  });
  const states = await pairStates(db, viewerId, users.map((user) => user.id));
  const results: UserSearchResult[] = users.map((user) => ({
    ...toPublicUser(user),
    city: user.city,
    friendState: states.get(user.id)?.state ?? 'none',
  }));
  return c.json({ users: results });
});

// Another user's profile: public-safe fields (no phone/email) plus the
// viewer-specific social context — friendship state, friends in common and
// the party you met at.
userRoutes.get('/:id', async (c) => {
  const viewerId = c.get('userId');
  const targetId = c.req.param('id');

  const target = await db.user.findUnique({ where: { id: targetId } });
  if (!target) return c.json({ error: 'User not found' }, 404);

  const [badges, theirFriends, myFriends, pairRow, mutualMap] = await Promise.all([
    computeBadges(targetId),
    findFriendIds(db, targetId),
    viewerId === targetId ? Promise.resolve(new Set<string>()) : findFriendIds(db, viewerId),
    viewerId === targetId ? Promise.resolve(null) : findPairRow(db, viewerId, targetId),
    viewerId === targetId
      ? Promise.resolve(new Map<string, { title: string; slug: string }>())
      : findMutuals(db, viewerId),
  ]);

  // Friends in common: intersection of both accepted-friend sets.
  const commonIds = [...myFriends].filter((id) => theirFriends.has(id) && id !== viewerId);
  const commonUsers = commonIds.length
    ? await db.user.findMany({ where: { id: { in: commonIds } }, take: 12 })
    : [];

  const { state, requestId } = pairState(pairRow, viewerId);

  const profile: PublicProfile = {
    id: target.id,
    name: target.name,
    username: publicUsername(target),
    avatarEmoji: target.avatarEmoji,
    avatarImage: target.avatarImage,
    bio: target.bio,
    city: target.city,
    joinedAt: target.createdAt.toISOString(),
    isOrganization: target.isOrganization,
    badges,
    friendsCount: theirFriends.size,
    mutualFriends: commonUsers.map(toPublicUser),
    sharedEventTitle: mutualMap.get(targetId)?.title ?? '',
    friendState: state,
    requestId,
  };
  return c.json({ profile });
});
