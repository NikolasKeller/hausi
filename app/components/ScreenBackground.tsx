import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../lib/theme';

// The app-wide backdrop: a violet "night sky" bleeding down from the top into
// the near-black base, with a magenta aurora leaning in from the top-right for
// depth — the moody, nightlife feel of the reference design. Static (no
// animation) so scroll performance stays flat; the animated version lives in
// AuroraBackground for the onboarding flow.
export function ScreenBackground({ children }: { children?: React.ReactNode }) {
  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={['rgba(210,65,250,0.38)', 'rgba(123,79,255,0.16)', 'rgba(14,11,22,0)']}
        locations={[0, 0.4, 1]}
        style={styles.sky}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(75,123,255,0.26)', 'rgba(75,123,255,0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.1, y: 0.7 }}
        style={styles.aurora}
        pointerEvents="none"
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
  Screen: React.ComponentType<P>
): React.ComponentType<P> {
  function ScreenWithBackground(props: P) {
    return (
      <ScreenBackground>
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
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 460,
  },
  aurora: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
});
