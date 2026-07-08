import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { brand, colors, light, radius, shadow, spacing } from '../lib/theme';

// ── Burst ────────────────────────────────────────────────────────────────────
// A 90s-nostalgia starburst sticker derived from the Partiful starburst
// logomark — thin rounded rays radiating from a center. Purely decorative.
export function Burst({
  size = 48,
  color = colors.helio,
  rays = 8,
  thickness,
  rotate = 0,
  style,
}: {
  size?: number;
  color?: string;
  rays?: number;
  thickness?: number;
  rotate?: number;
  style?: ViewStyle;
}) {
  const bars = Math.max(2, Math.round(rays / 2));
  const t = thickness ?? Math.max(2, Math.round(size * 0.07));
  return (
    <View
      pointerEvents="none"
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        { transform: [{ rotate: `${rotate}deg` }] },
        style,
      ]}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: size,
            height: t,
            borderRadius: t / 2,
            backgroundColor: color,
            transform: [{ rotate: `${(180 / bars) * i}deg` }],
          }}
        />
      ))}
    </View>
  );
}

// ── Seal ─────────────────────────────────────────────────────────────────────
// A filled burst "seal" (overlapping rotated squares → many-pointed star). Good
// as a badge behind an emoji or a short label.
export function Seal({
  size = 64,
  color = colors.accent,
  rotate = 0,
  style,
  children,
}: {
  size?: number;
  color?: string;
  rotate?: number;
  style?: ViewStyle;
  children?: React.ReactNode;
}) {
  const sq = size * 0.78;
  return (
    <View
      // Decorative by default: never intercept taps, but let any interactive
      // children (and ancestor Pressables) still receive touches.
      pointerEvents="box-none"
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        { transform: [{ rotate: `${rotate}deg` }] },
        style,
      ]}
    >
      {[0, 30, 60].map((r) => (
        <View
          key={r}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: sq,
            height: sq,
            borderRadius: sq * 0.12,
            backgroundColor: color,
            transform: [{ rotate: `${r}deg` }],
          }}
        />
      ))}
      {children ? <View style={styles.sealContent}>{children}</View> : null}
    </View>
  );
}

// ── TiltCard ──────────────────────────────────────────────────────────────────
// Wraps content at a slight asymmetric angle with a physical drop shadow, so
// cards read like scattered paper stickers on a party surface.
export function TiltCard({
  rotate = 0,
  float,
  style,
  children,
}: {
  rotate?: number;
  float?: boolean;
  style?: ViewStyle;
  children?: React.ReactNode;
}) {
  return (
    <View style={[float ? shadow.float : shadow.card, { transform: [{ rotate: `${rotate}deg` }] }, style]}>
      {children}
    </View>
  );
}

// ── PaperCard ─────────────────────────────────────────────────────────────────
// The light-scheme surface: white panel, heavy black border, soft shadow.
export function PaperCard({
  rotate,
  style,
  children,
}: {
  rotate?: number;
  style?: ViewStyle;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.paperCard,
        rotate != null ? { transform: [{ rotate: `${rotate}deg` }] } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── PillBadge ─────────────────────────────────────────────────────────────────
// Full-pill tag. Defaults to a soft ink wash; pass bg/color for semantic RSVP.
export function PillBadge({
  label,
  bg,
  color,
  style,
}: {
  label: string;
  bg?: string;
  color?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.pill, bg ? { backgroundColor: bg } : null, style]}>
      <Text style={[styles.pillText, color ? { color } : null]}>{label}</Text>
    </View>
  );
}

// ── PartyGradient ─────────────────────────────────────────────────────────────
// The vibrant heliotrope→pink→blue party fill, as a reusable surface.
export function PartyGradient({
  style,
  children,
}: {
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}) {
  return (
    <LinearGradient
      colors={[...brand.party]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}

// ── PaperBackground ───────────────────────────────────────────────────────────
// The light public/marketing backdrop: a warm paper canvas with a periwinkle
// wash falling from the top, a party-pink glow in the corner, and a couple of
// scattered starburst stickers for the "physical party surface" feel. Opaque so
// it fully occludes anything behind it.
const DECOR: { top: string; left: string; size: number; rays: number; color: string; rotate: number }[] = [
  { top: '6%', left: '78%', size: 56, rays: 8, color: colors.helio, rotate: 6 },
  { top: '30%', left: '-4%', size: 40, rays: 6, color: '#B8B8B8', rotate: -12 },
  { top: '82%', left: '86%', size: 34, rays: 8, color: colors.accent, rotate: 10 },
];

export function PaperBackground({
  children,
  decor = true,
}: {
  children?: React.ReactNode;
  decor?: boolean;
}) {
  // Partiful aesthetic: a near-black canvas with a soft violet→pink bloom
  // falling from the top, like the app's lit-screen nightlife feel.
  return (
    <View style={styles.paperFill}>
      <LinearGradient
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
        locations={[0, 0.5, 1]}
        style={styles.washTop}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

// HOC mirror of withScreenBackground for light public tab-like screens.
export function withPaperBackground<P extends object>(
  Screen: React.ComponentType<P>
): React.ComponentType<P> {
  function ScreenWithPaper(props: P) {
    return (
      <PaperBackground>
        <Screen {...props} />
      </PaperBackground>
    );
  }
  ScreenWithPaper.displayName = `withPaperBackground(${Screen.displayName || Screen.name || 'Screen'})`;
  return ScreenWithPaper;
}

const styles = StyleSheet.create({
  sealContent: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperCard: {
    backgroundColor: light.paper,
    borderWidth: 1,
    borderColor: light.hairline,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.24,
    color: light.ink,
  },
  paperFill: {
    flex: 1,
    backgroundColor: light.bg,
    overflow: 'hidden',
  },
  washTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 520,
  },
  washCorner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 360,
  },
});
