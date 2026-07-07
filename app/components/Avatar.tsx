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
function colorFor(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  let hash = 0;
  for (let i = 0; i < first.length; i++) {
    hash = (hash * 31 + first.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

// A user face: their uploaded photo when they have one, otherwise their
// initials on a colored circle. If the photo fails to load (deleted upload,
// offline), fall back to initials rather than leaving a blank circle.
export function Avatar({
  name,
  image,
  size = 36,
}: {
  name: string;
  image?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);

  const round = { width: size, height: size, borderRadius: size / 2 };
  const showImage = !!image && !failed;
  return (
    <View
      style={[styles.circle, round, !showImage && { backgroundColor: colorFor(name) }]}
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
});
