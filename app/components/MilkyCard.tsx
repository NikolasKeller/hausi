import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { glass, radius as R, shadow } from '../lib/theme';

// The signature "milky" frosted-glass surface from the reference design —
// semi-opaque white wash over a live backdrop blur, thin rim-light border,
// and a soft top-edge sheen. This is the dating-dashboard card aesthetic.
export function MilkyCard({
  intensity = glass.blur,
  radius = R.milky,
  style,
  contentStyle,
  children,
}: {
  intensity?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.outer, { borderRadius: radius }, shadow.milky, style]}>
      <BlurView
        intensity={intensity}
        tint="dark"
        style={[styles.blur, { borderRadius: radius }]}
      >
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: glass.fill, borderRadius: radius }]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
          locations={[0, 0.35, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
        <View style={[styles.content, contentStyle]}>{children}</View>
      </BlurView>
    </View>
  );
}

// Lighter milky surface for list rows — skips BlurView cost, keeps the milky
// wash + rim so grids still feel cohesive at scroll speed.
export function MilkySurface({
  radius = R.milkySm,
  style,
  children,
}: {
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.lite, { borderRadius: radius }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.06)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.border,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: `blur(${glass.blur}px)` } as ViewStyle)
      : null),
  },
  blur: {
    overflow: 'hidden',
  },
  content: {
    padding: 20,
  },
  lite: {
    overflow: 'hidden',
    backgroundColor: glass.fillLite,
    borderWidth: 1,
    borderColor: glass.border,
  },
});
