import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuroraBackground } from '../../components/AuroraBackground';
import { Button } from '../../components/ui';
import { display, kicker, uiText } from '../../lib/fonts';
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
          <Text style={styles.kicker}>You're invited</Text>
          <Text style={styles.wordmark}>Hausi</Text>
          <Text style={styles.tagline}>Parties worth showing up for</Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Button title="Get started" variant="primary" onPress={() => router.push('/phone')} />
        <Text style={styles.footnote}>Takes 30 seconds. No email needed.</Text>
        {__DEV__ ? (
          <Text style={styles.devLink} onPress={() => router.push('/dev-login')}>
            Skip auth — continue as Preview (dev only)
          </Text>
        ) : null}
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
  kicker: {
    ...kicker(colors.muted),
  },
  wordmark: {
    color: colors.text,
    ...display(96),
  },
  tagline: {
    color: colors.muted,
    ...uiText(18, '400'),
    textAlign: 'center',
  },
  footnote: {
    color: colors.muted,
    ...uiText(13, '400'),
    textAlign: 'center',
    marginTop: spacing.md,
  },
  devLink: {
    color: colors.muted,
    ...uiText(12, '400'),
    textAlign: 'center',
    marginTop: spacing.lg,
    textDecorationLine: 'underline',
  },
});
