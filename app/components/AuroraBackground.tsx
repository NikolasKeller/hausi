import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// react-native-web has no native driver; silence its fallback warning.
const useNativeDriver = Platform.OS !== 'web';

// Dusk-over-water palette: peach horizon → violet dusk → deep plum water.
const DUSK = ['#E8927C', '#B76E9B', '#6E4E8E', '#3B2E5E', '#241B3A'] as const;

interface OrbSpec {
  size: number;
  left: number; // percent
  top: number; // percent
  color: string;
  duration: number;
  delay: number;
  drift: number;
}

const ORBS: OrbSpec[] = [
  { size: 90, left: 12, top: 12, color: '#FF4FD8', duration: 9000, delay: 0, drift: 26 },
  { size: 46, left: 74, top: 8, color: '#FF7AE0', duration: 7000, delay: 800, drift: 18 },
  { size: 26, left: 52, top: 22, color: '#B48CFF', duration: 6000, delay: 1600, drift: 14 },
  { size: 64, left: 84, top: 38, color: '#3D2E6B', duration: 10000, delay: 400, drift: 22 },
  { size: 34, left: 6, top: 46, color: '#FF4FD8', duration: 8000, delay: 2000, drift: 16 },
  { size: 120, left: 66, top: 62, color: '#2E2352', duration: 12000, delay: 1000, drift: 30 },
];

function Orb({ spec }: { spec: OrbSpec }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(spec.delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: spec.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: spec.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, spec.delay, spec.duration]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: `${spec.left}%`,
        top: `${spec.top}%`,
        width: spec.size,
        height: spec.size,
        borderRadius: spec.size / 2,
        backgroundColor: spec.color,
        opacity: 0.5,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -spec.drift],
            }),
          },
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, spec.drift / 2],
            }),
          },
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
        ],
      }}
    />
  );
}

const CONFETTI_COLORS = ['#FF7AE0', '#8BD3FF', '#C6FF8B', '#FFE38B', '#B48CFF'];

function ConfettiPiece({ index, height }: { index: number; height: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const duration = 9000 + ((index * 977) % 5000);
  const delay = (index * 653) % 6000;
  const left = (index * 41 + 7) % 96;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver,
        }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, delay, duration]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: `${left}%`,
        top: -12,
        width: 7,
        height: 5,
        borderRadius: 1.5,
        backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        opacity: progress.interpolate({
          inputRange: [0, 0.08, 0.85, 1],
          outputRange: [0, 0.85, 0.85, 0],
        }),
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, height + 24],
            }),
          },
          {
            translateX: progress.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0, index % 2 === 0 ? 24 : -24, 0],
            }),
          },
          {
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', index % 2 === 0 ? '540deg' : '-540deg'],
            }),
          },
        ],
      }}
    />
  );
}

// Full-screen animated dusk backdrop for the onboarding flow.
export function AuroraBackground({
  children,
  confetti = true,
}: {
  children?: React.ReactNode;
  confetti?: boolean;
}) {
  const { height } = useWindowDimensions();
  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={[...DUSK]}
        locations={[0, 0.28, 0.55, 0.78, 1]}
        style={styles.gradient}
      />
      {ORBS.map((spec, i) => (
        <Orb key={i} spec={spec} />
      ))}
      {confetti
        ? Array.from({ length: 14 }, (_, i) => (
            <ConfettiPiece key={i} index={i} height={height} />
          ))
        : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#241B3A',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
