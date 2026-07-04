import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import type { Effect } from '../shared/types';

interface ParticleSpec {
  emoji: string;
  left: number; // percent
  size: number;
  delay: number;
  duration: number;
}

const EFFECT_CONFIG: Record<
  Exclude<Effect, 'none'>,
  { emojis: string[]; motion: 'fall' | 'twinkle' | 'float' }
> = {
  confetti: { emojis: ['🎊', '🎉', '✨', '🎈'], motion: 'fall' },
  sparkles: { emojis: ['✨', '⭐', '💫'], motion: 'twinkle' },
  balloons: { emojis: ['🎈', '🎈', '🎀'], motion: 'float' },
};

// Deterministic particle layout so the same event always looks the same.
function particles(emojis: string[], count: number): ParticleSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    emoji: emojis[i % emojis.length],
    left: (i * 37 + 11) % 92,
    size: 16 + ((i * 13) % 14),
    delay: (i * 450) % 3000,
    duration: 3800 + ((i * 700) % 2400),
  }));
}

function Particle({
  spec,
  motion,
  height,
}: {
  spec: ParticleSpec;
  motion: 'fall' | 'twinkle' | 'float';
  height: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(spec.delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: spec.duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [progress, spec.delay, spec.duration]);

  let style;
  if (motion === 'fall') {
    style = {
      transform: [
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [-30, height + 30],
          }),
        },
        {
          rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
        },
      ],
      opacity: progress.interpolate({
        inputRange: [0, 0.1, 0.9, 1],
        outputRange: [0, 0.9, 0.9, 0],
      }),
    };
  } else if (motion === 'float') {
    style = {
      transform: [
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [height + 30, -40],
          }),
        },
        {
          translateX: progress.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, spec.left % 2 === 0 ? 14 : -14, 0],
          }),
        },
      ],
      opacity: progress.interpolate({
        inputRange: [0, 0.1, 0.9, 1],
        outputRange: [0, 0.85, 0.85, 0],
      }),
    };
  } else {
    style = {
      opacity: progress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.05, 0.9, 0.05],
      }),
      transform: [
        {
          scale: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 1.15, 0.7] }),
        },
      ],
    };
  }

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${spec.left}%`,
          top: motion === 'twinkle' ? `${(spec.left * 7) % 80}%` : 0,
        },
        style,
      ]}
      pointerEvents="none"
    >
      <Text style={{ fontSize: spec.size }}>{spec.emoji}</Text>
    </Animated.View>
  );
}

export function EffectOverlay({ effect, height = 260 }: { effect: string; height?: number }) {
  if (effect === 'none' || !(effect in EFFECT_CONFIG)) return null;
  const config = EFFECT_CONFIG[effect as Exclude<Effect, 'none'>];
  const specs = particles(config.emojis, 10);
  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
      pointerEvents="none"
    >
      {specs.map((spec, i) => (
        <Particle key={i} spec={spec} motion={config.motion} height={height} />
      ))}
    </View>
  );
}
