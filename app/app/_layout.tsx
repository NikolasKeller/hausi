import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

function RootNavigator() {
  const { user, initializing } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  // Where a signed-out user was heading (e.g. an invite deep link) — restored after auth.
  const pendingPath = useRef<string | null>(null);

  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      if (pathname && pathname !== '/') pendingPath.current = pathname;
      router.replace('/login');
    } else if (user && inAuthGroup) {
      const target = pendingPath.current ?? '/';
      pendingPath.current = null;
      router.replace(target as never);
    }
  }, [user, initializing, segments, pathname, router]);

  if (initializing) {
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
