import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { enableScreens } from 'react-native-screens';
import { AuthProvider, useAuth } from '../lib/auth';
import { FONTS_TO_LOAD } from '../lib/fonts';
import { colors } from '../lib/theme';

// react-native-screens disables itself on web, which drops the tab navigator
// into a fallback that keeps every tab mounted and painted behind the focused
// one — with our transparent sceneStyle the pages render on top of each other.
// The library's web shim hides blurred tabs with display:none, so force it on.
if (Platform.OS === 'web') {
  enableScreens(true);
}

// ✕ in modal headers so nothing forces the user to complete a flow.
function ModalClose() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>✕</Text>
    </Pressable>
  );
}

function RootNavigator() {
  const { user, initializing, devSignIn } = useAuth();
  // On font failure, proceed anyway — titles fall back to the system font.
  const [fontsLoaded, fontError] = useFonts(FONTS_TO_LOAD);
  const fontsReady = fontsLoaded || fontError != null;
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  // Where a signed-out user was heading (e.g. an invite deep link) — restored after auth.
  const pendingPath = useRef<string | null>(null);
  // Distinguishes "just pressed log out" (had a session) from "arrived signed
  // out via a link" — logout should land on the intro, not the phone screen.
  const hadSession = useRef(false);

  const devAutoTried = useRef(false);
  useEffect(() => {
    // Dev-only: boot straight into the app while the SMS flow is WIP.
    if (initializing || user || devAutoTried.current) return;
    if (__DEV__ && process.env.EXPO_PUBLIC_DEV_AUTOLOGIN === '1') {
      devAutoTried.current = true;
      devSignIn().catch(() => {});
    }
  }, [initializing, user, devSignIn]);

  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      const arrivedViaLink = !hadSession.current && pathname && pathname !== '/';
      if (arrivedViaLink) pendingPath.current = pathname;
      // Invitees jump straight to phone entry; everyone else gets the intro.
      router.replace(arrivedViaLink ? '/phone' : '/welcome');
    } else if (user && !user.name.trim()) {
      // Onboarding is mandatory: until a name is saved, every route —
      // including a reload or a typed URL — funnels back to profile setup.
      if (segments[0] !== 'setup') router.replace('/setup');
    } else if (user && inAuthGroup) {
      const target = pendingPath.current ?? '/';
      pendingPath.current = null;
      router.replace(target as never);
    }
    hadSession.current = !!user;
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
        name="new-event"
        options={{
          title: 'New Event',
          presentation: 'modal',
          gestureEnabled: true,
          headerLeft: () => <ModalClose />,
        }}
      />
      <Stack.Screen
        name="send-card"
        options={{
          title: 'Send a Card',
          presentation: 'modal',
          gestureEnabled: true,
          headerLeft: () => <ModalClose />,
        }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{
          title: 'Edit Profile',
          presentation: 'modal',
          gestureEnabled: true,
          headerLeft: () => <ModalClose />,
        }}
      />
      <Stack.Screen
        name="add-plus-one"
        options={{
          title: 'Add a plus one',
          presentation: 'modal',
          gestureEnabled: true,
          headerLeft: () => <ModalClose />,
        }}
      />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="event/[slug]/index" options={{ title: '', headerTransparent: true }} />
      <Stack.Screen
        name="event/[slug]/edit"
        options={{
          title: 'Edit Event',
          presentation: 'modal',
          gestureEnabled: true,
          headerLeft: () => <ModalClose />,
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
    backgroundColor: '#070510',
    alignItems: 'center',
  },
  phone: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    backgroundColor: colors.bg,
    ...(Platform.OS === 'web' ? { boxShadow: '0 0 48px rgba(0,0,0,0.6)' } : null),
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
