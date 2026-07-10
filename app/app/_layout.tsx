import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { enableScreens } from 'react-native-screens';
import { AuthProvider, useAuth } from '../lib/auth';
import { peekPendingPath, setPendingPath, takePendingPath } from '../lib/pendingPath';
import { FONTS_TO_LOAD } from '../lib/fonts';
import { colors, spacing } from '../lib/theme';

// react-native-screens disables itself on web, which drops the tab navigator
// into a fallback that keeps every tab mounted and painted behind the focused
// one — with our transparent sceneStyle the pages render on top of each other.
// The library's web shim hides blurred tabs with display:none, so force it on.
if (Platform.OS === 'web') {
  enableScreens(true);
}

// ✕ in modal headers so nothing forces the user to complete a flow. A paper
// circle (same as the event form's close) — a filled ink circle disappears
// against the light scheme since the ✕ glyph is near-black too.
function ModalClose() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      hitSlop={12}
      style={({ pressed }) => [
        {
          // Leading margin keeps the circle off the screen edge — native-stack
          // ignores headerLeftContainerStyle, so the spacing lives on the button.
          marginLeft: spacing.md,
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
      ]}
    >
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>✕</Text>
    </Pressable>
  );
}

// Distinguishes "just pressed log out" (had a session) from "arrived signed
// out via a link" — logout should land on the intro, not the phone screen.
let hadSession = false;

// Invite pages are public: anyone with the link can view the event signed out
// (the API's by-slug endpoint doesn't require auth either). Everything else
// still funnels through the auth flow.
function isPublicEventPath(pathname: string | null | undefined): boolean {
  return !!pathname && /^\/(e|event)\//.test(pathname);
}

function RootNavigator() {
  const { user, initializing, devSignIn } = useAuth();
  // On font failure, proceed anyway — titles fall back to the system font.
  const [fontsLoaded, fontError] = useFonts(FONTS_TO_LOAD);
  const fontsReady = fontsLoaded || fontError != null;
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  const devAutoTried = useRef(false);
  useEffect(() => {
    // Dev-only: boot straight into the app while the SMS flow is WIP.
    if (initializing || user || devAutoTried.current) return;
    if (__DEV__ && process.env.EXPO_PUBLIC_DEV_AUTOLOGIN === '1') {
      devAutoTried.current = true;
      devSignIn().catch(() => {});
    }
  }, [initializing, user, devSignIn]);

  // Web: lock the viewport so mobile Safari doesn't zoom into a focused input
  // (which would push a screen's title out of view). Done at runtime so it also
  // covers the Expo dev server, whose HTML template we can't edit — the static
  // build sets the same meta via postexport.mjs.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const doc = (globalThis as any).document;
    const win = (globalThis as any).window;
    if (!doc?.head) return;
    let meta = doc.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = doc.createElement('meta');
      meta.setAttribute('name', 'viewport');
      doc.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
    );

    // Pin the document itself: this is an app shell, only inner ScrollViews
    // scroll. Expo's default `body { overflow: hidden }` isn't enough on iOS
    // Safari — the page can still be panned (keyboard opening over a focused
    // input, rubber-banding off a horizontal scroller) and then sticks with
    // the content hanging out of the right edge.
    const html = doc.documentElement;
    const body = doc.body;
    if (html) {
      html.style.overflow = 'hidden';
      html.style.height = '100%';
      html.style.overscrollBehavior = 'none';
    }
    if (body) {
      body.style.position = 'fixed';
      body.style.top = '0';
      body.style.left = '0';
      body.style.right = '0';
      body.style.bottom = '0';
      body.style.width = '100%';
      body.style.height = '100%';
      body.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';
    }

    // Safari can still pan the *visual* viewport past the layout viewport
    // (most often when the keyboard scrolls a focused input "into view").
    // Snap straight back so the app never rests half off-screen.
    const snapBack = () => {
      if (win?.scrollX || win?.scrollY) win.scrollTo(0, 0);
    };
    win?.addEventListener?.('scroll', snapBack);
    win?.visualViewport?.addEventListener?.('scroll', snapBack);
    return () => {
      win?.removeEventListener?.('scroll', snapBack);
      win?.visualViewport?.removeEventListener?.('scroll', snapBack);
    };
  }, []);

  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup && !isPublicEventPath(pathname)) {
      const arrivedViaLink = !hadSession && pathname && pathname !== '/';
      if (arrivedViaLink) setPendingPath(pathname);
      // Invitees jump straight to phone entry; everyone else gets the intro.
      router.replace(arrivedViaLink ? '/phone' : '/welcome');
    } else if (user && !user.name.trim()) {
      // Onboarding is mandatory: until a name is saved, every route —
      // including a reload or a typed URL — funnels back to profile setup.
      if (segments[0] !== 'setup') router.replace('/setup');
    } else if (user && (inAuthGroup || peekPendingPath())) {
      // Restore where the user was heading (e.g. an invite link) — also for
      // first-timers, who finish profile setup before this fires. Fresh
      // sign-ins land on Explore, the app's first tab.
      const target = takePendingPath() ?? '/explore';
      if (pathname !== target) router.replace(target as never);
    }
    hadSession = !!user;
  }, [user, initializing, segments, pathname, router]);

  if (initializing || !fontsReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen
        name="edit-profile"
        options={{
          title: 'Edit Profile',
          presentation: 'modal',
          gestureEnabled: true,
          headerLeft: () => <ModalClose />,
        }}
      />
      <Stack.Screen name="user/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="event/[slug]/index" options={{ headerShown: false }} />
      <Stack.Screen
        name="event/[slug]/edit"
        options={{
          headerShown: false,
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="event/[slug]/blast"
        options={{
          headerShown: false,
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen name="e/[slug]" options={{ headerShown: false }} />
    </Stack>
  );
}

// On web the app keeps a phone-sized column no matter the screen: full width
// on mobile browsers, centered 430px "phone" on desktop.
function WebFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={frameStyles.page}>
      <View style={frameStyles.phone}>{children}</View>
    </View>
  );
}

const frameStyles = StyleSheet.create({
  page: {
    flex: 1,
    // Midnight surround — the phone column sits on the same night canvas.
    backgroundColor: colors.bg,
    alignItems: 'center',
  },
  phone: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    backgroundColor: colors.bg,
    // A faint light rim so the column reads against the dark surround.
    ...(Platform.OS === 'web' ? { boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 0 32px rgba(0,0,0,0.8)' } : null),
  },
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <WebFrame>
        <RootNavigator />
      </WebFrame>
    </AuthProvider>
  );
}
