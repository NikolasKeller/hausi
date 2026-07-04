// Supabase client used for BOTH auth (supabase-js) and data (RPCs).
// Session persistence is delegated to storage.ts so native uses
// @react-native-async-storage/async-storage and web uses localStorage.
import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { supabaseAuthStorage } from './storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail loud in dev; a misconfigured build would otherwise 401 on every call.
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Add them to app/.env (see .env.example).'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persist + auto-refresh the session using the platform storage adapter.
    storage: supabaseAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    // We never carry the session in a URL fragment (no web OAuth redirect flow);
    // leaving this on makes supabase-js try to parse window.location on web.
    detectSessionInUrl: false,
  },
});

// supabase-js can only auto-refresh while it knows the app is active. Wire the
// RN AppState so tokens refresh in the foreground and pause in the background.
// (No-op on web, where the token simply refreshes on a timer.)
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
