import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../lib/theme';

// Auth backdrop: near-black with the app's violet top bloom. The `confetti`
// prop is kept for API compatibility with callers but no longer renders
// anything.
export function AuroraBackground({
  children,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  confetti = true,
}: {
  children?: React.ReactNode;
  confetti?: boolean;
}) {
  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={['rgba(124,82,222,0.55)', 'rgba(94,58,180,0.22)', 'rgba(12,12,14,0)']}
        locations={[0, 0.45, 1]}
        style={styles.bloom}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  bloom: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
});
