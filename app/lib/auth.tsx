import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { AuthResponse } from '../shared/types';
import { api, setAuthToken, setOnUnauthorized } from './api';

const TOKEN_KEY = 'hausi.token';
const USER_KEY = 'hausi.user';

type SessionUser = AuthResponse['user'];

interface AuthContextValue {
  user: SessionUser | null;
  initializing: boolean;
  // Phone OTP flow: request a code, then verify it. Returns isNew so the
  // app can run profile setup for first-timers.
  verifyPhone: (phone: string, code: string) => Promise<{ isNew: boolean }>;
  logout: () => Promise<void>;
  // Refresh the cached session user after a profile edit.
  updateUser: (user: SessionUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [token, storedUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (token && storedUser) {
          setAuthToken(token);
          setUser(JSON.parse(storedUser) as SessionUser);
        }
      } catch {
        // Corrupt session — start signed out.
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  useEffect(() => {
    // A 401 on an authenticated call means the stored token is dead — sign out.
    setOnUnauthorized(() => {
      setAuthToken(null);
      setUser(null);
      SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
    });
    return () => setOnUnauthorized(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    async function persist(res: AuthResponse) {
      setAuthToken(res.token);
      setUser(res.user);
      await Promise.all([
        SecureStore.setItemAsync(TOKEN_KEY, res.token),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(res.user)),
      ]);
    }
    return {
      user,
      initializing,
      verifyPhone: async (phone, code) => {
        const res = await api.verifyPhoneCode(phone, code);
        await persist(res);
        return { isNew: res.isNew };
      },
      logout: async () => {
        setAuthToken(null);
        setUser(null);
        await Promise.all([
          SecureStore.deleteItemAsync(TOKEN_KEY),
          SecureStore.deleteItemAsync(USER_KEY),
        ]);
      },
      updateUser: (updated) => {
        setUser(updated);
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(updated)).catch(() => {});
      },
    };
  }, [user, initializing]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
