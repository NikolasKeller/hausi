import React from 'react';
import { Platform, StyleSheet, Text, type TextStyle, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { chrome, colors } from '../lib/theme';

// A real polished-chrome headline: the text is used as a mask over a vertical
// steel gradient. Reserved for LARGE display type — on small/body text a chrome
// gradient washes out and hurts legibility, so those stay graphite (colors.text).
//
// The gradient's dark middle band keeps big headlines readable on the light
// paper canvas; a faint drop shadow grounds the letters.
export function ChromeText({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
}) {
  const flat = StyleSheet.flatten(style) || {};
  // The mask must be opaque where letters are; colour is irrelevant.
  const maskTextStyle: TextStyle = { ...flat, color: '#000' };
  // The sizing text under the gradient is invisible but reserves the layout.
  const ghostTextStyle: TextStyle = { ...flat, opacity: 0 };

  return (
    <View style={styles.wrap}>
      <MaskedView
        maskElement={
          <Text style={maskTextStyle} numberOfLines={numberOfLines}>
            {children}
          </Text>
        }
      >
        <LinearGradient
          colors={[...chrome]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <Text style={ghostTextStyle} numberOfLines={numberOfLines}>
            {children}
          </Text>
        </LinearGradient>
      </MaskedView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // A soft graphite shadow under the metal so headlines keep an edge on the
    // bright paper (native only; harmless elsewhere).
    ...Platform.select({
      ios: {
        shadowColor: colors.accentDark,
        shadowOpacity: 0.25,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      },
      default: {},
    }),
  },
});
