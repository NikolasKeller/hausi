import type { Prisma } from '@prisma/client';
import type { FriendshipState } from '../../../app/shared/types.js';
import { db } from './db.js';

type Client = Prisma.TransactionClient | typeof db;

type FriendshipRow = { id: string; fromId: string; toId: string; status: string };

// All accepted friends of a user (either direction of the row).
export async function findFriendIds(client: Client, userId: string): Promise<Set<string>> {
  const rows = await client.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ fromId: userId }, { toId: userId }] },
    select: { fromId: true, toId: true },
  });
  return new Set(rows.map((r) => (r.fromId === userId ? r.toId : r.fromId)));
}

// The single Friendship row for a pair, whichever direction it was created in.
export async function findPairRow(
  client: Client,
  a: string,
  b: string
): Promise<FriendshipRow | null> {
  return client.friendship.findFirst({
    where: {
      OR: [
        { fromId: a, toId: b },
        { fromId: b, toId: a },
      ],
    },
  });
}

// Collapse a pair's Friendship row into the viewer's perspective. DECLINED
// reads as 'none' — the requester may simply try again later.
export function pairState(
  row: FriendshipRow | null,
  viewerId: string
): { state: FriendshipState; requestId: string | null } {
  if (!row || row.status === 'DECLINED') return { state: 'none', requestId: null };
  if (row.status === 'ACCEPTED') return { state: 'friends', requestId: null };
  // PENDING
  return row.fromId === viewerId
    ? { state: 'outgoing', requestId: row.id }
    : { state: 'incoming', requestId: row.id };
}

// Viewer-perspective states for a batch of users (one query for the whole
// mutuals list instead of one per person).
export async function pairStates(
  client: Client,
  viewerId: string,
  otherIds: string[]
): Promise<Map<string, { state: FriendshipState; requestId: string | null }>> {
  const result = new Map<string, { state: FriendshipState; requestId: string | null }>();
  if (!otherIds.length) return result;
  const rows = await client.friendship.findMany({
    where: {
      OR: [
        { fromId: viewerId, toId: { in: otherIds } },
        { toId: viewerId, fromId: { in: otherIds } },
      ],
    },
  });
  for (const row of rows) {
    const other = row.fromId === viewerId ? row.toId : row.fromId;
    result.set(other, pairState(row, viewerId));
  }
  return result;
}
