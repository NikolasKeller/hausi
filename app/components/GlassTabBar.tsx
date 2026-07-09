import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../lib/theme';
import { uiText } from '../lib/fonts';

// Minimal shape of the props expo-router / react-navigation hands a custom
// tabBar. Typed loosely to avoid a hard dependency on the navigator's types.
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        href?: unknown;
        tabBarIcon?: (a: { color: string; focused: boolean; size: number }) => React.ReactNode;
      };
    }
  >;
  navigation: {
    navigate: (name: string) => void;
    emit: (e: { type: string; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
  };
};

const SPRING = { useNativeDriver: true, friction: 9, tension: 90 };

// A rounded, floating tab bar with a translucent "bubble" that glides to the
// active tab — and, while dragging horizontally, follows the finger, clamped
// to the bar so it can never slip past the edges.
export function GlassTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  // Only real destinations live in the bar: "index" is just the hidden
  // "/" → /explore redirect, never a tab.
  const barRoutes = state.routes.filter(
    (r) =>
      r.name !== 'index' &&
      descriptors[r.key]?.options?.href !== null
  );
  const count = barRoutes.length;

  const [rowWidth, setRowWidth] = useState(0);
  const rowLeft = useRef(0);
  const rowRef = useRef<View>(null);
  const translateX = useRef(new Animated.Value(0)).current;
  const dragging = useRef(false);

  const tabWidth = rowWidth ? rowWidth / count : 0;

  const activeKey = state.routes[state.index]?.key;
  const activeIndex = Math.max(0, barRoutes.findIndex((r) => r.key === activeKey));

  // Latest layout/nav values for the PanResponder, which is created once and
  // would otherwise close over stale values.
  const latest = useRef({ tabWidth, rowWidth, count, barRoutes, activeIndex, navigation });
  latest.current = { tabWidth, rowWidth, count, barRoutes, activeIndex, navigation };

  // Settle the bubble under the active tab whenever it changes (unless a drag
  // is currently driving it).
  useEffect(() => {
    if (dragging.current || !tabWidth) return;
    Animated.spring(translateX, { ...SPRING, toValue: activeIndex * tabWidth }).start();
  }, [activeIndex, tabWidth, translateX]);

  const pan = useRef(
    PanResponder.create({
      // Let taps through to the buttons; only claim clearly-horizontal drags.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        dragging.current = true;
      },
      onPanResponderMove: (_e, g) => {
        const { tabWidth: tw, rowWidth: rw } = latest.current;
        if (!tw) return;
        const x = g.moveX - rowLeft.current; // finger position within the bar
        const center = Math.max(tw / 2, Math.min(x, rw - tw / 2));
        translateX.setValue(center - tw / 2);
      },
      onPanResponderRelease: (_e, g) => {
        const { tabWidth: tw, count: c, barRoutes: br, activeIndex: ai, navigation: nav } = latest.current;
        dragging.current = false;
        if (!tw) return;
        const x = g.moveX - rowLeft.current;
        let idx = Math.round((x - tw / 2) / tw);
        idx = Math.max(0, Math.min(idx, c - 1));
        Animated.spring(translateX, { ...SPRING, toValue: idx * tw }).start();
        const route = br[idx];
        if (route && idx !== ai) nav.navigate(route.name);
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
        const { tabWidth: tw, activeIndex: ai } = latest.current;
        if (tw) Animated.spring(translateX, { ...SPRING, toValue: ai * tw }).start();
      },
    })
  ).current;

  function onRowLayout(e: LayoutChangeEvent) {
    setRowWidth(e.nativeEvent.layout.width);
    rowRef.current?.measureInWindow((x) => {
      rowLeft.current = x;
    });
  }

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + spacing.sm }]}>
      <BlurView intensity={70} tint="dark" style={styles.bar}>
        <View pointerEvents="none" style={styles.barFill} />
        <View
          ref={rowRef}
          style={styles.row}
          onLayout={onRowLayout}
          {...pan.panHandlers}
        >
          {tabWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.bubble,
                { width: tabWidth, transform: [{ translateX }] },
              ]}
            />
          ) : null}

          {barRoutes.map((route) => {
            const { options } = descriptors[route.key];
            const focused = route.key === activeKey;
            const color = focused ? colors.ink : colors.muted;
            const label = options.title ?? route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };

            return (
              <Pressable key={route.key} onPress={onPress} style={styles.tab}>
                {options.tabBarIcon?.({ color, focused, size: 22 })}
                <Text style={[styles.label, { color }]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

// Flat, edge-to-edge dark bar (the approved "obsidian" direction) — now a
// real frosted-glass blur of whatever scrolls behind it, not a flat fill, so
// it actually reads as glass instead of a painted panel.
const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  bar: {
    paddingTop: 6,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  barFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.55)',
  },
  row: {
    flexDirection: 'row',
    position: 'relative',
  },
  bubble: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: 5,
  },
  label: {
    ...uiText(10, '600'),
  },
});
