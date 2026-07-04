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
      ],
    },
    include: { rsvps: true, cohosts: true },
    orderBy: { date: 'desc' },
  });

  const mutuals = new Map<string, { title: string; slug: string }>();
  for (const event of myEvents) {
    const participantIds = new Set<string>([
      event.hostId,
      ...event.cohosts.map((c) => c.userId),
      ...event.rsvps.filter((r) => r.status !== 'CANT').map((r) => r.userId),
    ]);
    for (const id of participantIds) {
      if (id !== userId && !mutuals.has(id)) {
        mutuals.set(id, { title: event.title, slug: event.slug });
      }
    }
  }
  return mutuals;
}
