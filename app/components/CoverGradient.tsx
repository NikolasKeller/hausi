import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { coverFor } from '../lib/covers';

// Deterministic scatter pattern so covers look identical everywhere.
const SCATTER: { top: string; left: string; size: number; rotate: string }[] = [
  { top: '8%', left: '6%', size: 34, rotate: '-15deg' },
  { top: '18%', left: '74%', size: 44, rotate: '12deg' },
  { top: '46%', left: '14%', size: 28, rotate: '8deg' },
  { top: '58%', left: '82%', size: 30, rotate: '-10deg' },
  { top: '72%', left: '38%', size: 40, rotate: '18deg' },
  { top: '30%', left: '44%', size: 24, rotate: '-6deg' },
];

interface Props {
  theme: string;
  style?: ViewStyle;
  children?: React.ReactNode;
  emojiOpacity?: number;
}

export function CoverGradient({ theme, style, children, emojiOpacity = 0.35 }: Props) {
  const cover = coverFor(theme);
  return (
    <LinearGradient
      colors={cover.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.base, style]}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {SCATTER.map((s, i) => (
          <Text
            key={i}
            style={{
              position: 'absolute',
              top: s.top as `${number}%`,
              left: s.left as `${number}%`,
              fontSize: s.size,
              opacity: emojiOpacity,
              transform: [{ rotate: s.rotate }],
            }}
          >
            {cover.emoji}
          </Text>
        ))}
      </View>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
