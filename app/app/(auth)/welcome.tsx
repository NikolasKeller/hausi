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
import { Button } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { uiText } from '../../lib/fonts';
import { colors, spacing } from '../../lib/theme';

// Nightlife edition: the bokeh backdrop with the transparent chrome wordmark
// floating on it. (The paper intro video carries a baked-in cream ground, so
// this branch uses the cutout still instead.)
const NIGHT = require('../../assets/nightlife-bokeh.jpg');
const WORDMARK = require('../../assets/wordmark-chrome-cutout.png');

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
      {/* Full-bleed nightlife bokeh — the same scene as the whole app. */}
      <Image source={NIGHT} style={StyleSheet.absoluteFill} resizeMode="cover" />

      {/* The chrome wordmark floating on the night scene. */}
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
                  outputRange: [16, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Image source={WORDMARK} style={styles.art} resizeMode="contain" />
      </Animated.View>

      <SafeAreaView style={styles.safe}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  artWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: {
    width: '70%',
    height: '42%',
    backgroundColor: 'transparent',
    // Nudge the logo up so it sits centered above the button.
    marginBottom: '14%',
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
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
    color: colors.danger,
    ...uiText(12, '500'),
    textAlign: 'center',
  },
});
