import type { Prisma } from '@prisma/client';
import { db } from './db.js';

type Client = Prisma.TransactionClient | typeof db;

// "Mutuals" = everyone who shares an event with me (host, cohost or RSVP'd
// on an event where I'm host, cohost or RSVP'd). Returns userId → the most
// recent shared event's title/slug.
export async function findMutuals(
  client: Client,
  userId: string
): Promise<Map<string, { title: string; slug: string }>> {
  const myEvents = await client.event.findMany({
    where: {
      OR: [
        { hostId: userId },
        { cohosts: { some: { userId } } },
        { rsvps: { some: { userId } } },
        // Events I was brought to as someone's +1 count too.
        { rsvps: { some: { plusOneGuests: { some: { userId } } } } },
      ],
    },
    include: { rsvps: { include: { plusOneGuests: true } }, cohosts: true },
    orderBy: { date: 'desc' },
  });

  const mutuals = new Map<string, { title: string; slug: string }>();
  for (const event of myEvents) {
    const participantIds = new Set<string>([
      event.hostId,
      ...event.cohosts.map((c) => c.userId),
      // An attendee and their linked +1 both count — the +1 becomes a mutual of
      // the whole party, including the person who brought them.
      ...event.rsvps
        .filter((r) => r.status !== 'CANT')
        .flatMap((r) => [
          r.userId,
          ...r.plusOneGuests.map((g) => g.userId).filter((id): id is string => id !== null),
        ]),
    ]);
    for (const id of participantIds) {
      if (id !== userId && !mutuals.has(id)) {
        mutuals.set(id, { title: event.title, slug: event.slug });
      }
    }
  }

  // Fold in people from parties that were later deleted: their live RSVP rows
  // are gone, but the snapshot in PartyConnection keeps them as mutuals. Live
  // events always win (they carry a working slug), so these only fill the gaps.
  const remembered = await client.partyConnection.findMany({
    where: { userId },
    orderBy: { sharedAt: 'desc' },
    select: { otherUserId: true, eventTitle: true },
  });
  for (const conn of remembered) {
    if (!mutuals.has(conn.otherUserId)) {
      mutuals.set(conn.otherUserId, { title: conn.eventTitle, slug: '' });
    }
  }
  return mutuals;
}

// Snapshot every co-attendee pair from an event into PartyConnection so the
// mutuals they formed outlive the event's hard delete. Call this inside the
// same transaction, just before deleting the event (while its RSVPs still
// exist). Between two deleted parties, the more recent one wins the snapshot.
export async function rememberPartyConnections(
  client: Client,
  event: {
    title: string;
    date: Date;
    hostId: string;
    rsvps: { userId: string; status: string; plusOneGuests: { userId: string | null }[] }[];
    cohosts: { userId: string }[];
  }
): Promise<void> {
  const participants = [
    ...new Set<string>([
      event.hostId,
      ...event.cohosts.map((co) => co.userId),
      ...event.rsvps
        .filter((r) => r.status !== 'CANT')
        .flatMap((r) => [
          r.userId,
          ...r.plusOneGuests.map((g) => g.userId).filter((id): id is string => id !== null),
        ]),
    ]),
  ];
  if (participants.length < 2) return;

  const pairs: { userId: string; otherUserId: string }[] = [];
  for (const a of participants) {
    for (const b of participants) {
      if (a !== b) pairs.push({ userId: a, otherUserId: b });
    }
  }

  // Insert only the pairs that don't exist yet; existing ones are refreshed by
  // the updateMany below (so a newer party overwrites an older snapshot).
  const existing = await client.partyConnection.findMany({
    where: { userId: { in: participants }, otherUserId: { in: participants } },
    select: { userId: true, otherUserId: true },
  });
  const seen = new Set(existing.map((e) => `${e.userId}|${e.otherUserId}`));
  const toCreate = pairs.filter((p) => !seen.has(`${p.userId}|${p.otherUserId}`));

  if (toCreate.length) {
    await client.partyConnection.createMany({
      data: toCreate.map((p) => ({ ...p, eventTitle: event.title, sharedAt: event.date })),
    });
  }
  await client.partyConnection.updateMany({
    where: {
      userId: { in: participants },
      otherUserId: { in: participants },
      sharedAt: { lt: event.date },
    },
    data: { eventTitle: event.title, sharedAt: event.date },
  });
}
