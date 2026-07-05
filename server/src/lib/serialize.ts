import type {
  Category,
  CommentEntry,
  CoverTheme,
  Effect,
  EventDetail,
  EventSummary,
  ExploreEvent,
  PlusOneGuest,
  PublicUser,
  RsvpCounts,
  RsvpEntry,
  RsvpStatus,
  TitleFont,
} from '../../../app/shared/types.js';

type UserRow = { id: string; name: string; avatarEmoji: string };
type PlusOneRow = {
  id: string;
  name: string;
  userId: string | null;
  user: UserRow | null;
};
type RsvpRow = {
  status: string;
  plusOnes: number;
  userId: string;
  waitlistedAt: Date | null;
  user: UserRow;
  // Present only on detail queries (eventInclude); summary/explore skip it.
  plusOneGuests?: PlusOneRow[];
};
type CommentRow = { id: string; text: string; type: string; createdAt: Date; user: UserRow };
type CohostRow = { userId: string; user: UserRow };
type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverTheme: string;
  coverImage: string;
  titleFont: string;
  effect: string;
  date: Date;
  location: string;
  city: string;
  category: string;
  isPublic: boolean;
  costPerPerson: string;
  dressCode: string;
  maxGuests: number | null;
  plusOneLimit: number;
  rsvpsOpen: boolean;
  canceledAt: Date | null;
  hostId: string;
  host: UserRow;
  rsvps: RsvpRow[];
  cohosts: CohostRow[];
};

export function toPublicUser(u: UserRow): PublicUser {
  return { id: u.id, name: u.name, avatarEmoji: u.avatarEmoji };
}

export function countRsvps(rsvps: { status: string; plusOnes: number }[]): RsvpCounts {
  const counts: RsvpCounts = { going: 0, maybe: 0, cant: 0, waitlist: 0 };
  for (const r of rsvps) {
    if (r.status === 'GOING') counts.going += 1 + r.plusOnes;
    else if (r.status === 'MAYBE') counts.maybe += 1;
    else if (r.status === 'CANT') counts.cant += 1;
    else if (r.status === 'WAITLIST') counts.waitlist += 1;
  }
  return counts;
}

export function canManageEvent(
  event: { hostId: string; cohosts: { userId: string }[] },
  userId: string
): boolean {
  return event.hostId === userId || event.cohosts.some((c) => c.userId === userId);
}

export function toEventSummary(event: EventRow, viewerId: string): EventSummary {
  const mine = event.rsvps.find((r) => r.userId === viewerId);
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    coverTheme: event.coverTheme as CoverTheme,
    coverImage: event.coverImage,
    titleFont: event.titleFont as TitleFont,
    effect: event.effect as Effect,
    date: event.date.toISOString(),
    location: event.location,
    city: event.city,
    category: event.category as Category,
    isPublic: event.isPublic,
    host: toPublicUser(event.host),
    isHost: event.hostId === viewerId,
    canManage: canManageEvent(event, viewerId),
    canceledAt: event.canceledAt ? event.canceledAt.toISOString() : null,
    myRsvp: (mine?.status as RsvpStatus | undefined) ?? null,
    counts: countRsvps(event.rsvps),
  };
}

// Discovery-surface shape: adds interest count and a friend who's going.
export function toExploreEvent(
  event: EventRow & { description: string },
  viewerId: string,
  friendIds?: Set<string>
): ExploreEvent {
  const counts = countRsvps(event.rsvps);
  const friend = friendIds
    ? event.rsvps.find(
        (r) => r.status === 'GOING' && r.userId !== viewerId && friendIds.has(r.userId)
      )
    : undefined;
  return {
    ...toEventSummary(event, viewerId),
    description: event.description,
    interested: counts.going + counts.maybe,
    friendGoing: friend ? toPublicUser(friend.user) : null,
  };
}

export function toEventDetail(
  event: EventRow & { comments: CommentRow[] },
  viewerId: string
): EventDetail {
  return {
    ...toEventSummary(event, viewerId),
    description: event.description,
    costPerPerson: event.costPerPerson,
    dressCode: event.dressCode,
    maxGuests: event.maxGuests,
    plusOneLimit: event.plusOneLimit,
    rsvpsOpen: event.rsvpsOpen,
    cohosts: event.cohosts.map((c) => toPublicUser(c.user)),
    // Waitlist entries are ordered by when they joined the queue (the FIFO key);
    // everything else keeps the incoming createdAt order.
    rsvps: [
      ...event.rsvps.filter((r) => r.status !== 'WAITLIST'),
      ...event.rsvps
        .filter((r) => r.status === 'WAITLIST')
        .sort((a, b) => (a.waitlistedAt?.getTime() ?? 0) - (b.waitlistedAt?.getTime() ?? 0)),
    ].map(
      (r): RsvpEntry => ({
        user: toPublicUser(r.user),
        status: r.status as RsvpStatus,
        plusOnes: r.plusOnes,
        guests: (r.plusOneGuests ?? []).map(
          (g): PlusOneGuest => ({
            id: g.id,
            // Once the invitee claims the spot, their own profile wins over
            // whatever the inviter typed.
            name: g.user?.name.trim() ? g.user.name : g.name,
            avatarEmoji: g.user?.avatarEmoji ?? '🎟️',
            userId: g.userId,
          })
        ),
      })
    ),
    comments: event.comments.map(
      (co): CommentEntry => ({
        id: co.id,
        user: toPublicUser(co.user),
        text: co.text,
        type: co.type === 'system' ? 'system' : 'comment',
        createdAt: co.createdAt.toISOString(),
      })
    ),
  };
}
