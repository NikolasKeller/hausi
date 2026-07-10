import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

// ── GlassSurface ──────────────────────────────────────────────────────────────
// The one true frosted-glass primitive, tuned to the classic glassmorphism
// recipe (fill rgba(255,255,255,~0.1) + backdrop blur 20-32px + saturate
// ~170% + 1px light border + soft drop shadow + inset top catch-light).
//
// Why not just expo-blur? Its web polyfill (a) caps the CSS blur at
// intensity*0.2 px — 20px max — and (b) bakes a tint-proportional opaque wash
// into the surface, so a genuinely transparent, heavily-frosted pane is
// impossible with it on web. On web we therefore apply the real CSS
// backdrop-filter ourselves (react-native-web passes unknown style props
// straight through to the DOM); native keeps BlurView, which is a true
// system blur there.
export function GlassSurface({
  radius = 24,
  blur = 28,
  fill = 'rgba(255,255,255,0.10)',
  borderColor = 'rgba(255,255,255,0.28)',
  // Inset top catch-light + ambient drop shadow (the "lift").
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
        ? // catch-light along the top edge + soft inner left glow + ambient lift
          'inset 0 1px 0 rgba(255,255,255,0.32), inset 1px 0 0 rgba(255,255,255,0.10), 0 12px 40px rgba(0,0,0,0.35)'
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

  // Native: BlurView IS a real system blur, so keep it and layer the same
  // fill + border on top.
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
      <BlurView
        intensity={Math.min(blur * 3, 100)}
        tint="default"
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      {children}
    </View>
  );
}
