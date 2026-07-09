import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../lib/theme';

const NIGHT = require('../assets/nightlife-bokeh.jpg');

// Auth backdrop: the same full-bleed nightlife bokeh as the rest of the app.
// The `confetti` prop is kept for API compatibility with callers but no longer
// renders anything.
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
      <Image source={NIGHT} style={StyleSheet.absoluteFill} resizeMode="cover" />
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
});
