// Shared API types between server/ and app/.

export type RsvpStatus = 'GOING' | 'MAYBE' | 'CANT' | 'WAITLIST';

// Statuses a guest can pick themselves — WAITLIST is assigned by the server
// when a GOING request hits a full event.
export const RSVP_CHOICES = ['GOING', 'MAYBE', 'CANT'] as const;

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

export const TITLE_FONTS = ['classic', 'literary', 'fancy', 'eclectic'] as const;

export type TitleFont = (typeof TITLE_FONTS)[number];

export const EFFECTS = ['none', 'confetti', 'sparkles', 'balloons'] as const;

export type Effect = (typeof EFFECTS)[number];

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
  waitlist: number;
}

export interface EventSummary {
  id: string;
  slug: string;
  title: string;
  coverTheme: CoverTheme;
  titleFont: TitleFont;
  effect: Effect;
  date: string;
  location: string;
  host: PublicUser;
  isHost: boolean;
  canManage: boolean;
  canceledAt: string | null;
  myRsvp: RsvpStatus | null;
  counts: RsvpCounts;
}

export interface EventDetail extends EventSummary {
  description: string;
  maxGuests: number | null;
  plusOneLimit: number;
  rsvpsOpen: boolean;
  cohosts: PublicUser[];
  rsvps: RsvpEntry[];
  comments: CommentEntry[];
}

export interface EventInput {
  title: string;
  description?: string;
  coverTheme?: CoverTheme;
  titleFont?: TitleFont;
  effect?: Effect;
  date: string;
  location?: string;
  maxGuests?: number | null;
  plusOneLimit?: number;
  rsvpsOpen?: boolean;
}

export interface NotificationEntry {
  id: string;
  type: string;
  text: string;
  eventSlug: string | null;
  read: boolean;
  createdAt: string;
}
