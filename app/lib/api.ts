import type {
  AuthResponse,
  CardEntry,
  CardTheme,
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
import { supabase } from './supabase';

// Kept so the class-based error contract screens rely on (e instanceof ApiError,
// e.status, e.message) is unchanged. status is best-effort: RPC/business errors
// come back without an HTTP status, so we use 400 for those and 401 for the
// "not signed in" case.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// ---------------------------------------------------------------------------
// Back-compat shims. The previous fetch-based client exposed these so the auth
// provider could push the JWT into every request and react to 401s. supabase-js
// now owns the session + token refresh, so these are no-ops kept only so any
// lingering importer keeps compiling. (Grep: only lib/auth.tsx imported them,
// and it no longer does.)
// ---------------------------------------------------------------------------
export function setAuthToken(_token: string | null) {}
export function setOnUnauthorized(_handler: (() => void) | null) {}

let pendingReadAll: Promise<void> | null = null;

// SQLSTATEs (error.code) that mean "not signed in" -> map to 401. Everything
// else from an RPC is a business/validation error -> 400. Classifying on the
// errcode (not message text) avoids mislabeling a legitimate business error
// whose copy happens to contain 'auth' (e.g. "not authorized to edit...").
//   28000 — invalid_authorization_specification: raised by _require_uid.
//   28P01 — invalid_password.
//   42501 — insufficient_privilege: an RLS/grant failure on a protected RPC,
//           which for this app also means the caller isn't the expected role.
const AUTH_SQLSTATES = new Set(['28000', '28P01', '42501']);

// Map a supabase-js RPC result to the unwrapped data or an ApiError. Postgres
// RAISE EXCEPTION messages arrive as error.message and the SQLSTATE as
// error.code; RLS/grant failures surface the same way.
function unwrap<T>(res: { data: unknown; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    const message = res.error.message || 'Something went wrong';
    // A missing/expired session surfaces from the RPC guard with SQLSTATE 28000.
    const status = res.error.code && AUTH_SQLSTATES.has(res.error.code) ? 401 : 400;
    throw new ApiError(status, message);
  }
  return res.data as T;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  let res;
  try {
    res = await supabase.rpc(fn, args);
  } catch (e) {
    throw new ApiError(0, e instanceof Error ? e.message : 'Cannot reach Hausi. Check your connection.');
  }
  return unwrap<T>(res);
}

// Load the signed-in user's profile in the AuthResponse['user'] shape
// ({ id, name, avatarEmoji, email, phone }). Exported so auth.tsx can hydrate
// the session without duplicating the field mapping.
export async function loadSessionUser(): Promise<AuthResponse['user']> {
  // me() -> { id, name, phone, email, avatarEmoji, avatarUrl, city }
  const profile = await rpc<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    avatarEmoji: string;
  }>('me');
  return {
    id: profile.id,
    name: profile.name,
    avatarEmoji: profile.avatarEmoji,
    email: profile.email,
    phone: profile.phone,
  };
}

export const api = {
  config() {
    return rpc<{ inviteRequired: boolean }>('app_config');
  },

  // --- Auth (supabase-js, not RPCs) ---------------------------------------

  async requestPhoneCode(phone: string, _invite?: string): Promise<PhoneRequestResponse> {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw new ApiError(400, error.message);
    // Real SMS via Supabase Auth's SMS provider (e.g. Twilio) — no devCode is
    // ever returned now, so PhoneRequestResponse.devCode and the code.tsx
    // dev-code banner stay dead in every environment. Phone OTP requires an SMS
    // provider configured in Supabase Auth; local/dev tours without one must use
    // the demo login (hausi://dev-login) instead.
    return { sent: true };
  },

  async verifyPhoneCode(phone: string, code: string): Promise<PhoneVerifyResponse> {
    const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    if (error) throw new ApiError(400, error.message);
    const token = data.session?.access_token;
    if (!token) throw new ApiError(400, 'Verification failed');
    const user = await loadSessionUser();
    // First-timers have no profile name yet (the handle_new_user trigger seeds
    // an empty name); the app routes them to /setup.
    const isNew = user.name.trim() === '';
    return { token, user, isNew };
  },

  async login(data: { email: string; password: string }): Promise<AuthResponse> {
    const { data: res, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) throw new ApiError(400, error.message);
    const token = res.session?.access_token;
    if (!token) throw new ApiError(400, 'Login failed');
    const user = await loadSessionUser();
    return { token, user };
  },

  // --- Events --------------------------------------------------------------

  async myEvents() {
    const events = await rpc<EventSummary[]>('feed_events');
    return { events };
  },
  async createEvent(data: EventInput) {
    const event = await rpc<EventDetail>('create_event', { p: data });
    return { event };
  },
  async eventBySlug(slug: string) {
    const event = await rpc<EventDetail>('event_by_slug', { p_slug: slug });
    return { event };
  },
  async updateEvent(id: string, data: Partial<EventInput>) {
    const event = await rpc<EventDetail>('update_event', { p_id: id, p: data });
    return { event };
  },
  deleteEvent(id: string) {
    return rpc<{ ok: boolean }>('delete_event', { p_id: id });
  },
  async cancelEvent(id: string) {
    const event = await rpc<EventDetail>('cancel_event', { p_id: id });
    return { event };
  },
  async addCohost(eventId: string, email: string) {
    const event = await rpc<EventDetail>('add_cohost', { p_event_id: eventId, p_email: email });
    return { event };
  },
  async removeCohost(eventId: string, userId: string) {
    const event = await rpc<EventDetail>('remove_cohost', { p_event_id: eventId, p_user_id: userId });
    return { event };
  },
  async rsvp(eventId: string, status: RsvpStatus, plusOnes = 0) {
    const event = await rpc<EventDetail>('set_rsvp', {
      p_event_id: eventId,
      p_status: status,
      p_plus_ones: plusOnes,
    });
    return { event };
  },
  async removeGuest(eventId: string, userId: string) {
    const event = await rpc<EventDetail>('remove_guest', { p_event_id: eventId, p_user_id: userId });
    return { event };
  },
  async addComment(eventId: string, text: string) {
    const comment = await rpc<CommentEntry>('add_comment', { p_event_id: eventId, p_text: text });
    return { comment };
  },

  // --- Discovery -----------------------------------------------------------

  home() {
    return rpc<HomeFeed>('discover_home');
  },
  explore(city?: string, category?: Category | 'all') {
    return rpc<{ events: ExploreEvent[]; cities: string[] }>('discover_explore', {
      p_city: city ?? null,
      p_category: category && category !== 'all' ? category : null,
    });
  },

  // --- Profile / cards / crush --------------------------------------------

  myProfile() {
    return rpc<{ profile: MyProfile }>('my_profile');
  },
  updateProfile(data: { name?: string; avatarEmoji?: string; city?: string }) {
    return rpc<{ user: AuthResponse['user'] & { city: string } }>('update_profile', { p: data });
  },
  sendCard(toUserId: string, theme: CardTheme, message: string) {
    return rpc<{ card: CardEntry }>('send_card', {
      p_to_id: toUserId,
      p_theme: theme,
      p_message: message,
    });
  },
  toggleCrush(userId: string) {
    return rpc<{ crushed: boolean; matched: boolean }>('toggle_crush', { p_to_id: userId });
  },

  // --- Notifications -------------------------------------------------------

  async notifications() {
    // Let an in-flight read-all settle first so the unread count isn't stale
    // when the user pops back to home right after viewing notifications.
    if (pendingReadAll) await pendingReadAll;
    return rpc<{ notifications: NotificationEntry[]; unread: number }>('list_notifications');
  },
  markNotificationsRead(before?: string) {
    const p = rpc<{ ok: boolean }>('mark_notifications_read', { p_before: before ?? null });
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
};
