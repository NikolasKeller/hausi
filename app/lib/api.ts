import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type {
  AuthResponse,
  Category,
  CommentEntry,
  EventDetail,
  EventInput,
  EventSummary,
  ExploreEvent,
  HomeFeed,
  MyProfile,
  NotificationEntry,
  PhoneRequestResponse,
  PhoneVerifyResponse,
  RsvpStatus,
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
let pendingReadAll: Promise<void> | null = null;

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
    throw new ApiError(0, 'Cannot reach the Hausi server. Is it running?');
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
  requestPhoneCode(phone: string, invite?: string) {
    return request<PhoneRequestResponse>('/auth/phone/request', {
      method: 'POST',
      body: JSON.stringify(invite ? { phone, invite } : { phone }),
    });
  },
  verifyPhoneCode(phone: string, code: string) {
    return request<PhoneVerifyResponse>('/auth/phone/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
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
  addCohost(eventId: string, email: string) {
    return request<{ event: EventDetail }>(`/events/${eventId}/cohosts`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  removeCohost(eventId: string, userId: string) {
    return request<{ event: EventDetail }>(
      `/events/${eventId}/cohosts/${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
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
  updateProfile(data: { name?: string; avatarEmoji?: string; city?: string }) {
    return request<{ user: AuthResponse['user'] & { city: string } }>('/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  toggleCrush(userId: string) {
    return request<{ crushed: boolean; matched: boolean }>(
      `/me/crush/${encodeURIComponent(userId)}`,
      { method: 'POST' }
    );
  },
  async notifications() {
    // Let an in-flight read-all settle first so the unread count isn't stale
    // when the user pops back to home right after viewing notifications.
    if (pendingReadAll) await pendingReadAll;
    return request<{ notifications: NotificationEntry[]; unread: number }>('/notifications');
  },
  markNotificationsRead(before?: string) {
    const p = request<{ ok: boolean }>('/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify(before ? { before } : {}),
    });
    pendingReadAll = p
      .then(
        () => undefined,
        () => undefined
      )
      .finally(() => {
        pendingReadAll = null;
      });
    return p;
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
};
