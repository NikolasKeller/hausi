import { Platform } from 'react-native';
import type {
  AuthResponse,
  CommentEntry,
  EventDetail,
  EventInput,
  EventSummary,
  NotificationEntry,
  RsvpStatus,
} from '../shared/types';

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Platform.select({
    // Android emulators reach the host machine via 10.0.2.2.
    android: 'http://10.0.2.2:3001',
    default: 'http://localhost:3001',
  });

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
  signup(data: { name: string; email: string; password: string; avatarEmoji?: string }) {
    return request<AuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify(data) });
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
  notifications() {
    return request<{ notifications: NotificationEntry[]; unread: number }>('/notifications');
  },
  markNotificationsRead() {
    return request<{ ok: boolean }>('/notifications/read-all', { method: 'POST' });
  },
  rsvp(eventId: string, status: RsvpStatus, plusOnes = 0) {
    return request<{ event: EventDetail }>(`/events/${eventId}/rsvp`, {
      method: 'PUT',
      body: JSON.stringify({ status, plusOnes }),
    });
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
