import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet } from 'react-native';
import { useAuth } from '../lib/auth';
import { startExplorePrefetch } from '../lib/explorePrefetch';
import { colors } from '../lib/theme';

// The landing scene: the same nightlife bokeh + chrome wordmark the welcome
// screen opens with, played as a short intro when a signed-in user opens the
// app. While it holds the stage, the Explore feed and its cover images load
// behind it, so the app appears fully drawn instead of popping in piecemeal.
const NIGHT = require('../assets/nightlife-bokeh.jpg');
const WORDMARK = require('../assets/wordmark-chrome-cutout.png');

const useNativeDriver = Platform.OS !== 'web';

// Wordmark entrance matches the welcome screen (600ms rise), then a short
// hold so the moment reads as deliberate, not as a loading screen.
const WORDMARK_IN_MS = 600;
const MIN_SHOW_MS = 1500;
// Never hold the app hostage on a slow network — after this, fade out and let
// the feed finish loading in place.
const MAX_SHOW_MS = 3500;
const FADE_OUT_MS = 450;

export function LaunchIntro() {
  const { user, initializing } = useAuth();
  const [mounted, setMounted] = useState(true);
  const overlay = useRef(new Animated.Value(1)).current;
  const wordmark = useRef(new Animated.Value(0)).current;
  // The intro plays once per app open; auth changes later never replay it.
  const decided = useRef(false);

  useEffect(() => {
    if (initializing || decided.current) return;
    decided.current = true;

    if (!user) {
      // Signed out: the welcome screen owns this exact scene and animates the
      // wordmark itself — hand over instantly instead of playing it twice.
      setMounted(false);
      return;
    }

    Animated.timing(wordmark, {
      toValue: 1,
      duration: WORDMARK_IN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();

    const shownAt = Date.now();
    const minShow = new Promise((r) => setTimeout(r, MIN_SHOW_MS));
    const warmed = Promise.race([
      startExplorePrefetch(),
      new Promise((r) => setTimeout(r, MAX_SHOW_MS - MIN_SHOW_MS)),
    ]);

    let alive = true;
    Promise.all([minShow, warmed]).then(() => {
      if (!alive) return;
      // Cap the total time on stage regardless of how the promises land.
      const overdue = Date.now() - shownAt >= MAX_SHOW_MS;
      Animated.timing(overlay, {
        toValue: 0,
        duration: overdue ? FADE_OUT_MS / 2 : FADE_OUT_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver,
      }).start(() => setMounted(false));
    });
    return () => {
      alive = false;
    };
  }, [initializing, user, overlay, wordmark]);

  if (!mounted) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlay }]} pointerEvents="auto">
      <Image source={NIGHT} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.artWrap,
          {
            opacity: wordmark,
            transform: [
              {
                translateY: wordmark.interpolate({
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    zIndex: 100,
    ...(Platform.OS === 'android' ? { elevation: 100 } : null),
  },
  artWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same footprint as the welcome screen's wordmark, so intro and landing
  // read as one scene.
  art: {
    width: '70%',
    height: '42%',
    marginBottom: '14%',
  },
});
