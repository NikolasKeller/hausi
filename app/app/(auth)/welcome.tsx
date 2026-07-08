import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuroraBackground } from '../../components/AuroraBackground';
import { Button } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { display, uiText } from '../../lib/fonts';
import { colors, spacing } from '../../lib/theme';

// react-native-web has no native driver; silence its fallback warning.
const useNativeDriver = Platform.OS !== 'web';

// Only surface the dev login on the developer's own machine: a localhost web
// origin, or a native Metro dev build. In a shipped web build served by the
// server the hostname isn't localhost, so the button never appears — and even
// if it did, the server endpoint 404s off-localhost.
const showDevLogin =
  Platform.OS === 'web'
    ? typeof window !== 'undefined' &&
      ['localhost', '127.0.0.1'].includes(window.location.hostname)
    : __DEV__;

export default function WelcomeScreen() {
  const router = useRouter();
  const { devLogin } = useAuth();
  const [devBusy, setDevBusy] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  const intro = useRef(new Animated.Value(0)).current;

  async function handleDevLogin() {
    if (devBusy) return;
    setDevBusy(true);
    setDevError(null);
    try {
      // The root navigator's auth guard routes to setup/home once the session
      // lands, so there's nothing to navigate here.
      await devLogin();
    } catch (e) {
      setDevError(e instanceof Error ? e.message : 'Dev login failed');
      setDevBusy(false);
    }
  }

  useEffect(() => {
    Animated.timing(intro, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
  }, [intro]);

  return (
    <AuroraBackground>
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1 }} />

        <Animated.View
          style={[
            styles.brand,
            {
              opacity: intro,
              transform: [
                {
                  translateY: intro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.wordmark}>iykyk</Text>
          <Text style={styles.tagline}>Parties worth showing up for</Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Button title="Get started" variant="primary" onPress={() => router.push('/phone')} />

        {showDevLogin && (
          <View style={styles.devWrap}>
            <Pressable onPress={handleDevLogin} hitSlop={10} disabled={devBusy}>
              <Text style={styles.devLink}>
                {devBusy ? 'Signing in…' : 'Developer login (localhost)'}
              </Text>
            </Pressable>
            {devError ? <Text style={styles.devError}>{devError}</Text> : null}
          </View>
        )}

        <View style={{ height: spacing.xl }} />
      </SafeAreaView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.md,
  },
  wordmark: {
    color: colors.text,
    ...display(56),
    textAlign: 'center',
  },
  tagline: {
    color: colors.muted,
    ...uiText(18, '400'),
    textAlign: 'center',
  },
  devWrap: {
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  devLink: {
    color: colors.muted,
    ...uiText(14, '600'),
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  devError: {
    color: colors.accent,
    ...uiText(12, '500'),
    textAlign: 'center',
  },
});
