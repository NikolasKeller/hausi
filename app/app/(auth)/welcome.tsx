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
import { useVideoPlayer, VideoView } from 'expo-video';
import { Button } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { storage } from '../../lib/storage';
import { uiText } from '../../lib/fonts';
import { colors, spacing } from '../../lib/theme';

// The paper stock behind everything; the chrome "iykyk" wordmark cut out to
// transparency (the static logo / frozen end-state); and the "silver liquid"
// logo animation that plays once on the very first open.
const PAPER = require('../../assets/paper-texture.png');
const WORDMARK = require('../../assets/wordmark-chrome-cutout.png');
const LOGO_VIDEO = require('../../assets/welcome-logo.mp4');

// Set once the intro animation has played through, so it never plays again.
const WELCOME_LOGO_PLAYED = 'welcome_logo_played';

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

// checking → deciding from the persisted flag; video → play the animation once;
// static → show the frozen chrome wordmark.
type LogoPhase = 'checking' | 'video' | 'static';

export default function WelcomeScreen() {
  const router = useRouter();
  const { devLogin } = useAuth();
  const [devBusy, setDevBusy] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  const [phase, setPhase] = useState<LogoPhase>('checking');
  const intro = useRef(new Animated.Value(0)).current;

  // Muted so iOS lets it autoplay; never loops — it's a one-shot intro.
  const player = useVideoPlayer(LOGO_VIDEO, (p) => {
    p.loop = false;
    p.muted = true;
  });

  // Decide once on mount: the animation only ever plays on the first native
  // open. Web always shows the static logo (autoplay there is unreliable).
  useEffect(() => {
    let active = true;
    (async () => {
      if (Platform.OS === 'web') {
        if (active) setPhase('static');
        return;
      }
      let played: string | null = null;
      try {
        played = await storage.getItemAsync(WELCOME_LOGO_PLAYED);
      } catch {
        played = null;
      }
      if (active) setPhase(played ? 'static' : 'video');
    })();
    return () => {
      active = false;
    };
  }, []);

  // Play the one-shot animation, then freeze onto the static logo and remember
  // it so later visits skip straight to the still.
  useEffect(() => {
    if (phase !== 'video') return;
    try {
      player.play();
    } catch {
      setPhase('static');
      return;
    }
    const freeze = () => {
      storage.setItemAsync(WELCOME_LOGO_PLAYED, '1').catch(() => {});
      setPhase('static');
    };
    const end = player.addListener('playToEnd', freeze);
    const status = player.addListener('statusChange', ({ status }) => {
      // A decode/load failure should never leave a blank stage.
      if (status === 'error') setPhase('static');
    });
    return () => {
      end.remove();
      status.remove();
    };
  }, [phase, player]);

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
      {/* Full-bleed paper texture — the same sheet as the whole app. */}
      <Image source={PAPER} style={StyleSheet.absoluteFill} resizeMode="cover" />

      {/* The logo stage — same footprint whether it's the video or the still,
          centered on the paper and sized like the old chrome wordmark. */}
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
        {phase === 'video' ? (
          <VideoView
            player={player}
            style={styles.art}
            contentFit="contain"
            nativeControls={false}
          />
        ) : phase === 'static' ? (
          <Image source={WORDMARK} style={styles.art} resizeMode="contain" />
        ) : null}
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
    width: '88%',
    height: '55%',
    // Transparent so the paper shows through the video's letterbox area.
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
    color: colors.accent,
    ...uiText(12, '500'),
    textAlign: 'center',
  },
});
