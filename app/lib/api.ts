import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type {
  AuthResponse,
  AdminEventSubmission,
  Category,
  CommentEntry,
  DeliveryChannel,
  DirectEventInvite,
  EventDetail,
  EventInput,
  EventSummary,
  ExploreEvent,
  Friend,
  FriendRequest,
  FriendshipState,
  HomeFeed,
  MyProfile,
  PendingCohostInvite,
  PhoneRequestResponse,
  PhoneVerifyResponse,
  PublicProfile,
  PublicUser,
  UserSearchResult,
  RsvpStatus,
  TicketJobInfo,
  TicketProvider,
  WalletIdentity,
  WalletPass,
  WalletPayment,
} from '../shared/types';

// In dev, the machine running Metro is also running the API — derive its
// address from the dev-server URL so physical devices on the same network
// work without configuration. hostUri looks like "192.168.1.23:8081".
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];

// EXPO_PUBLIC_API_URL is the server ORIGIN (no /api suffix).
const API_ORIGIN =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'web'
    ? __DEV__
      ? // Dev web runs on Metro's port; the API is a separate origin.
        'http://localhost:3001'
      : // The exported web app is served by the API server itself.
        ''
    : devHost && devHost !== 'localhost' && devHost !== '127.0.0.1'
      ? `http://${devHost}:3001`
      : Platform.select({
          // Android emulators reach the host machine via 10.0.2.2.
          android: 'http://10.0.2.2:3001',
          default: 'http://localhost:3001',
        }));

export const API_URL = `${API_ORIGIN}/api`;

// Uploaded images come back as server-relative paths ("/uploads/x.jpg");
// resolve them against the API origin so <Image> can load them.
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path) || path.startsWith('data:')) return path;
  return `${API_ORIGIN}${path}`;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

// Called when an authenticated request comes back 401 (expired/stale token),
// so the auth provider can clear the session and the guard redirects to login.
export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  const sentWithToken = authToken != null;
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, 'Cannot reach the iykyk server. Is it running?');
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && sentWithToken) onUnauthorized?.();
    throw new ApiError(res.status, (body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  config() {
    return request<{ inviteRequired: boolean }>('/config');
  },
  uploadImage(data: string, contentType: string) {
    return request<{ url: string }>('/uploads', {
      method: 'POST',
      body: JSON.stringify({ data, contentType }),
    });
  },
  // `contact` is a phone number for sms/whatsapp and an email address for the
  // email channel; the server picks the right field based on the channel.
  requestPhoneCode(
    contact: string,
    opts: { invite?: string; channel?: DeliveryChannel } = {}
  ) {
    const isEmail = opts.channel === 'email';
    const payload: {
      phone?: string;
      email?: string;
      invite?: string;
      channel?: DeliveryChannel;
    } = isEmail ? { email: contact } : { phone: contact };
    if (opts.invite) payload.invite = opts.invite;
    // Only send a channel when opting out of the SMS default, keeping the
    // payload identical to the old behavior for plain SMS requests.
    if (opts.channel && opts.channel !== 'sms') payload.channel = opts.channel;
    return request<PhoneRequestResponse>('/auth/phone/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  verifyPhoneCode(contact: string, code: string, channel: DeliveryChannel = 'sms') {
    const payload: { phone?: string; email?: string; code: string; channel?: DeliveryChannel } =
      channel === 'email' ? { email: contact, code } : { phone: contact, code };
    if (channel !== 'sms') payload.channel = channel;
    return request<PhoneVerifyResponse>('/auth/phone/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  // Restore a session from the durable server cookie (web) when local storage
  // was cleared — the cookie rides along automatically on same-origin requests.
  sessionFromCookie() {
    return request<{ token: string; user: AuthResponse['user'] }>('/auth/session');
  },
  serverLogout() {
    return request<{ ok: boolean }>('/auth/logout', { method: 'POST' });
  },
  login(data: { email: string; password: string }) {
    return request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) });
  },
  // Localhost-only: sign in past the SMS flow. The server 404s this anywhere
  // but the developer's own machine, so it's safe that this exists in the app.
  devLogin(opts: { phone?: string; name?: string } = {}) {
    return request<PhoneVerifyResponse>('/auth/dev/login', {
      method: 'POST',
      body: JSON.stringify(opts),
    });
  },
  myEvents() {
    return request<{ events: EventSummary[] }>('/events');
  },
  createEvent(data: EventInput) {
    return request<{ event: EventDetail }>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  eventBySlug(slug: string) {
    return request<{ event: EventDetail }>(`/events/by-slug/${encodeURIComponent(slug)}`);
  },
  // Returns the subset of the given slugs whose event still exists, so the
  // client can prune deleted events from its local "recently viewed" cache.
  existingEvents(slugs: string[]) {
    return request<{ slugs: string[] }>('/events/exists', {
      method: 'POST',
      body: JSON.stringify({ slugs }),
    });
  },
  updateEvent(id: string, data: Partial<EventInput>) {
    return request<{ event: EventDetail }>(`/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteEvent(id: string) {
    return request<{ ok: boolean }>(`/events/${id}`, { method: 'DELETE' });
  },
  cancelEvent(id: string) {
    return request<{ event: EventDetail }>(`/events/${id}/cancel`, { method: 'POST' });
  },
  // Invite a co-host by phone number. The server creates a pending invite and
  // texts them an event link; `sent` is whether the SMS went out, `devLink` is
  // the invite URL surfaced when no SMS provider is configured (local dev).
  addCohost(eventId: string, phone: string) {
    return request<{ event: EventDetail; sent: boolean; devLink?: string }>(
      `/events/${eventId}/cohosts`,
      { method: 'POST', body: JSON.stringify({ phone }) }
    );
  },
  removeCohost(eventId: string, userId: string) {
    return request<{ event: EventDetail }>(
      `/events/${eventId}/cohosts/${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
  },
  // Pending co-host invitations addressed to me (matched on my phone number).
  myCohostInvites() {
    return request<{ invites: PendingCohostInvite[] }>('/me/cohost-invites');
  },
  myEventInvites() {
    return request<{ invites: DirectEventInvite[] }>('/me/event-invites');
  },
  dismissEventInvite(inviteId: string) {
    return request<{ ok: boolean }>(
      `/me/event-invites/${encodeURIComponent(inviteId)}`,
      { method: 'DELETE' }
    );
  },
  // Accept a co-host invite → I become a co-host (returns the refreshed event).
  acceptCohostInvite(inviteId: string) {
    return request<{ event: EventDetail }>(
      `/me/cohost-invites/${encodeURIComponent(inviteId)}/accept`,
      { method: 'POST' }
    );
  },
  declineCohostInvite(inviteId: string) {
    return request<{ ok: boolean }>(
      `/me/cohost-invites/${encodeURIComponent(inviteId)}/decline`,
      { method: 'POST' }
    );
  },
  home() {
    return request<HomeFeed>('/discover/home');
  },
  explore(city?: string, category?: Category | 'all') {
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (category && category !== 'all') params.set('category', category);
    const qs = params.toString();
    return request<{ events: ExploreEvent[]; cities: string[] }>(
      `/discover/explore${qs ? `?${qs}` : ''}`
    );
  },
  myProfile() {
    return request<{ profile: MyProfile }>('/me');
  },
  updateProfile(data: {
    name?: string;
    username?: string;
    avatarEmoji?: string;
    avatarImage?: string;
    bio?: string;
    city?: string;
  }) {
    return request<{ user: AuthResponse['user'] & { bio: string; city: string } }>('/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  // Another user's profile page (public-safe fields + friendship context).
  userProfile(userId: string) {
    return request<{ profile: PublicProfile }>(`/users/${encodeURIComponent(userId)}`);
  },
  searchUsers(query: string) {
    return request<{ users: UserSearchResult[] }>(
      `/users/search?q=${encodeURIComponent(query)}`
    );
  },
  // Friends + pending requests in one round trip.
  myFriends() {
    return request<{ friends: Friend[]; incoming: FriendRequest[]; outgoing: FriendRequest[] }>(
      '/friends'
    );
  },
  // Send a friend request. If they already asked me, the server auto-accepts
  // and returns state 'friends'.
  sendFriendRequest(userId: string) {
    return request<{ state: FriendshipState }>(
      `/friends/requests/${encodeURIComponent(userId)}`,
      { method: 'POST' }
    );
  },
  acceptFriendRequest(requestId: string) {
    return request<{ state: FriendshipState }>(
      `/friends/requests/${encodeURIComponent(requestId)}/accept`,
      { method: 'POST' }
    );
  },
  declineFriendRequest(requestId: string) {
    return request<{ state: FriendshipState }>(
      `/friends/requests/${encodeURIComponent(requestId)}/decline`,
      { method: 'POST' }
    );
  },
  cancelFriendRequest(requestId: string) {
    return request<{ state: FriendshipState }>(
      `/friends/requests/${encodeURIComponent(requestId)}`,
      { method: 'DELETE' }
    );
  },
  unfriend(userId: string) {
    return request<{ state: FriendshipState }>(`/friends/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  },
  toggleCrush(userId: string) {
    return request<{ crushed: boolean; matched: boolean }>(
      `/me/crush/${encodeURIComponent(userId)}`,
      { method: 'POST' }
    );
  },
  rsvp(eventId: string, status: RsvpStatus) {
    return request<{ event: EventDetail }>(`/events/${eventId}/rsvp`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },
  addPlusOne(eventId: string, guest: { userId: string } | { name: string; phone: string }) {
    return request<{ event: EventDetail }>(`/events/${eventId}/plus-one`, {
      method: 'POST',
      body: JSON.stringify(guest),
    });
  },
  removePlusOne(eventId: string, plusOneId: string) {
    return request<{ event: EventDetail }>(
      `/events/${eventId}/plus-one/${encodeURIComponent(plusOneId)}`,
      { method: 'DELETE' }
    );
  },
  removeGuest(eventId: string, userId: string) {
    return request<{ event: EventDetail }>(
      `/events/${eventId}/rsvp/${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
  },
  addComment(eventId: string, text: string) {
    return request<{ comment: CommentEntry }>(`/events/${eventId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },
  // Host text blast: posts the announcement to the event page and texts every
  // guest server-side. `notified` is how many guests it went out to.
  sendBlast(eventId: string, text: string) {
    return request<{ event: EventDetail; notified: number; sent: number }>(
      `/events/${eventId}/blast`,
      { method: 'POST', body: JSON.stringify({ text }) }
    );
  },
  invitePeople(eventId: string, userIds: string[]) {
    return request<{ invited: PublicUser[] }>(`/events/${eventId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    });
  },
  // Step 1+2 of the agentic purchase: submit the buyer identity and kick off
  // the server-side availability check. The returned job starts in 'checking'
  // and moves to 'available' or 'soldout' (poll with ticketJob). No payment
  // data is sent here.
  checkTicketAvailability(
    eventId: string,
    identity: WalletIdentity,
    provider: TicketProvider = 'demo'
  ) {
    return request<{ job: TicketJobInfo }>('/tickets/check', {
      method: 'POST',
      body: JSON.stringify({ eventId, provider, identity }),
    });
  },
  // Step 3+4: confirm payment on an 'available' job; the agent completes the
  // checkout and only then flips the job to 'done' with the ticket PDF. Card
  // data rides along per request and is never stored server-side.
  purchaseTicket(jobId: string, identity: WalletIdentity, payment: WalletPayment) {
    return request<{ job: TicketJobInfo }>(`/tickets/${encodeURIComponent(jobId)}/purchase`, {
      method: 'POST',
      body: JSON.stringify({ identity, payment }),
    });
  },
  ticketJob(id: string) {
    return request<{ job: TicketJobInfo }>(`/tickets/${encodeURIComponent(id)}`);
  },
  myTickets() {
    return request<{ jobs: TicketJobInfo[] }>('/tickets');
  },
  // The in-app Wallet: one pass (with entry QR) per upcoming event the user
  // hosts or is going to. QRs come pre-rendered as data URLs.
  myWallet() {
    return request<{ passes: WalletPass[] }>('/wallet');
  },
  adminEventSubmissions(status: 'PENDING' | 'REJECTED' = 'PENDING') {
    return request<{ events: AdminEventSubmission[] }>(
      `/admin/events?status=${encodeURIComponent(status)}`
    );
  },
  approveEvent(eventId: string) {
    return request<{ event: AdminEventSubmission }>(
      `/admin/events/${encodeURIComponent(eventId)}/approve`,
      { method: 'POST' }
    );
  },
  rejectEvent(eventId: string) {
    return request<{ event: AdminEventSubmission }>(
      `/admin/events/${encodeURIComponent(eventId)}/reject`,
      { method: 'POST' }
    );
  },
};
