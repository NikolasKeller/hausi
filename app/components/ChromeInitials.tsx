import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { GLYPH_METRICS, GLYPH_SOURCES } from '../lib/liquidChromeGlyphs';

// Compose initials from the pre-rendered chrome PNG glyphs — the real molten-
// silver texture from liquid-chrome-font, not the flat outline font.
export function ChromeInitials({ text, size }: { text: string; size: number }) {
  const chars = text.toLowerCase().split('').filter((ch) => GLYPH_SOURCES[ch]);
  if (chars.length === 0) return null;

  const base = size * 0.36;
  const spacing = Math.max(-3, Math.round(-base * 0.12));

  return (
    <View style={styles.row}>
      {chars.map((ch, i) => {
        const m = GLYPH_METRICS[ch];
        const height = base * m.h;
        const width = height * m.aspect;
        return (
          <Image
            key={`${ch}-${i}`}
            source={GLYPH_SOURCES[ch]}
            accessibilityLabel={ch}
            style={{
              width,
              height,
              marginBottom: -base * m.dy,
              marginRight: i < chars.length - 1 ? spacing : 0,
            }}
            resizeMode="contain"
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
