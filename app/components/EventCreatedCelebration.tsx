import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { brand, colors, radius } from '../lib/theme';
import { display } from '../lib/fonts';
import { Burst } from './partiful';

// react-native-web has no native driver; silence its fallback warning.
const useNativeDriver = Platform.OS !== 'web';

// A quick, self-contained success moment that plays once right after an event
// is created, then calls `onDone` so the caller can navigate to the new event.
// Full-screen dark scrim + orange starburst + a scale-in checkmark seal, a
// short confetti burst, and an "Event created!" line — all on the app's
// near-black canvas with the warm orange accent and the Reglo display voice.

const CONFETTI_COLORS = [
  colors.accent,
  brand.glow[0],
  colors.accentDark,
  '#FFFFFF',
  '#C2BBB0',
];

interface ConfettiSpec {
  angle: number; // radians, outward from center
  distance: number; // px travelled from center
  size: number;
  color: string;
  rounded: boolean;
  spin: number; // degrees of rotation over the flight
  delay: number;
}

// Deterministic burst layout — evenly spread around the circle with an
// index-seeded jitter so it reads as a lively pop rather than a clean ring.
function confettiSpecs(count: number): ConfettiSpec[] {
  return Array.from({ length: count }, (_, i) => {
    const base = (i / count) * Math.PI * 2;
    const jitter = (((i * 53 + 17) % 40) - 20) * (Math.PI / 180);
    return {
      angle: base + jitter,
      distance: 150 + ((i * 37) % 120),
      size: 8 + ((i * 7) % 8),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rounded: i % 3 === 0,
      spin: ((i * 71) % 4) * 180 + 180,
      delay: (i % 5) * 24,
    };
  });
}

function ConfettiPiece({ spec, progress }: { spec: ConfettiSpec; progress: Animated.Value }) {
  const dx = Math.cos(spec.angle) * spec.distance;
  const dy = Math.sin(spec.angle) * spec.distance;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: spec.size,
        height: spec.rounded ? spec.size : spec.size * 0.5,
        borderRadius: spec.rounded ? spec.size / 2 : 2,
        backgroundColor: spec.color,
        opacity: progress.interpolate({
          inputRange: [0, 0.1, 0.7, 1],
          outputRange: [0, 1, 1, 0],
        }),
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, dx],
            }),
          },
          {
            // Fly out, then a little gravity drop as the burst settles.
            translateY: progress.interpolate({
              inputRange: [0, 0.6, 1],
              outputRange: [0, dy, dy + 60],
            }),
          },
          {
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', `${spec.spin}deg`],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 0.15, 1],
              outputRange: [0.4, 1, 0.9],
            }),
          },
        ],
      }}
    />
  );
}

export function EventCreatedCelebration({ onDone }: { onDone: () => void }) {
  // Master opacity for the scrim + a fade-out at the end.
  const scrim = useRef(new Animated.Value(0)).current;
  // Scale/pop for the success mark.
  const mark = useRef(new Animated.Value(0)).current;
  // Slow rotation + scale of the starburst behind the mark.
  const burst = useRef(new Animated.Value(0)).current;
  // Outward flight of the confetti.
  const confetti = useRef(new Animated.Value(0)).current;
  // Text fade/rise.
  const label = useRef(new Animated.Value(0)).current;

  const specs = useRef(confettiSpecs(22)).current;
  const done = useRef(false);

  useEffect(() => {
    const finish = () => {
      if (done.current) return;
      done.current = true;
      onDone();
    };

    Animated.parallel([
      Animated.timing(scrim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver,
      }),
      Animated.spring(mark, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver,
      }),
      Animated.timing(burst, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
      Animated.timing(confetti, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }),
      Animated.sequence([
        Animated.delay(160),
        Animated.timing(label, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver,
        }),
      ]),
    ]).start();

    // Hold the moment, then fade the whole overlay out and hand off.
    const timer = setTimeout(() => {
      Animated.timing(scrim, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.quad),
        useNativeDriver,
      }).start(finish);
    }, 1250);

    // Safety net: never trap the user on the overlay.
    const guard = setTimeout(finish, 2200);

    return () => {
      clearTimeout(timer);
      clearTimeout(guard);
    };
  }, [scrim, mark, burst, confetti, label, onDone]);

  return (
    <Animated.View style={[styles.overlay, { opacity: scrim }]} pointerEvents="auto">
      <View style={styles.center} pointerEvents="none">
        <View style={styles.markWrap}>
          <Animated.View
            style={{
              position: 'absolute',
              opacity: burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.9, 0.55] }),
              transform: [
                { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.35] }) },
                { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) },
              ],
            }}
          >
            <Burst size={180} rays={12} color={colors.accent} thickness={7} />
          </Animated.View>

          {specs.map((spec, i) => (
            <ConfettiPiece key={i} spec={spec} progress={confetti} />
          ))}

          <Animated.View
            style={[
              styles.seal,
              {
                opacity: mark,
                transform: [
                  { scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
                ],
              },
            ]}
          >
            <Text style={styles.check}>✓</Text>
          </Animated.View>
        </View>

        <Animated.Text
          style={[
            styles.title,
            {
              opacity: label,
              transform: [
                { translateY: label.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              ],
            },
          ]}
        >
          Event created!
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const SEAL_SIZE = 96;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seal: {
    width: SEAL_SIZE,
    height: SEAL_SIZE,
    borderRadius: SEAL_SIZE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  check: {
    color: colors.onAccent,
    fontSize: 52,
    lineHeight: 58,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: -2,
  },
  title: {
    ...display(30),
    color: colors.text,
    marginTop: 28,
    textAlign: 'center',
  },
});
