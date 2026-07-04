import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Burst } from './partiful';
import { brand, light } from '../lib/theme';

// react-native-web has no native driver; silence its fallback warning.
const useNativeDriver = Platform.OS !== 'web';

interface OrbSpec {
  size: number;
  left: number; // percent
  top: number; // percent
  color: string;
  duration: number;
  delay: number;
  drift: number;
  rotate: number;
  rays: number;
}

// Scattered starburst stickers that drift gently — the "physical party surface"
// read for the light paper backdrop. (Layout/motion seeds preserved.)
const ORBS: OrbSpec[] = [
  { size: 90, left: 12, top: 12, color: brand.party[0], duration: 9000, delay: 0, drift: 26, rotate: -14, rays: 8 },
  { size: 46, left: 74, top: 8, color: brand.party[1], duration: 7000, delay: 800, drift: 18, rotate: 10, rays: 6 },
  { size: 26, left: 52, top: 22, color: light.midnight, duration: 6000, delay: 1600, drift: 14, rotate: 18, rays: 6 },
  { size: 64, left: 84, top: 38, color: brand.party[2], duration: 10000, delay: 400, drift: 22, rotate: -8, rays: 8 },
  { size: 34, left: 6, top: 46, color: brand.party[1], duration: 8000, delay: 2000, drift: 16, rotate: 12, rays: 6 },
  { size: 120, left: 66, top: 62, color: brand.party[0], duration: 12000, delay: 1000, drift: 30, rotate: -12, rays: 8 },
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
        opacity: 0.85,
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
    >
      <Burst size={spec.size} rays={spec.rays} color={spec.color} rotate={spec.rotate} />
    </Animated.View>
  );
}

const CONFETTI_COLORS = ['#FF4FD8', '#4B7BFF', '#D241FA', '#001666', '#F0B6E0'];

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
          outputRange: [0, 0.9, 0.9, 0],
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

// Full-screen light festive backdrop for the onboarding flow: a warm paper
// canvas with pastel party washes, drifting starburst stickers, and optional
// falling confetti.
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
        colors={[...brand.periwinkle]}
        locations={[0, 1]}
        style={styles.washTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(248,196,255,0.6)', 'rgba(248,196,255,0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.15, y: 0.6 }}
        style={styles.washCorner}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(133,218,220,0)', 'rgba(133,218,220,0.4)']}
        start={{ x: 0, y: 1 }}
        end={{ x: 0.6, y: 0.4 }}
        style={styles.washBottom}
        pointerEvents="none"
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
    backgroundColor: light.bg,
  },
  washTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 560,
  },
  washCorner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  washBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 320,
  },
});
