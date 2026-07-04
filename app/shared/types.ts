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

export const CATEGORIES = [
  'music',
  'community',
  'arts',
  'food',
  'sports',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_META: Record<Category, { label: string; emoji: string }> = {
  music: { label: 'Music', emoji: '🪩' },
  community: { label: 'Community', emoji: '👥' },
  arts: { label: 'Arts', emoji: '🎨' },
  food: { label: 'Food', emoji: '🍜' },
  sports: { label: 'Sports', emoji: '🏀' },
  other: { label: 'Other', emoji: '✨' },
};

export const CARD_THEMES = ['confetti', 'birthday', 'thanks', 'miss-you', 'congrats'] as const;

export type CardTheme = (typeof CARD_THEMES)[number];

export interface PublicUser {
  id: string;
  name: string;
  avatarEmoji: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser & { email: string | null; phone: string | null };
}

export interface PhoneRequestResponse {
  sent: boolean;
  // Present only while no SMS provider is configured (local dev):
  // the app shows it as a simulated text message.
  devCode?: string;
}

export interface PhoneVerifyResponse extends AuthResponse {
  isNew: boolean;
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
  coverImage: string;
  titleFont: TitleFont;
  effect: Effect;
  date: string;
  location: string;
  city: string;
  category: Category;
  isPublic: boolean;
  host: PublicUser;
  isHost: boolean;
  canManage: boolean;
  canceledAt: string | null;
  myRsvp: RsvpStatus | null;
  counts: RsvpCounts;
}

// A public event as shown on Explore/Home discovery surfaces.
export interface ExploreEvent extends EventSummary {
  description: string;
  interested: number;
  friendGoing: PublicUser | null;
}

export interface EventDetail extends EventSummary {
  description: string;
  costPerPerson: string;
  dressCode: string;
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
  coverImage?: string;
  titleFont?: TitleFont;
  effect?: Effect;
  date: string;
  location?: string;
  city?: string;
  category?: Category;
  isPublic?: boolean;
  costPerPerson?: string;
  dressCode?: string;
  maxGuests?: number | null;
  plusOneLimit?: number;
  rsvpsOpen?: boolean;
}

export interface HomeFeed {
  city: string;
  trendingNearby: ExploreEvent[];
  palsGoing: ExploreEvent[];
  trendingNow: ExploreEvent[];
}

export interface Mutual {
  user: PublicUser;
  sharedEventTitle: string;
  sharedEventSlug: string;
  crushed: boolean;
}

export interface Badge {
  key: string;
  label: string;
  emoji: string;
  value: number;
}

export interface CardEntry {
  id: string;
  from: PublicUser;
  to: PublicUser;
  theme: CardTheme;
  message: string;
  createdAt: string;
}

export interface MyProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarEmoji: string;
  city: string;
  joinedAt: string;
  badges: Badge[];
  mutuals: Mutual[];
  cards: CardEntry[];
}

export interface NotificationEntry {
  id: string;
  type: string;
  text: string;
  eventSlug: string | null;
  read: boolean;
  createdAt: string;
}
