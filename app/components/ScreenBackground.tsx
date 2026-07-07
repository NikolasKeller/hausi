import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../lib/theme';

// The app-wide backdrop: a flat near-black base.
export function ScreenBackground({ children }: { children?: React.ReactNode }) {
  return <View style={styles.fill}>{children}</View>;
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
});
