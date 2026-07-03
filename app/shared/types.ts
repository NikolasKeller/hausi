// Shared API types between server/ and app/.

export type RsvpStatus = 'GOING' | 'MAYBE' | 'CANT';

export const RSVP_STATUSES: RsvpStatus[] = ['GOING', 'MAYBE', 'CANT'];

// Validation limits shared by the server (zod) and the app (input caps).
export const LIMITS = {
  name: 80,
  title: 120,
  location: 200,
  description: 4000,
  comment: 1000,
  plusOnes: 20,
  maxGuests: 10000,
} as const;

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
  type: 'comment' | 'system';
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
