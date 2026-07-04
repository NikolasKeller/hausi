import type {
  CommentEntry,
  CoverTheme,
  Effect,
  EventDetail,
  EventSummary,
  PublicUser,
  RsvpCounts,
  RsvpEntry,
  RsvpStatus,
  TitleFont,
} from '../../../app/shared/types.js';

type UserRow = { id: string; name: string; avatarEmoji: string };
type RsvpRow = { status: string; plusOnes: number; userId: string; user: UserRow };
type CommentRow = { id: string; text: string; type: string; createdAt: Date; user: UserRow };
type CohostRow = { userId: string; user: UserRow };
type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverTheme: string;
  titleFont: string;
  effect: string;
  date: Date;
  location: string;
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
    titleFont: event.titleFont as TitleFont,
    effect: event.effect as Effect,
    date: event.date.toISOString(),
    location: event.location,
    host: toPublicUser(event.host),
    isHost: event.hostId === viewerId,
    canManage: canManageEvent(event, viewerId),
    canceledAt: event.canceledAt ? event.canceledAt.toISOString() : null,
    myRsvp: (mine?.status as RsvpStatus | undefined) ?? null,
    counts: countRsvps(event.rsvps),
  };
}

export function toEventDetail(
  event: EventRow & { comments: CommentRow[] },
  viewerId: string
): EventDetail {
  return {
    ...toEventSummary(event, viewerId),
    description: event.description,
    maxGuests: event.maxGuests,
    plusOneLimit: event.plusOneLimit,
    rsvpsOpen: event.rsvpsOpen,
    cohosts: event.cohosts.map((c) => toPublicUser(c.user)),
    rsvps: event.rsvps.map(
      (r): RsvpEntry => ({
        user: toPublicUser(r.user),
        status: r.status as RsvpStatus,
        plusOnes: r.plusOnes,
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
