import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../lib/theme';

// Calm "Known" auth backdrop: a flat warm-linen canvas with a single very soft
// warm bloom falling from the top — no animated orbs, no starburst stickers, no
// confetti. The `confetti` prop is kept for API compatibility with callers but
// no longer renders anything.
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
        colors={['rgba(196,149,106,0.10)', 'rgba(238,234,228,0)']}
        locations={[0, 1]}
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
