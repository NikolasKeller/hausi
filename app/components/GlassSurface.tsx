import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

// ── GlassSurface ──────────────────────────────────────────────────────────────
// True frosted-glass primitive tuned to the designshot recipe: translucent
// fill + backdrop blur + light border + soft drop shadow + inset catch-light.
// On web we apply CSS backdrop-filter directly (expo-blur caps blur too low).
export function GlassSurface({
  radius = 24,
  blur = 28,
  fill = 'rgba(255,255,255,0.10)',
  borderColor = 'rgba(255,255,255,0.28)',
  shadow = true,
  style,
  children,
}: {
  radius?: number;
  blur?: number;
  fill?: string;
  borderColor?: string;
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  if (Platform.OS === 'web') {
    const webGlass = {
      backgroundColor: fill,
      backdropFilter: `blur(${blur}px) saturate(170%)`,
      WebkitBackdropFilter: `blur(${blur}px) saturate(170%)`,
      boxShadow: shadow
        ? 'inset 0 1px 0 rgba(255,255,255,0.32), inset 1px 0 0 rgba(255,255,255,0.10), 0 12px 40px rgba(0,0,0,0.35)'
        : 'inset 0 1px 0 rgba(255,255,255,0.32)',
    } as unknown as ViewStyle;
    return (
      <View
        style={[
          {
            borderRadius: radius,
            borderWidth: 1,
            borderColor,
            overflow: 'hidden',
          },
          webGlass,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <View
      style={[
        {
          borderRadius: radius,
          borderWidth: 1,
          borderColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <BlurView intensity={Math.min(blur * 3, 100)} tint="default" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      {children}
    </View>
  );
}
