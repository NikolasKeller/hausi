// Shared API types between server/ and app/.

export type RsvpStatus = 'GOING' | 'MAYBE' | 'CANT' | 'WAITLIST';

// Statuses a guest can pick themselves — WAITLIST is assigned by the server
// when a GOING request hits a full event.
export const RSVP_CHOICES = ['GOING', 'MAYBE', 'CANT'] as const;

// Validation limits shared by the server (zod) and the app (input caps).
export const LIMITS = {
  name: 80,
  username: 24,
  // Short "about me" text on the profile.
  bio: 200,
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

// Hard ceiling on how many plus-ones a single attendee can bring, regardless of
// an event's per-event `plusOneLimit`. The effective allowance is
// min(plusOneLimit, MAX_PLUS_ONES). Shared by the server (enforcement) and the
// app (hides the add button once reached).
export const MAX_PLUS_ONES = 10;

// The description's body font-size scale, as a percent of the base size (100 =
// default). Clamped both client-side (the A−/A+ stepper) and server-side (zod).
export const DESCRIPTION_SCALE = { min: 70, max: 160, step: 15, default: 100 } as const;

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
  username: string;
  avatarEmoji: string;
  // Server path to an uploaded profile photo ("/uploads/x.jpg"); '' when the
  // user sticks with their emoji.
  avatarImage: string;
}

export interface UserSearchResult extends PublicUser {
  city: string;
  friendState: FriendshipState;
}

export interface AuthResponse {
  token: string;
  user: PublicUser & { email: string | null; phone: string | null };
}

// How the verification code is delivered. 'sms' is the default; 'whatsapp'
// needs a WhatsApp-enabled Twilio sender; 'email' goes through Twilio Verify's
// email channel (SendGrid integration) and targets an email address instead of
// a phone number.
export type DeliveryChannel = 'sms' | 'whatsapp' | 'email';

export interface PhoneRequestResponse {
  sent: boolean;
  // Present only while no SMS provider is configured (local dev):
  // the app shows it as a simulated text message.
  devCode?: string;
}

export interface PhoneVerifyResponse extends AuthResponse {
  isNew: boolean;
}

// A named +1 an attendee brings. Linked to an iykyk user (picked from mutuals)
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

export type CohostInviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

// A pending co-host invitation as shown to the host on the edit screen. The
// invited phone numbers are private, so these are only populated for people
// who can manage the event (host / co-hosts).
export interface CohostInvite {
  id: string;
  phone: string;
  status: CohostInviteStatus;
  createdAt: string;
}

// A pending co-host invite addressed to the current viewer — surfaced so they
// can accept or decline. `event` carries just enough to render a link/card.
export interface PendingCohostInvite {
  id: string;
  invitedBy: PublicUser;
  createdAt: string;
  event: {
    id: string;
    slug: string;
    title: string;
    coverTheme: CoverTheme;
    coverImage: string;
    titleFont: TitleFont;
    date: string;
    canceledAt: string | null;
  };
}

export interface DirectEventInvite {
  id: string;
  createdAt: string;
  invitedBy: PublicUser;
  event: {
    id: string;
    slug: string;
    title: string;
    coverTheme: CoverTheme;
    coverImage: string;
    date: string;
    city: string;
  };
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
  publicationStatus: 'PRIVATE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  hideLocation: boolean;
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
  // A handful of attendee faces (mutuals first) for the interested-face cluster
  // on discovery cards. Up to 5; may be empty. Each carries a name (for the
  // initials fallback) and an optional uploaded photo.
  interestedAvatars: { name: string; avatarImage: string }[];
}

export interface EventDetail extends EventSummary {
  description: string;
  descriptionScale: number;
  costPerPerson: string;
  // External ticket/checkout URL (organiser's real paid-ticket page) for
  // scraped events; '' for user-created events. The buy-ticket button opens it.
  ticketUrl: string;
  dressCode: string;
  maxGuests: number | null;
  plusOneLimit: number;
  rsvpsOpen: boolean;
  cohosts: PublicUser[];
  // Pending co-host invitations (host-visible only; empty for regular guests,
  // since the invited phone numbers are private).
  cohostInvites: CohostInvite[];
  // Set when the current viewer has a pending co-host invite for this event, so
  // the event page can show an Accept / Decline banner.
  myCohostInvite: { id: string; invitedBy: PublicUser } | null;
  rsvps: RsvpEntry[];
  comments: CommentEntry[];
}

export interface EventInput {
  // title, date and location are all required to create an event — the form
  // blocks Save until each is filled, and location must be a real place picked
  // from the geocoder (never free text).
  title: string;
  description?: string;
  descriptionScale?: number;
  coverTheme?: CoverTheme;
  coverImage?: string;
  titleFont?: TitleFont;
  effect?: Effect;
  date: string;
  location: string;
  city?: string;
  category?: Category;
  isPublic?: boolean;
  hideLocation?: boolean;
  costPerPerson?: string;
  dressCode?: string;
  maxGuests?: number | null;
  plusOneLimit?: number;
  rsvpsOpen?: boolean;
}

// ── AI-assisted event drafting ─────────────────────────────────────────────

export const EVENT_DRAFT_CHAT_LIMITS = {
  history: 12,
  message: 1500,
  totalMessageCharacters: 10000,
} as const;

export type EventDraftQuestion =
  | 'title'
  | 'description'
  | 'date'
  | 'location'
  | 'visibility'
  | 'capacity'
  | 'plusOnes'
  | 'price';

export interface EventDraftChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

export interface EventDraftChatDraft {
  title: string | null;
  // An empty string means the host explicitly chose no description; null means
  // the assistant still needs to ask.
  description: string | null;
  date: string | null;
  // AI may suggest what to search for, but only LocationPicker can commit a
  // geocoded address into selectedLocation.
  locationHint: string | null;
  selectedLocation: { location: string; city: string } | null;
  category: Category | null;
  isPublic: boolean | null;
  hideLocation: boolean | null;
  capacity:
    | { kind: 'unknown'; maxGuests: null }
    | { kind: 'unlimited'; maxGuests: null }
    | { kind: 'limited'; maxGuests: number };
  plusOneLimit: number | null;
  entry:
    | { kind: 'unknown'; price: null }
    | { kind: 'free'; price: null }
    | { kind: 'paid'; price: string | null };
}

export interface EventDraftChatRequest {
  messages: EventDraftChatMessage[];
  draft: EventDraftChatDraft;
  timeZone?: string;
  locale?: string;
}

export interface EventDraftChatResponse {
  draft: EventDraftChatDraft;
  assistantMessage: string;
  status: 'needs_input' | 'ready';
  nextField: EventDraftQuestion | null;
  missingFields: EventDraftQuestion[];
}

// ── Agent Wallet / agentic ticket purchase ──────────────────────────────────

// The "Agent Wallet" — the user's locally-stored purchase profile. Lives ONLY
// on the device (expo-secure-store / localStorage). Entered once, reused for
// every purchase. Split in two: the identity a checkout typically asks for,
// and the payment method. Both are sent to the server per request; card data
// is only ever held in memory for the running job and never persisted.
export interface WalletIdentity {
  name: string;
  email: string;
  address: string;
  // Free-form so it works across locales; validated as a real date client-side.
  dateOfBirth: string; // "YYYY-MM-DD"
}

export interface WalletPayment {
  cardNumber: string;
  cardExpiry: string; // MM/YY
  cardCvc: string;
}

export interface AgentWallet extends WalletIdentity, WalletPayment {}

// Real phases of an agentic purchase. The UI mirrors these 1:1 and NEVER shows
// "purchased" until the agent has a confirmed ticket (status 'done'):
//   checking    — the agent is verifying ticket availability on the site
//   available   — tickets are available; waiting for the user's payment step
//   soldout     — no tickets available (terminal for this attempt)
//   purchasing  — the agent is completing the checkout with the payment method
//   done        — purchase confirmed, ticket PDF (with QR) is ready
//   failed      — something went wrong (reason in `error`)
export type TicketJobStatus =
  | 'checking'
  | 'available'
  | 'soldout'
  | 'purchasing'
  | 'done'
  | 'failed';

// 'demo' → the server's own test checkout page (full flow incl. PDF).
// 'web'  → the event's real ticket URL (best-effort form detection; stops
//          before any real purchase — prototype safety).
export type TicketProvider = 'demo' | 'web';

export interface TicketJobInfo {
  id: string;
  eventId: string;
  status: TicketJobStatus;
  provider: TicketProvider;
  // "/uploads/tickets/x.pdf" once done — resolve via mediaUrl().
  pdfPath: string;
  cardLast4: string;
  // Availability / failure detail, safe to show (never contains card data).
  error: string;
  createdAt: string;
  // Enough event context to render a ticket row in the profile.
  event: { slug: string; title: string; date: string; location: string } | null;
}

// ── Wallet (in-app ticket passes) ────────────────────────────────────────────

// One pass in the user's Wallet — issued for every upcoming event they host or
// are GOING to (Apple-Wallet-style, but in-app: we can't import tickets bought
// on Eventbrite/RA, so the pass is the event's own entry credential). The QR
// encodes a public /checkin/<code> URL; the code is HMAC-signed server-side so
// door staff scanning it get a server-verified valid/invalid answer without
// any ticket rows in the database.
export interface WalletPass {
  eventId: string;
  slug: string;
  title: string;
  date: string;
  location: string;
  city: string;
  coverTheme: CoverTheme;
  coverImage: string;
  titleFont: TitleFont;
  hostName: string;
  costPerPerson: string;
  // host — hosting/co-hosting this event; guest — on the list (GOING/WAITLIST).
  role: 'host' | 'guest';
  // Signed pass code; also encoded in the QR as the /checkin URL.
  code: string;
  // Data-URL PNG of the entry QR, rendered server-side (no QR dep in the app).
  qrDataUrl: string;
  // The event's external ticket page ('' when none) — for re-opening the
  // organiser's page from the pass.
  ticketUrl: string;
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
  // Explicit friendship state with this mutual, so the profile's "people
  // you've partied with" list can offer the right action (add / requested /
  // accept / friends).
  friendState: FriendshipState;
}

// The viewer's friendship state with another user:
//   none     — no connection; can send a request
//   outgoing — the viewer sent a request that's still pending
//   incoming — the other person sent the viewer a pending request
//   friends  — accepted, mutual friendship
export type FriendshipState = 'none' | 'outgoing' | 'incoming' | 'friends';

// A pending friend request as shown in the profile's requests list. `user` is
// the other person (sender for incoming, recipient for outgoing).
export interface FriendRequest {
  id: string;
  user: PublicUser;
  createdAt: string;
}

export interface Friend {
  user: PublicUser;
  // When the friendship was accepted.
  since: string;
}

// Another user's profile page: public-safe fields plus the viewer-specific
// social context (friendship state, friends in common, shared party).
export interface PublicProfile {
  id: string;
  name: string;
  username: string;
  avatarEmoji: string;
  avatarImage: string;
  bio: string;
  city: string;
  joinedAt: string;
  isOrganization: boolean;
  badges: Badge[];
  friendsCount: number;
  // Friends the viewer and this user have in common.
  mutualFriends: PublicUser[];
  // The most recent event both attended ('' when none) — the "you met at" line.
  sharedEventTitle: string;
  friendState: FriendshipState;
  // The pending Friendship row id when friendState is 'incoming' (accept /
  // decline target) or 'outgoing' (cancel target); null otherwise.
  requestId: string | null;
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
  username: string;
  // False while the username is still the auto-generated fallback — the
  // profile uses this to surface a "pick your username" call-to-action.
  hasCustomUsername: boolean;
  email: string | null;
  phone: string | null;
  avatarEmoji: string;
  avatarImage: string;
  bio: string;
  city: string;
  joinedAt: string;
  isAdmin: boolean;
  badges: Badge[];
  mutuals: Mutual[];
  friends: Friend[];
  // Pending requests addressed to me (accept/decline) and ones I sent.
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
}

export interface AdminEventSubmission {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  location: string;
  city: string;
  coverImage: string;
  category: Category;
  costPerPerson: string;
  publicationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  host: PublicUser;
}

