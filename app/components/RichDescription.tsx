import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { DESCRIPTION_SCALE } from '../shared/types';
import { uiText } from '../lib/fonts';

// The description is stored as plain text with two light conventions:
//  • lines beginning with the bullet glyph "• " render as list items with a
//    hanging indent, and
//  • a per-event `scale` (percent) sizes the whole body.
// Everything else is literal text, so previews (feed/explore) can show the raw
// string unchanged and only the event page opts into this richer layout.
export const BULLET = '• ';

const BASE_SIZE = 16;

export function RichDescription({
  text,
  scale = DESCRIPTION_SCALE.default,
  color,
  style,
}: {
  text: string;
  scale?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const size = Math.round((BASE_SIZE * scale) / 100);
  const base: TextStyle = { ...uiText(size, '400', { lineHeight: 1.45 }), color };
  const lines = text.split('\n');
  return (
    <View style={style}>
      {lines.map((line, i) => {
        if (line.startsWith(BULLET)) {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={base}>{'•'}</Text>
              <Text style={[base, styles.bulletText]}>{line.slice(BULLET.length)}</Text>
            </View>
          );
        }
        // Preserve blank lines as vertical space between paragraphs.
        return (
          <Text key={i} style={base}>
            {line === '' ? ' ' : line}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bulletText: {
    flex: 1,
  },
});
