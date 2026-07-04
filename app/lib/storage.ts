import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// expo-secure-store has no web implementation — every call rejects. On web the
// session lives in localStorage instead (fine for a JWT-in-header app).
//
// Kept for backward compatibility (older code stored hausi.token/hausi.user
// under these helpers). The Supabase session is now owned by supabase-js via
// `supabaseAuthStorage` below.
export const storage =
  Platform.OS === 'web'
    ? {
        getItemAsync: async (key: string) => window.localStorage.getItem(key),
        setItemAsync: async (key: string, value: string) => {
          window.localStorage.setItem(key, value);
        },
        deleteItemAsync: async (key: string) => {
          window.localStorage.removeItem(key);
        },
      }
    : {
        getItemAsync: (key: string) => SecureStore.getItemAsync(key),
        setItemAsync: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        deleteItemAsync: (key: string) => SecureStore.deleteItemAsync(key),
      };

// supabase-js expects a { getItem, setItem, removeItem } storage whose methods
// return Promises. We back it with localStorage on web and AsyncStorage on
// native.
//
// IMPORTANT: do NOT use expo-secure-store here. supabase-js's client (non-SSR)
// storage adapter stores the ENTIRE session as one value under a single
// `sb-<ref>-auth-token` key — auth-js only chunks values for SSR cookie
// storage, never for this getItem/setItem/removeItem adapter. A real session
// (access-token JWT + refresh token + full user JSON + metadata) routinely
// exceeds expo-secure-store's ~2048-byte native limit, at which point the
// write is warned/rejected on Android and unreliable on iOS. The session then
// looks fine in memory but fails to persist/restore across a cold start on a
// physical device. AsyncStorage has no such size cap and is the officially
// documented Supabase + React Native adapter.
export const supabaseAuthStorage =
  Platform.OS === 'web'
    ? {
        getItem: async (key: string) => window.localStorage.getItem(key),
        setItem: async (key: string, value: string) => {
          window.localStorage.setItem(key, value);
        },
        removeItem: async (key: string) => {
          window.localStorage.removeItem(key);
        },
      }
    : AsyncStorage;
