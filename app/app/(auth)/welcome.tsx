import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { uiText } from '../../lib/fonts';
import { colors, spacing } from '../../lib/theme';

// The chrome "iykyk" artwork — a square render on a warm cream ground. The
// screen fills with the same cream and feathers the artwork's edges into it.
const WORDMARK = require('../../assets/wordmark-chrome.png');

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
    <View style={styles.screen}>
      {/* The artwork, centered and contained — never stretched. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.artWrap,
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
        <Image source={WORDMARK} style={styles.art} resizeMode="contain" />
      </Animated.View>
      {/* Feather the square artwork's top/bottom edges into the canvas so its
          slight vignette never shows a seam. */}
      <LinearGradient
        colors={[colors.bg, 'rgba(207,199,189,0)', 'rgba(207,199,189,0)', colors.bg]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1 }} />

        <Animated.View style={[styles.brand, { opacity: intro }]}>
          <Text style={styles.tagline}>Parties worth showing up for</Text>
        </Animated.View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // Matches the artwork's cream ground so the square image melts into the
    // full screen.
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  artWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: {
    width: '100%',
    height: '80%',
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.md,
    // Sits in the lower third, under the artwork's wordmark.
    marginBottom: spacing.xl,
  },
  tagline: {
    color: colors.muted,
    ...uiText(16, '500'),
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
