import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../lib/theme';

// Partiful auth backdrop: a near-black canvas with a soft violet→pink bloom
// falling from the top — the app's lit, nightlife feel. The `confetti` prop is
// kept for API compatibility with callers but no longer renders anything.
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
        colors={['rgba(139,92,246,0.28)', 'rgba(255,79,216,0.08)', 'rgba(17,17,17,0)']}
        locations={[0, 0.55, 1]}
        style={styles.washTop}
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
  washTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 520,
  },
});
