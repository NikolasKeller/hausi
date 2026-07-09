import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../lib/theme';

// The ambient event-photo backdrop every milky glass card floats over — a
// moody, blurred nightlife shot (crowd + bokeh light) rather than a flat
// black canvas, so the frosted cards actually have something to refract.
// A dark scrim keeps foreground text legible over the busiest parts of the
// photo without flattening it into black.
const EVENT_BG = require('../assets/brand/event-bg-blur.png');

export function ScreenBackground({
  children,
  bloom = true,
}: {
  children?: React.ReactNode;
  bloom?: boolean;
}) {
  return (
    <View style={styles.fill}>
      <Image source={EVENT_BG} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.55)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      {bloom ? (
        <LinearGradient
          colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0)']}
          locations={[0, 0.45, 1]}
          style={styles.bloom}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  );
}

// Wraps a screen so it carries its own opaque backdrop. On web the tab
// navigator stacks every mounted tab with position:absolute and only lifts the
// focused one to the top (zIndex 0) — the others sit at zIndex -1 directly
// behind it. A transparent scene therefore lets the blurred tabs bleed through;
// giving each scene an opaque ScreenBackground makes the focused tab fully
// occlude them, independent of the react-native-screens web shim.
export function withScreenBackground<P extends object>(
  Screen: React.ComponentType<P>,
  opts?: { bloom?: boolean }
): React.ComponentType<P> {
  function ScreenWithBackground(props: P) {
    return (
      <ScreenBackground bloom={opts?.bloom}>
        <Screen {...props} />
      </ScreenBackground>
    );
  }
  ScreenWithBackground.displayName = `withScreenBackground(${
    Screen.displayName || Screen.name || 'Screen'
  })`;
  return ScreenWithBackground;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  bloom: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
});
