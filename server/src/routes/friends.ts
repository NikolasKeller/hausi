import { Hono } from 'hono';
import { db } from '../lib/db.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { toPublicUser } from '../lib/serialize.js';
import { findPairRow } from '../lib/friends.js';
import type { Friend, FriendRequest } from '../../../app/shared/types.js';

export const friendRoutes = new Hono<{ Variables: AuthVariables }>();
friendRoutes.use('*', requireAuth);

// My friends + pending requests in one round trip (the profile tab's social
// section). Requests carry the OTHER person: sender for incoming, recipient
// for outgoing.
friendRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await db.friendship.findMany({
    where: { OR: [{ fromId: userId }, { toId: userId }] },
    include: { from: true, to: true },
    orderBy: { updatedAt: 'desc' },
  });

  const friends: Friend[] = [];
  const incoming: FriendRequest[] = [];
  const outgoing: FriendRequest[] = [];
  for (const row of rows) {
    const other = row.fromId === userId ? row.to : row.from;
    if (row.status === 'ACCEPTED') {
      friends.push({ user: toPublicUser(other), since: row.updatedAt.toISOString() });
    } else if (row.status === 'PENDING') {
      const entry: FriendRequest = {
        id: row.id,
        user: toPublicUser(other),
        createdAt: row.createdAt.toISOString(),
      };
      (row.toId === userId ? incoming : outgoing).push(entry);
    }
    // DECLINED rows are invisible — the pair simply has no connection.
  }
  return c.json({ friends, incoming, outgoing });
});

// Send a friend request. If the other person already has one pending toward
// me, this counts as accepting it — both wanted the connection.
friendRoutes.post('/requests/:userId', async (c) => {
  const me = c.get('userId');
  const target = c.req.param('userId');
  if (target === me) return c.json({ error: "You can't friend yourself" }, 400);

  const targetUser = await db.user.findUnique({ where: { id: target } });
  if (!targetUser) return c.json({ error: 'User not found' }, 404);
  if (targetUser.isOrganization) {
    return c.json({ error: "Organizations can't be added as friends" }, 400);
  }

  const existing = await findPairRow(db, me, target);
  if (existing) {
    if (existing.status === 'ACCEPTED') {
      return c.json({ error: "You're already friends" }, 409);
    }
    if (existing.status === 'PENDING') {
      if (existing.fromId === me) {
        return c.json({ error: 'Request already sent' }, 409);
      }
      // They asked first — sending back = accepting.
      await db.friendship.update({ where: { id: existing.id }, data: { status: 'ACCEPTED' } });
      return c.json({ state: 'friends' });
    }
    // DECLINED: re-send by flipping the row back to PENDING, re-pointed at the
    // new requester so accept/decline permissions line up.
    await db.friendship.update({
      where: { id: existing.id },
      data: { status: 'PENDING', fromId: me, toId: target },
    });
    return c.json({ state: 'outgoing' });
  }

  await db.friendship.create({ data: { fromId: me, toId: target } });
  return c.json({ state: 'outgoing' }, 201);
});

// Accept a pending request addressed to me.
friendRoutes.post('/requests/:requestId/accept', async (c) => {
  const me = c.get('userId');
  const row = await db.friendship.findUnique({ where: { id: c.req.param('requestId') } });
  if (!row || row.status !== 'PENDING') return c.json({ error: 'Request not found' }, 404);
  if (row.toId !== me) return c.json({ error: "This request isn't for you" }, 403);
  await db.friendship.update({ where: { id: row.id }, data: { status: 'ACCEPTED' } });
  return c.json({ state: 'friends' });
});

// Decline a pending request addressed to me. The row stays as DECLINED so the
// sender's UI reads 'none' again and they can re-send later.
friendRoutes.post('/requests/:requestId/decline', async (c) => {
  const me = c.get('userId');
  const row = await db.friendship.findUnique({ where: { id: c.req.param('requestId') } });
  if (!row || row.status !== 'PENDING') return c.json({ error: 'Request not found' }, 404);
  if (row.toId !== me) return c.json({ error: "This request isn't for you" }, 403);
  await db.friendship.update({ where: { id: row.id }, data: { status: 'DECLINED' } });
  return c.json({ state: 'none' });
});

// Cancel my own outgoing request (delete the row entirely).
friendRoutes.delete('/requests/:requestId', async (c) => {
  const me = c.get('userId');
  const row = await db.friendship.findUnique({ where: { id: c.req.param('requestId') } });
  if (!row || row.status !== 'PENDING') return c.json({ error: 'Request not found' }, 404);
  if (row.fromId !== me) return c.json({ error: "This request isn't yours" }, 403);
  await db.friendship.delete({ where: { id: row.id } });
  return c.json({ state: 'none' });
});

// Unfriend — removes the accepted friendship in either direction.
friendRoutes.delete('/:userId', async (c) => {
  const me = c.get('userId');
  const other = c.req.param('userId');
  const row = await findPairRow(db, me, other);
  if (!row || row.status !== 'ACCEPTED') return c.json({ error: "You're not friends" }, 404);
  await db.friendship.delete({ where: { id: row.id } });
  return c.json({ state: 'none' });
});
