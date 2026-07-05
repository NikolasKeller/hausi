import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { mediaUrl } from '../lib/api';
import { colors } from '../lib/theme';

// A user face: their uploaded photo when they have one, otherwise their emoji.
// If the photo fails to load (deleted upload, offline), fall back to the emoji
// rather than leaving a blank circle.
export function Avatar({
  emoji,
  image,
  size = 36,
}: {
  emoji: string;
  image?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);

  const round = { width: size, height: size, borderRadius: size / 2 };
  const showImage = !!image && !failed;
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
        <Text style={{ fontSize: size * 0.6 }}>{emoji}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    // Calm warm-white chip with a soft 1px hairline — quiet, no heavy black ring.
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
