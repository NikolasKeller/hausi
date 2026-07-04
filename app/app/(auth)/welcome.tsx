import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuroraBackground } from '../../components/AuroraBackground';
import { Seal } from '../../components/partiful';
import { Button } from '../../components/ui';
import { display, kicker, uiText } from '../../lib/fonts';
import { brand, light, radius, shadow, spacing } from '../../lib/theme';

// react-native-web has no native driver; silence its fallback warning.
const useNativeDriver = Platform.OS !== 'web';

interface BubbleSpec {
  text: string;
  left: number; // percent within the bubble layer
  top: number; // percent within the bubble layer
  rotate: string;
  delay: number;
  duration: number;
  drift: number;
  variant: 'chat' | 'tag';
  tail?: 'left' | 'right';
}

// A few floating chat bubbles kept in the top third of the screen — just enough
// to hint at the group-chat energy without crowding. Deterministic percents
// (tuned for ~390x844) chosen so nothing overlaps a neighbour or the wordmark
// below.
const BUBBLES: BubbleSpec[] = [
  { text: 'you coming tonight? 👀', left: 5, top: 14, rotate: '-6deg', delay: 0, duration: 3200, drift: 10, variant: 'chat', tail: 'left' },
  { text: 'so excited 🥳', left: 58, top: 11, rotate: '8deg', delay: 500, duration: 3600, drift: 9, variant: 'chat', tail: 'right' },
  { text: 'House Party', left: 62, top: 42, rotate: '7deg', delay: 900, duration: 4000, drift: 8, variant: 'tag' },
  { text: "who's bringing the aux? 🎧", left: 6, top: 52, rotate: '-4deg', delay: 300, duration: 3000, drift: 10, variant: 'chat', tail: 'left' },
];

function FloatingBubble({ spec }: { spec: BubbleSpec }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(spec.delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: spec.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: spec.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, spec.delay, spec.duration]);

  const isChat = spec.variant === 'chat';
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bubble,
        isChat ? styles.chatBubble : styles.tagBubble,
        isChat && spec.tail === 'left' && styles.tailLeft,
        isChat && spec.tail === 'right' && styles.tailRight,
        {
          left: `${spec.left}%`,
          top: `${spec.top}%`,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -spec.drift],
              }),
            },
            { rotate: spec.rotate },
          ],
        },
      ]}
    >
      <Text style={isChat ? styles.chatText : styles.tagText}>{spec.text}</Text>
    </Animated.View>
  );
}

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
      <View pointerEvents="none" style={styles.bubbleLayer}>
        {BUBBLES.map((spec) => (
          <FloatingBubble key={spec.text} spec={spec} />
        ))}
      </View>

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
          <Seal size={72} color={brand.party[1]} rotate={-10} style={styles.seal}>
            <Text style={styles.house}>🏠</Text>
          </Seal>
          <Text style={styles.kicker}>You're invited</Text>
          <Text style={styles.wordmark}>Hausi</Text>
          <Text style={styles.tagline}>Parties worth showing up for</Text>
        </Animated.View>

        <View style={{ height: spacing.xl + spacing.sm }} />

        <Button title="Get started" variant="primary" onPress={() => router.push('/phone')} />
        <Text style={styles.footnote}>Takes 30 seconds. No email needed ✨</Text>
        {__DEV__ ? (
          <Text style={styles.devLink} onPress={() => router.push('/dev-login')}>
            🛠 Skip auth — continue as Preview (dev only)
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
    paddingBottom: spacing.sm,
  },
  bubbleLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
  },
  bubble: {
    position: 'absolute',
  },
  chatBubble: {
    backgroundColor: light.paper,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: light.ink,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...shadow.card,
  },
  tailLeft: {
    borderBottomLeftRadius: 4,
  },
  tailRight: {
    borderBottomRightRadius: 4,
  },
  chatText: {
    color: light.text,
    ...uiText(13, '700'),
  },
  tagBubble: {
    backgroundColor: light.paper,
    borderWidth: 2,
    borderColor: light.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    ...shadow.card,
  },
  tagText: {
    color: light.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  brand: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  seal: {
    marginBottom: spacing.xs,
  },
  house: {
    fontSize: 34,
  },
  kicker: {
    ...kicker(light.text2),
  },
  wordmark: {
    color: light.text,
    ...display(96),
  },
  tagline: {
    color: light.text2,
    ...uiText(18, '500'),
  },
  footnote: {
    color: light.text3,
    ...uiText(12, '500'),
    textAlign: 'center',
    marginTop: spacing.sm + 2,
  },
  devLink: {
    color: light.muted,
    ...uiText(12, '500'),
    textAlign: 'center',
    marginTop: spacing.md,
    textDecorationLine: 'underline',
  },
});
