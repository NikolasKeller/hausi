import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../lib/theme';

// The nightlife ambience the whole app sits on — a generated midnight-blue
// backdrop with soft out-of-focus city/stage lights (amber + cool blue bokeh).
const NIGHT = require('../assets/nightlife-bokeh.jpg');

// Fine grain layered over the scrim so the darkened area reads as a textured
// surface instead of a flat colour block.
const PAPER = require('../assets/paper-texture.png');

// The app-wide backdrop: a full-bleed bokeh image over a matching flat
// fallback. The bokeh stays ambient up top but settles into a calm, grainy
// gradient toward the bottom — bright warm lights near the tab bar used to
// read like a photo bleeding under the content. `bloom` is kept for call-site
// compatibility; the backdrop already carries its own light.
export function ScreenBackground({
  children,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  bloom = true,
}: {
  children?: React.ReactNode;
  bloom?: boolean;
}) {
  return (
    <View style={styles.fill}>
      <Image source={NIGHT} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {/* Ambient-to-calm gradient. Deliberately lighter than a full scrim so
          the bokeh keeps breathing through the lower half — a near-opaque
          bottom read as one solid colour block. */}
      <LinearGradient
        colors={['rgba(8,11,22,0)', 'rgba(8,11,22,0.42)', 'rgba(8,11,22,0.80)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Image
        source={PAPER}
        style={[StyleSheet.absoluteFill, styles.grain]}
        resizeMode="cover"
      />
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
  grain: {
    opacity: 0.05,
  },
});
