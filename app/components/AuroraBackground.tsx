import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../lib/theme';

// Auth backdrop: a flat near-black canvas. The `confetti` prop is kept for API
// compatibility with callers but no longer renders anything.
export function AuroraBackground({
  children,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  confetti = true,
}: {
  children?: React.ReactNode;
  confetti?: boolean;
}) {
  return <View style={styles.fill}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
});
