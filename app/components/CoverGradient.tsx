import React from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { mediaUrl } from '../lib/api';
import { coverFor } from '../lib/covers';
import { eventVisual } from '../lib/eventVisual';
import type { Category } from '../shared/types';

// Every cover sits on the app's paper design background. Real uploaded /
// generated cover photos show their image; without one, callers can pass
// `fallback` so the cover renders the event's emoji treatment instead of a
// blank sheet of paper (which read as a broken image on cards). Title text on
// a paper cover must be dark — callers pick the colour based on whether
// `image` is set.
const PAPER = require('../assets/paper-texture.png');

interface Props {
  // Kept for call-site compatibility; the paper background ignores it.
  theme?: string;
  style?: ViewStyle;
  children?: React.ReactNode;
  // Optional uploaded cover photo (path like "/uploads/x.jpg" or full URL).
  image?: string | null;
  // Drives the designed emoji fallback when there is no photo. Omit it to
  // keep the plain paper (e.g. tiny thumbnails where emojis would clutter).
  fallback?: { title: string; description?: string; category?: Category };
}

export function CoverGradient({ style, children, image, fallback }: Props) {
  const uri = mediaUrl(image);
  const visual =
    !uri && fallback
      ? eventVisual(fallback.title, fallback.description ?? '', fallback.category ?? 'other')
      : null;
  return (
    <View style={[styles.base, style]}>
      <Image source={PAPER} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {uri ? (
        <>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {/* Scrim keeps overlaid title text legible on bright photos. */}
          <View style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="none" />
        </>
      ) : visual ? (
        <View style={styles.fallback} pointerEvents="none">
          {/* Soft tint pulled from the event's theme so the paper feels
              art-directed for THIS event, not empty. */}
          <View
            style={[
              styles.fallbackGlow,
              { backgroundColor: `${coverFor(visual.theme).colors[3]}2E` },
            ]}
          />
          <Text style={styles.fallbackEmojiSide}>{visual.emojis[0]}</Text>
          <Text style={styles.fallbackEmojiCenter}>{visual.emojis[1]}</Text>
          <Text style={styles.fallbackEmojiSide}>{visual.emojis[2]}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  fallbackGlow: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
  },
  fallbackEmojiCenter: { fontSize: 44 },
  fallbackEmojiSide: { fontSize: 24, opacity: 0.85 },
});
