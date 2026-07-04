import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../lib/theme';

// The app-wide backdrop: deep plum with a faint dusk glow bleeding in from
// the top and two soft brand orbs. Static (no animation) so scroll
// performance stays flat; the animated version lives in AuroraBackground
// for the onboarding flow.
export function ScreenBackground({ children }: { children?: React.ReactNode }) {
  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={['rgba(232,146,124,0.16)', 'rgba(183,110,155,0.10)', 'rgba(23,17,41,0)']}
        locations={[0, 0.45, 1]}
        style={styles.glow}
        pointerEvents="none"
      />
      <View style={[styles.orb, styles.orbPink]} pointerEvents="none" />
      <View style={[styles.orb, styles.orbViolet]} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.14,
  },
  orbPink: {
    width: 220,
    height: 220,
    right: -70,
    top: -60,
    backgroundColor: '#FF4FD8',
  },
  orbViolet: {
    width: 180,
    height: 180,
    left: -60,
    top: 180,
    backgroundColor: '#8B5CF6',
  },
});
