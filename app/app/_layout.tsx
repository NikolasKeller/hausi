import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { AuthProvider, useAuth } from '../lib/auth';
import { FONTS_TO_LOAD } from '../lib/fonts';
import { colors } from '../lib/theme';

function RootNavigator() {
  const { user, initializing } = useAuth();
  // On font failure, proceed anyway — titles fall back to the system font.
  const [fontsLoaded, fontError] = useFonts(FONTS_TO_LOAD);
  const fontsReady = fontsLoaded || fontError != null;
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  // Where a signed-out user was heading (e.g. an invite deep link) — restored after auth.
  const pendingPath = useRef<string | null>(null);

  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      const arrivedViaLink = pathname && pathname !== '/';
      if (arrivedViaLink) pendingPath.current = pathname;
      // Invitees without an account go through signup first, per the invite flow.
      router.replace(arrivedViaLink ? '/signup' : '/login');
    } else if (user && inAuthGroup) {
      const target = pendingPath.current ?? '/';
      pendingPath.current = null;
      router.replace(target as never);
    }
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
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create" options={{ title: 'New Event', presentation: 'modal' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="event/[slug]/index" options={{ title: '', headerTransparent: true }} />
      <Stack.Screen name="event/[slug]/edit" options={{ title: 'Edit Event', presentation: 'modal' }} />
      <Stack.Screen name="e/[slug]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}
