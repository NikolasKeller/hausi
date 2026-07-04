import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AuthResponse } from '../shared/types';
import { supabase } from './supabase';
import { api, loadSessionUser } from './api';

type SessionUser = AuthResponse['user'];

interface AuthContextValue {
  user: SessionUser | null;
  initializing: boolean;
  // Phone OTP flow: request a code (via api.requestPhoneCode), then verify it
  // here. Returns isNew so the app can run profile setup for first-timers.
  verifyPhone: (phone: string, code: string) => Promise<{ isNew: boolean }>;
  // Dev shortcut past the SMS flow — signs in the demo account.
  devSignIn: () => Promise<void>;
  logout: () => Promise<void>;
  // Refresh the cached session user after a profile edit.
  updateUser: (user: SessionUser) => void;
}

// The seeded demo account (email/password) used for the dev shortcut and the
// hausi://dev-login deep link. Kept working so the app can be toured without SMS.
const DEMO_EMAIL = 'demo@hausi.app';
const DEMO_PASSWORD = 'hausidemo';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  // Guards a stale profile load from overwriting a newer session's user.
  const loadSeq = useRef(0);

  useEffect(() => {
    let mounted = true;

    // Hydrate the current user from a session. Deferred out of the
    // onAuthStateChange callback (supabase-js warns against awaiting other
    // supabase calls synchronously inside it — it can deadlock the client).
    async function hydrate(session: Session | null) {
      const seq = ++loadSeq.current;
      if (!session) {
        if (mounted) setUser(null);
        return;
      }
      try {
        const nextUser = await loadSessionUser();
        // Ignore if a newer session/sign-out landed while we were loading.
        if (mounted && seq === loadSeq.current) setUser(nextUser);
      } catch {
        // Profile fetch failed (e.g. transient) — treat as signed out so the
        // guard can recover rather than hanging on a half-session.
        if (mounted && seq === loadSeq.current) setUser(null);
      }
    }

    // Initial session load, then flip initializing off once resolved.
    (async () => {
      const { data } = await supabase.auth.getSession();
      await hydrate(data.session);
      if (mounted) setInitializing(false);
    })();

    // React to sign-in / sign-out / token refresh for the app's lifetime.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer so we never await inside the callback.
      setTimeout(() => {
        if (mounted) void hydrate(session);
      }, 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      verifyPhone: async (phone, code) => {
        // Sets the supabase session; onAuthStateChange will also hydrate, but we
        // set the user eagerly so the guard routes without an extra round-trip.
        const res = await api.verifyPhoneCode(phone, code);
        setUser(res.user);
        return { isNew: res.isNew };
      },
      devSignIn: async () => {
        const res = await api.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
        let sessionUser = res.user;
        // Seed a name for a brand-new demo profile so it doesn't get bounced to
        // /setup on every dev sign-in.
        if (!sessionUser.name.trim()) {
          const upd = await api.updateProfile({ name: 'Demo', avatarEmoji: '🎈' });
          sessionUser = { ...sessionUser, name: upd.user.name, avatarEmoji: upd.user.avatarEmoji };
        }
        setUser(sessionUser);
      },
      logout: async () => {
        setUser(null);
        await supabase.auth.signOut();
      },
      updateUser: (updated) => {
        setUser(updated);
      },
    }),
    [user, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
