import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuroraBackground } from '../../components/AuroraBackground';
import { Button } from '../../components/ui';
import { display, uiText } from '../../lib/fonts';
import { colors, spacing } from '../../lib/theme';

// react-native-web has no native driver; silence its fallback warning.
const useNativeDriver = Platform.OS !== 'web';

export default function WelcomeScreen() {
  const router = useRouter();
  const intro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(intro, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
  }, [intro]);

  return (
    <AuroraBackground>
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1 }} />

        <Animated.View
          style={[
            styles.brand,
            {
              opacity: intro,
              transform: [
                {
                  translateY: intro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.wordmark}>Now</Text>
          <Text style={styles.tagline}>Parties worth showing up for</Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Button title="Get started" variant="primary" onPress={() => router.push('/phone')} />
      </SafeAreaView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.md,
  },
  wordmark: {
    color: colors.text,
    ...display(96),
    // Warm orange bloom behind the white wordmark — the glowing look.
    textShadowColor: 'rgba(255,106,43,0.65)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 28,
  },
  tagline: {
    color: colors.muted,
    ...uiText(18, '400'),
    textAlign: 'center',
  },
});
