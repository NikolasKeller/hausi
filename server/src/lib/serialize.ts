import type {
  Category,
  CohostInvite,
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
import { normalizePhone } from './phone.js';

type UserRow = { id: string; name: string; avatarEmoji: string; avatarImage: string };
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
type CohostInviteRow = {
  id: string;
  phone: string;
  status: string;
  createdAt: Date;
  invitedBy: UserRow;
};
type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  descriptionScale: number;
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
  // Present only on detail queries that include the relation; summary/explore
  // reads skip it.
  cohostInvites?: CohostInviteRow[];
};

export function toPublicUser(u: UserRow): PublicUser {
  return { id: u.id, name: u.name, avatarEmoji: u.avatarEmoji, avatarImage: u.avatarImage };
}

// Narrow the free-form Comment.type string to the client union. Unknown values
// fall back to a plain comment.
export function commentType(t: string): CommentEntry['type'] {
  return t === 'system' || t === 'blast' ? t : 'comment';
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
  // The host auto-RSVPs GOING to their own event, so counting them would make
  // every fresh event read "1 interested". The discovery "interested" tally is
  // guests only — exclude the host.
  const guestCounts = countRsvps(event.rsvps.filter((r) => r.userId !== event.hostId));
  const friend = friendIds
    ? event.rsvps.find(
        (r) => r.status === 'GOING' && r.userId !== viewerId && friendIds.has(r.userId)
      )
    : undefined;
  // A few faces for the interested cluster: mutuals first, then anyone else
  // who's GOING/MAYBE, skipping the viewer and host and de-duping by user.
  const interestedRsvps = event.rsvps.filter(
    (r) =>
      (r.status === 'GOING' || r.status === 'MAYBE') &&
      r.userId !== viewerId &&
      r.userId !== event.hostId
  );
  interestedRsvps.sort((a, b) => {
    const aFriend = friendIds?.has(a.userId) ? 0 : 1;
    const bFriend = friendIds?.has(b.userId) ? 0 : 1;
    if (aFriend !== bFriend) return aFriend - bFriend;
    // GOING ahead of MAYBE within each group.
    return (a.status === 'GOING' ? 0 : 1) - (b.status === 'GOING' ? 0 : 1);
  });
  const interestedAvatars: { name: string; avatarImage: string }[] = [];
  const seen = new Set<string>();
  for (const r of interestedRsvps) {
    if (seen.has(r.userId)) continue;
    seen.add(r.userId);
    interestedAvatars.push({ name: r.user.name, avatarImage: r.user.avatarImage });
    if (interestedAvatars.length >= 5) break;
  }
  return {
    ...toEventSummary(event, viewerId),
    description: event.description,
    interested: guestCounts.going + guestCounts.maybe,
    friendGoing: friend ? toPublicUser(friend.user) : null,
    interestedAvatars,
  };
}

export function toEventDetail(
  event: EventRow & { comments: CommentRow[] },
  viewerId: string,
  // The viewer's own phone (E.164), when known — lets us surface a pending
  // co-host invite addressed to them so the event page can offer Accept/Decline.
  viewerPhone?: string | null
): EventDetail {
  const isManager = canManageEvent(event, viewerId);
  const pendingInvites = (event.cohostInvites ?? []).filter((i) => i.status === 'PENDING');

  // Co-host invites carry private phone numbers, so only hosts/co-hosts see the
  // full pending list.
  const cohostInvites: CohostInvite[] = isManager
    ? pendingInvites.map((i) => ({
        id: i.id,
        phone: i.phone,
        status: 'PENDING',
        createdAt: i.createdAt.toISOString(),
      }))
    : [];

  // The viewer's own pending invite (matched on canonicalized phone), if any.
  const normalizedViewer = viewerPhone ? normalizePhone(viewerPhone) : null;
  const mine = normalizedViewer
    ? pendingInvites.find((i) => normalizePhone(i.phone) === normalizedViewer)
    : undefined;
  const myCohostInvite = mine
    ? { id: mine.id, invitedBy: toPublicUser(mine.invitedBy) }
    : null;

  return {
    ...toEventSummary(event, viewerId),
    description: event.description,
    descriptionScale: event.descriptionScale,
    costPerPerson: event.costPerPerson,
    dressCode: event.dressCode,
    maxGuests: event.maxGuests,
    plusOneLimit: event.plusOneLimit,
    rsvpsOpen: event.rsvpsOpen,
    cohosts: event.cohosts.map((c) => toPublicUser(c.user)),
    cohostInvites,
    myCohostInvite,
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
            avatarImage: g.user?.avatarImage ?? '',
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
        type: commentType(co.type),
        createdAt: co.createdAt.toISOString(),
      })
    ),
  };
}
