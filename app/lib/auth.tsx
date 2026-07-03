import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { AuthResponse } from '../../shared/types';
import { api, setAuthToken } from './api';

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
      signup: async (data) => persist(await api.signup(data)),
      login: async (data) => persist(await api.login(data)),
      logout: async () => {
        setAuthToken(null);
        setUser(null);
        await Promise.all([
          SecureStore.deleteItemAsync(TOKEN_KEY),
          SecureStore.deleteItemAsync(USER_KEY),
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
