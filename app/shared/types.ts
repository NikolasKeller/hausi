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
  // A host "text blast" — an announcement posted to the event page and texted
  // to every guest. Roomier than a comment; still SMS-sized.
  blast: 1200,
  plusOnes: 20,
  maxGuests: 10000,
} as const;

export const COVER_THEMES = [
  // original six
  'sunset',
  'ocean',
  'candy',
  'midnight',
  'forest',
  'disco',
  // themes — full-page event backgrounds (light + dark moods, grouped by
  // category for the theme picker). Order roughly follows the picker grid.
  'cloud',
  'lava',
  'aurora',
  'noir',
  'cottoncandy',
  'peach',
  'lavender',
  'matcha',
  'gold',
  'berry',
  'storm',
  'blossom',
  'halloween',
] as const;

export type CoverTheme = (typeof COVER_THEMES)[number];

export const TITLE_FONTS = ['classic', 'literary', 'fancy', 'eclectic'] as const;

export type TitleFont = (typeof TITLE_FONTS)[number];

export const EFFECTS = [
  'none',
  // motion particle effects (original)
  'confetti',
  'sparkles',
  'balloons',
  // overlay pattern effects (scattered stickers layered over the theme)
  'hearts',
  'stars',
  'leaves',
  'petals',
  'snow',
  'bubbles',
  'fireworks',
  'autumn',
  'music',
  'butterflies',
  'spooky',
  'lightning',
] as const;

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

export interface PublicUser {
  id: string;
  name: string;
  avatarEmoji: string;
  // Server path to an uploaded profile photo ("/uploads/x.jpg"); '' when the
  // user sticks with their emoji.
  avatarImage: string;
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

// A named +1 an attendee brings. Linked to a Hausi user (picked from mutuals)
// or a standalone name+phone entry. avatarEmoji falls back to a ticket when
// there's no linked account.
export interface PlusOneGuest {
  id: string;
  name: string;
  avatarEmoji: string;
  avatarImage: string;
  userId: string | null;
}

export interface RsvpEntry {
  user: PublicUser;
  status: RsvpStatus;
  // Head count of plus-ones (== guests.length); kept for capacity display.
  plusOnes: number;
  guests: PlusOneGuest[];
}

export interface CommentEntry {
  id: string;
  user: PublicUser;
  text: string;
  // 'comment' — guest chatter on the Party Wall. 'system' — activity entries
  // ("X is going"). 'blast' — a host announcement (also texted to guests),
  // shown in its own Announcements section, not the wall.
  type: 'comment' | 'system' | 'blast';
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
  // A handful of attendee avatar emoji (mutuals first) for the interested-face
  // cluster on discovery cards. Up to 5; may be empty.
  interestedAvatars: string[];
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
  // title, date and location are all required to create an event — the form
  // blocks Save until each is filled, and location must be a real place picked
  // from the geocoder (never free text).
  title: string;
  description?: string;
  coverTheme?: CoverTheme;
  coverImage?: string;
  titleFont?: TitleFont;
  effect?: Effect;
  date: string;
  location: string;
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

export interface MyProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarEmoji: string;
  avatarImage: string;
  city: string;
  joinedAt: string;
  badges: Badge[];
  mutuals: Mutual[];
}

