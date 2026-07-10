import React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

// A metallic silver headline that stays pixel-sharp on every platform.
//
// The earlier MaskedView + LinearGradient version looked soft in Expo Go: the
// text mask is rasterised (and the grounding drop-shadow added a halo), so the
// letters blurred. Sharpness/legibility matter more than a literal gradient, so
// large headlines now use native text rendering with a solid steel colour plus
// a crisp 1px light bevel (a hard highlight, radius 0 — no blur). It reads as
// brushed metal while staying perfectly crisp. API is unchanged.
export function ChromeText({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
}) {
  return (
    <Text style={[style, styles.metalOverride]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  // Applied AFTER the caller's style so the metal colour + crisp bevel win,
  // while size/font/tracking from the caller are preserved.
  metalOverride: {
    color: '#D9DDE4', // polished silver — metallic, high-contrast on midnight
    // Hard 1px dark cut below each stroke → embossed metal, no blur.
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
});
