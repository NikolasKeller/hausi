import React from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { coverFor } from '../lib/covers';
import { mediaUrl } from '../lib/api';

// Deterministic scatter pattern so covers look identical everywhere.
const SCATTER: { top: string; left: string; size: number; rotate: string }[] = [
  { top: '8%', left: '6%', size: 44, rotate: '-15deg' },
  { top: '18%', left: '74%', size: 56, rotate: '12deg' },
  { top: '46%', left: '14%', size: 36, rotate: '8deg' },
  { top: '58%', left: '82%', size: 40, rotate: '-10deg' },
  { top: '72%', left: '38%', size: 52, rotate: '18deg' },
  { top: '30%', left: '44%', size: 32, rotate: '-6deg' },
];

interface Props {
  theme: string;
  style?: ViewStyle;
  children?: React.ReactNode;
  emojiOpacity?: number;
  // Optional uploaded cover photo (path like "/uploads/x.jpg" or full URL).
  // When set, it replaces the emoji scatter; the gradient stays as a fallback
  // background while the image loads.
  image?: string | null;
  // Darkens photos with a scrim so overlaid title text stays legible. Cards
  // with no text on top of the image (title shown below instead) skip it —
  // the photo is the whole point, no need to mute it.
  dim?: boolean;
}

export function CoverGradient({
  theme,
  style,
  children,
  emojiOpacity = 0.45,
  image,
  dim = true,
}: Props) {
  const cover = coverFor(theme);
  const uri = mediaUrl(image);
  return (
    <LinearGradient
      colors={cover.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.base, style]}
    >
      {uri ? (
        <>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {dim ? <View style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="none" /> : null}
        </>
      ) : emojiOpacity > 0 ? (
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
      ) : null}
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
});
