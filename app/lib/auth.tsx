import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from './storage';
import type { AuthResponse } from '../shared/types';
import { api, setAuthToken, setOnUnauthorized } from './api';

const TOKEN_KEY = 'hausi.token';
const USER_KEY = 'hausi.user';

type SessionUser = AuthResponse['user'];

interface AuthContextValue {
  user: SessionUser | null;
  initializing: boolean;
  signup: (data: {
    name: string;
    email: string;
    password: string;
    avatarEmoji?: string;
  }) => Promise<void>;
  login: (data: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [token, storedUser] = await Promise.all([
          storage.getItemAsync(TOKEN_KEY),
          storage.getItemAsync(USER_KEY),
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
      storage.deleteItemAsync(TOKEN_KEY).catch(() => {});
      storage.deleteItemAsync(USER_KEY).catch(() => {});
    });
    return () => setOnUnauthorized(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    async function persist(res: AuthResponse) {
      setAuthToken(res.token);
      setUser(res.user);
      await Promise.all([
        storage.setItemAsync(TOKEN_KEY, res.token),
        storage.setItemAsync(USER_KEY, JSON.stringify(res.user)),
      ]);
    }
    return {
      user,
      initializing,
      signup: async (data) => persist(await api.signup(data)),
      login: async (data) => persist(await api.login(data)),
      logout: async () => {
        setAuthToken(null);
        setUser(null);
        await Promise.all([
          storage.deleteItemAsync(TOKEN_KEY),
          storage.deleteItemAsync(USER_KEY),
        ]);
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
