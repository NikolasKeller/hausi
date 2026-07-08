import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { mediaUrl } from '../lib/api';
import { colors } from '../lib/theme';

// Up to two uppercase letters pulled from a name — the first letter of the
// first two words, or the first two letters of a single word.
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// A stable background color per person. Keyed off the first letter only so the
// color doesn't flicker on every keystroke while someone types their name — it
// locks in as soon as the first character is entered.
// A stable background color per person. Chrome variant uses neutral silver
// tones to match the glassmorphism palette; default keeps saturated HSL.
function colorFor(name: string, chrome = false): string {
  if (chrome) {
    const first = name.trim().charAt(0).toUpperCase();
    const shades = ['#2A2A2A', '#333333', '#3D3D3D', '#474747', '#525252'];
    return shades[(first.charCodeAt(0) || 65) % shades.length];
  }
  const first = name.trim().charAt(0).toUpperCase();
  let hash = 0;
  for (let i = 0; i < first.length; i++) {
    hash = (hash * 31 + first.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

export function Avatar({
  name,
  image,
  size = 36,
  variant = 'default',
}: {
  name: string;
  image?: string | null;
  size?: number;
  variant?: 'default' | 'chrome';
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);

  const round = { width: size, height: size, borderRadius: size / 2 };
  const showImage = !!image && !failed;
  const chrome = variant === 'chrome';
  return (
    <View
      style={[
        styles.circle,
        round,
        !showImage && { backgroundColor: colorFor(name, chrome) },
        chrome && styles.chromeCircle,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: mediaUrl(image!) }}
          style={round}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
  },
  chromeCircle: {
    borderColor: 'rgba(255,255,255,0.22)',
  },
});
