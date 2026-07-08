import { Redirect } from 'expo-router';

// The old home feed is gone — Explore is the app's main page. This route only
// exists so every legacy "/" reference (modal closes, invite fallbacks, typed
// URLs) still lands somewhere sensible. Hidden from the tab bar via href:null.
export default function IndexRedirect() {
  return <Redirect href="/explore" />;
}
