import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { radius as R } from '../lib/theme';

// ── Glass ─────────────────────────────────────────────────────────────────────
// A real frosted-glass surface: a live backdrop blur of whatever sits behind it
// (BlurView → CSS backdrop-filter on web, native blur on iOS/Android), lifted
// with a hairline highlight border and a faint top-edge sheen so it reads like a
// pane of glass rather than a flat white overlay. Elements take on the hue and
// brightness of the ambient gradient they float over.
export function Glass({
  intensity = 28,
  tint = 'light',
  radius = R.lg,
  border = true,
  sheen = true,
  fill,
  style,
  children,
}: {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  radius?: number;
  border?: boolean;
  sheen?: boolean;
  // Optional extra tint wash painted over the blur (e.g. 'rgba(255,255,255,0.12)').
  fill?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const dark = tint === 'dark';
  return (
    <BlurView
      intensity={intensity}
      tint={tint}
      style={[
        { borderRadius: radius, overflow: 'hidden' },
        border && (dark ? styles.borderDark : styles.borderLight),
        style,
      ]}
    >
      {fill ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} /> : null}
      {sheen ? (
        <LinearGradient
          pointerEvents="none"
          colors={
            dark
              ? ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']
              : ['rgba(255,255,255,0.38)', 'rgba(255,255,255,0.04)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children}
    </BlurView>
  );
}

// A frosted pill — the minimal-contrast tappable chip used for filters, tags,
// and toolbar capsules. `active` gives it a brighter fill to read as selected.
export function GlassPill({
  active,
  tint = 'light',
  intensity = 22,
  style,
  children,
}: {
  active?: boolean;
  tint?: 'light' | 'dark' | 'default';
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const dark = tint === 'dark';
  return (
    <Glass
      radius={R.pill}
      intensity={active ? intensity + 18 : intensity}
      tint={tint}
      fill={active ? (dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.34)') : undefined}
      style={[styles.pill, style]}
    >
      {children}
    </Glass>
  );
}

// A frosted input row for glass screens — a lightly-frosted rectangle that lets
// the ambient gradient tint through while keeping dark text legible. Optional
// leading icon (matches Partiful's "📍 Location", "⏳ RSVP Deadline" rows).
export function GlassField({
  label,
  left,
  containerStyle,
  style,
  ...props
}: TextInputProps & {
  label?: string;
  left?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  style?: TextInputProps['style'];
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.glassLabel}>{label}</Text> : null}
      <Glass radius={14} intensity={24} tint="light" style={[styles.glassFieldWrap, containerStyle]}>
        {left ? <View style={styles.glassFieldLeft}>{left}</View> : null}
        <TextInput
          placeholderTextColor="rgba(0,0,0,0.42)"
          style={[styles.glassInput, style]}
          {...props}
        />
      </Glass>
    </View>
  );
}

// ── AmbientBackground ─────────────────────────────────────────────────────────
// The screen's "mood" wallpaper — a soft ambient gradient that the glass reads
// through. Opaque, static (blur cost is per-glass, not per-frame).
//   cloud      — dreamy pastel sky (blues → lilac → peach) for create/edit.
//   iridescent — holographic diagonal light-leaks for the card composer.
//   coral      — warm coral spotlight with vertical light-leak streaks (RSVP feed).
type Variant = 'cloud' | 'iridescent' | 'coral';

const SPARKS: { top: string; left: string; size: number }[] = [
  { top: '14%', left: '82%', size: 4 },
  { top: '38%', left: '10%', size: 3 },
  { top: '52%', left: '88%', size: 5 },
  { top: '73%', left: '22%', size: 3 },
  { top: '86%', left: '70%', size: 4 },
];

export function AmbientBackground({
  variant = 'cloud',
  sparks = true,
  children,
}: {
  variant?: Variant;
  sparks?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.fill, { backgroundColor: BASE[variant] }]}>
      {LAYERS[variant].map((l, i) => (
        <LinearGradient
          key={i}
          pointerEvents="none"
          colors={l.colors as [string, string, ...string[]]}
          start={l.start}
          end={l.end}
          style={StyleSheet.absoluteFill}
        />
      ))}
      {sparks ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {SPARKS.map((s, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                top: s.top as `${number}%`,
                left: s.left as `${number}%`,
                width: s.size,
                height: s.size,
                borderRadius: s.size,
                backgroundColor: 'rgba(255,246,196,0.9)',
                shadowColor: '#FFE9A8',
                shadowOpacity: 0.9,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              }}
            />
          ))}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const BASE: Record<Variant, string> = {
  cloud: '#C6C6E8',
  iridescent: '#BFD0EE',
  coral: '#F3B3B0',
};

type Grad = { colors: string[]; start: { x: number; y: number }; end: { x: number; y: number } };
const LAYERS: Record<Variant, Grad[]> = {
  cloud: [
    { colors: ['#AEC3E8', '#C9C2E6', '#E8C6D0', '#F5D9BE'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
    { colors: ['rgba(255,214,170,0.6)', 'rgba(255,214,170,0)'], start: { x: 1, y: 0 }, end: { x: 0.2, y: 0.55 } },
    { colors: ['rgba(174,195,232,0)', 'rgba(158,178,224,0.55)'], start: { x: 0, y: 0.45 }, end: { x: 0, y: 1 } },
  ],
  iridescent: [
    { colors: ['#B8D2F0', '#C9C3EC', '#D9C4E4', '#C7E6DE'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
    { colors: ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)', 'rgba(180,220,255,0.35)'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
    { colors: ['rgba(233,198,224,0)', 'rgba(233,198,224,0.5)', 'rgba(199,230,222,0)'], start: { x: 1, y: 0 }, end: { x: 0, y: 1 } },
  ],
  coral: [
    { colors: ['#F7C0B4', '#F3AFB0', '#EBA6AE'], start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
    { colors: ['rgba(255,180,150,0.7)', 'rgba(255,180,150,0)'], start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 0.7 } },
    { colors: ['rgba(255,244,214,0)', 'rgba(255,244,214,0.55)', 'rgba(255,244,214,0)'], start: { x: 0.72, y: 0 }, end: { x: 0.78, y: 1 } },
  ],
};

// HOC mirror of the other backdrops, for tab-like glass screens.
export function withAmbientBackground<P extends object>(
  Screen: React.ComponentType<P>,
  variant: Variant = 'cloud'
): React.ComponentType<P> {
  function ScreenWithAmbient(props: P) {
    return (
      <AmbientBackground variant={variant}>
        <Screen {...props} />
      </AmbientBackground>
    );
  }
  ScreenWithAmbient.displayName = `withAmbientBackground(${Screen.displayName || Screen.name || 'Screen'})`;
  return ScreenWithAmbient;
}

const styles = StyleSheet.create({
  borderLight: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },
  borderDark: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  glassLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
    color: 'rgba(0,0,0,0.5)',
  },
  glassFieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glassFieldLeft: {
    paddingLeft: 14,
  },
  glassInput: {
    flex: 1,
    color: '#0A0A0A',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  fill: {
    flex: 1,
    overflow: 'hidden',
  },
});
