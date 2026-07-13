import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const useNativeDriver = Platform.OS !== 'web';

// The favorite heart: fills with an overshooting pop (shrink, then spring past
// full size and settle) — the little bounce native like-buttons have. Callers
// own the Pressable and the optimistic state; this only draws and animates.
export function AnimatedHeart({
  active,
  size,
  activeColor,
  inactiveColor,
}: {
  active: boolean;
  size: number;
  activeColor: string;
  inactiveColor: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  // Animate on changes only — a card scrolling into view shouldn't pop.
  const prev = useRef(active);

  useEffect(() => {
    if (prev.current === active) return;
    prev.current = active;
    scale.stopAnimation();
    if (active) {
      scale.setValue(0.35);
      Animated.spring(scale, {
        toValue: 1,
        friction: 3.5,
        tension: 180,
        useNativeDriver,
      }).start();
    } else {
      // Un-favoriting stays quiet: a small dip instead of a celebration.
      scale.setValue(0.8);
      Animated.timing(scale, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver,
      }).start();
    }
  }, [active, scale]);

  return (
    <Animated.View pointerEvents="none" style={{ transform: [{ scale }] }}>
      <Ionicons
        name={active ? 'heart' : 'heart-outline'}
        size={size}
        color={active ? activeColor : inactiveColor}
      />
    </Animated.View>
  );
}
