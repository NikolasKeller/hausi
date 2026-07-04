import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
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
