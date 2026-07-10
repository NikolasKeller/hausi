import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { mediaUrl } from '../lib/api';
import { colors } from '../lib/theme';
import { ChromeInitials } from './ChromeInitials';
import { GLYPH_SOURCES } from '../lib/liquidChromeGlyphs';

// Up to two letters pulled from a name — first letter of the first two words,
// or the first two letters of a single word. Lowercased for Liquid Chrome.
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const raw =
    words.length === 1
      ? words[0].slice(0, 2)
      : words[0][0] + words[words.length - 1][0];
  const chrome = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  return chrome.slice(0, 2) || '?';
}

// Curated complementary pairs for avatar circles — each background is a deep
// hue with its wheel complement so every face reads as a harmonious duo.
const PALETTES: { a: string; b: string }[] = [
  { a: '#1E3A5F', b: '#5F3F1E' }, // steel blue ↔ copper
  { a: '#2E1F4A', b: '#3F4A1F' }, // violet ↔ olive
  { a: '#1A3D3A', b: '#3D1A2A' }, // teal ↔ plum
  { a: '#3D2A1A', b: '#1A2F3D' }, // rust ↔ slate
  { a: '#1F2E4A', b: '#4A3A1F' }, // midnight ↔ bronze
  { a: '#2A1A3D', b: '#2A3D1A' }, // grape ↔ moss
  { a: '#1A3340', b: '#40301A' }, // ocean ↔ amber
  { a: '#3D1F2E', b: '#1F3D2E' }, // wine ↔ forest
  { a: '#2B2048', b: '#484820' }, // indigo ↔ gold-green
  { a: '#1F3D4A', b: '#4A2B1F' }, // cyan-deep ↔ terracotta
];

// Stable palette per person — keyed off the first letter so the colors don't
// flicker while someone types their name during onboarding.
function paletteFor(name: string): { a: string; b: string } {
  const first = name.trim().charAt(0).toUpperCase();
  let hash = 0;
  for (let i = 0; i < first.length; i++) {
    hash = (hash * 31 + first.charCodeAt(i)) | 0;
  }
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

function hasChromeGlyphs(text: string): boolean {
  return text.split('').some((ch) => GLYPH_SOURCES[ch.toLowerCase()]);
}

// A user face: uploaded photo when available, otherwise chrome PNG initials
// on a complementary gradient circle.
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
  const letters = initials(name);
  const chrome = hasChromeGlyphs(letters);
  const pair = paletteFor(name);

  return (
    <View style={[styles.circle, round]}>
      {showImage ? (
        <Image
          source={{ uri: mediaUrl(image!) }}
          style={round}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <LinearGradient
          colors={[pair.a, pair.b]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, round]}
        >
          <View style={styles.initialsWrap}>
            {chrome ? (
              <ChromeInitials text={letters} size={size} />
            ) : (
              <Text style={[styles.fallbackInitials, { fontSize: size * 0.4 }]}>
                {letters.toUpperCase()}
              </Text>
            )}
          </View>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initialsWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
  },
  fallbackInitials: {
    color: '#ECECEC',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
