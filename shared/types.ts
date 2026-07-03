// Shared API types between server/ and app/.

export type RsvpStatus = 'GOING' | 'MAYBE' | 'CANT';

export const RSVP_STATUSES: RsvpStatus[] = ['GOING', 'MAYBE', 'CANT'];

export const COVER_THEMES = [
  'sunset',
  'ocean',
  'candy',
  'midnight',
  'forest',
  'disco',
] as const;

export type CoverTheme = (typeof COVER_THEMES)[number];

export interface PublicUser {
  id: string;
  name: string;
  avatarEmoji: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser & { email: string };
}

export interface RsvpEntry {
  user: PublicUser;
  status: RsvpStatus;
  plusOnes: number;
}

export interface CommentEntry {
  id: string;
  user: PublicUser;
  text: string;
  createdAt: string;
}

export interface RsvpCounts {
  going: number;
  maybe: number;
  cant: number;
}

export interface EventSummary {
  id: string;
  slug: string;
  title: string;
  coverTheme: CoverTheme;
  date: string;
  location: string;
  host: PublicUser;
  isHost: boolean;
  myRsvp: RsvpStatus | null;
  counts: RsvpCounts;
}

export interface EventDetail extends EventSummary {
  description: string;
  maxGuests: number | null;
  rsvps: RsvpEntry[];
  comments: CommentEntry[];
}

export interface EventInput {
  title: string;
  description?: string;
  coverTheme?: CoverTheme;
  date: string;
  location?: string;
  maxGuests?: number | null;
}
