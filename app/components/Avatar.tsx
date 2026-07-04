import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';

export function Avatar({ emoji, size = 36 }: { emoji: string; size?: number }) {
  const border = Math.max(2, Math.round(size * 0.08));
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: border,
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.6 }}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    // Bright sticker chip with a heavy black ring so it pops in tight rows.
    backgroundColor: colors.accent,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
