import React from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { mediaUrl } from '../lib/api';

// Every cover now sits on the app's paper design background. Real uploaded /
// scraped cover photos still show their image; the "no image" case is the calm
// paper stock (no more coloured random gradients). Title text on a paper cover
// must be dark — callers pick the colour based on whether `image` is set.
const PAPER = require('../assets/paper-texture.png');

interface Props {
  // Kept for call-site compatibility; the paper background ignores it.
  theme?: string;
  style?: ViewStyle;
  children?: React.ReactNode;
  // Kept for call-site compatibility (emoji scatter is gone).
  emojiOpacity?: number;
  // Optional uploaded cover photo (path like "/uploads/x.jpg" or full URL).
  image?: string | null;
}

export function CoverGradient({ style, children, image }: Props) {
  const uri = mediaUrl(image);
  return (
    <View style={[styles.base, style]}>
      <Image source={PAPER} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {uri ? (
        <>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {/* Scrim keeps overlaid title text legible on bright photos. */}
          <View style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="none" />
        </>
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
});
