import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuroraBackground } from '../../components/AuroraBackground';
import { radius, spacing } from '../../lib/theme';

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

// Deterministic, percent-based layout tuned for a ~390x844 screen so the
// bubbles read as a lively group chat without piling on top of each other.
const BUBBLES: BubbleSpec[] = [
  { text: 'you coming tonight? 👀', left: 5, top: 9, rotate: '-8deg', delay: 0, duration: 2800, drift: 12, variant: 'chat', tail: 'left' },
  { text: 'so excited 🥳', left: 60, top: 5, rotate: '10deg', delay: 500, duration: 3400, drift: 10, variant: 'chat', tail: 'right' },
  { text: 'omw!!', left: 38, top: 21, rotate: '-12deg', delay: 1100, duration: 2600, drift: 14, variant: 'chat', tail: 'left' },
  { text: 'Happy Hour', left: 73, top: 22, rotate: '14deg', delay: 300, duration: 3800, drift: 8, variant: 'tag' },
  { text: "look who's on the guest list", left: 4, top: 36, rotate: '5deg', delay: 800, duration: 3200, drift: 11, variant: 'chat', tail: 'left' },
  { text: 'bring your +1 💅', left: 55, top: 45, rotate: '-7deg', delay: 1400, duration: 3000, drift: 13, variant: 'chat', tail: 'right' },
  { text: 'Dinner Party', left: 8, top: 52, rotate: '-10deg', delay: 1700, duration: 3600, drift: 9, variant: 'tag' },
  { text: 'House Party', left: 70, top: 60, rotate: '6deg', delay: 900, duration: 4200, drift: 8, variant: 'tag' },
  { text: 'party wall is popping 🔥', left: 10, top: 64, rotate: '3deg', delay: 200, duration: 3300, drift: 10, variant: 'chat', tail: 'left' },
  { text: "who's bringing the aux? 🎧", left: 45, top: 78, rotate: '9deg', delay: 600, duration: 2900, drift: 12, variant: 'chat', tail: 'right' },
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
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: spec.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
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
      useNativeDriver: true,
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
          <Text style={styles.house}>🏠</Text>
          <Text style={styles.wordmark}>Hausi</Text>
          <Text style={styles.tagline}>Parties worth showing up for</Text>
        </Animated.View>

        <View style={{ height: spacing.xl + spacing.sm }} />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/phone')}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>Get started</Text>
        </Pressable>
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
    height: '58%',
  },
  bubble: {
    position: 'absolute',
  },
  chatBubble: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#1B1030',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  tailLeft: {
    borderBottomLeftRadius: 4,
  },
  tailRight: {
    borderBottomRightRadius: 4,
  },
  chatText: {
    color: '#2A1E4F',
    fontSize: 13,
    fontWeight: '600',
  },
  tagBubble: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    color: 'rgba(247,245,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  house: {
    fontSize: 56,
  },
  wordmark: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '800',
    letterSpacing: -2,
    textShadowColor: 'rgba(255,122,224,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  tagline: {
    color: 'rgba(247,245,255,0.85)',
    fontSize: 17,
    fontWeight: '500',
  },
  cta: {
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    color: '#241B3A',
    fontSize: 17,
    fontWeight: '800',
  },
  footnote: {
    color: 'rgba(247,245,255,0.6)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm + 2,
  },
  devLink: {
    color: 'rgba(247,245,255,0.45)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md,
    textDecorationLine: 'underline',
  },
});
