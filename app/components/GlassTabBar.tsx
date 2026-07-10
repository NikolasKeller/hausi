import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../lib/theme';
import { uiText } from '../lib/fonts';

// The same nightlife backdrop the screens sit on — the bar area continues the
// scene. Anchored to the bottom so the strip shows the same region of the
// image as the bottom of the screens above it.
const NIGHT = require('../assets/nightlife-bokeh.jpg');

// Matching grain so the strip continues the screens' textured bottom edge.
const PAPER = require('../assets/paper-texture.png');

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
  const router = useRouter();

  // Only the three primary destinations live inside the pill. Create is the
  // detached + button floating above its right edge; index is a hidden redirect.
  const barRoutes = state.routes.filter(
    (r) =>
      r.name !== 'index' &&
      r.name !== 'create' &&
      descriptors[r.key]?.options?.href !== null
  );
  const count = barRoutes.length;

  const [rowWidth, setRowWidth] = useState(0);
  const [barHeight, setBarHeight] = useState(0);
  const rowLeft = useRef(0);
  const rowRef = useRef<View>(null);
  const translateX = useRef(new Animated.Value(0)).current;
  const dragging = useRef(false);

  const tabWidth = rowWidth ? rowWidth / count : 0;

  const activeKey = state.routes[state.index]?.key;
  const activeRouteName = state.routes[state.index]?.name;
  const activeIndex = barRoutes.findIndex((r) => r.key === activeKey);

  // Latest layout/nav values for the PanResponder, which is created once and
  // would otherwise close over stale values.
  const latest = useRef({ tabWidth, rowWidth, count, barRoutes, activeIndex, navigation });
  latest.current = { tabWidth, rowWidth, count, barRoutes, activeIndex, navigation };

  // Settle the bubble under the active tab whenever it changes (unless a drag
  // is currently driving it).
  useEffect(() => {
    if (dragging.current || !tabWidth || activeIndex < 0) return;
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
        if (tw && ai >= 0) Animated.spring(translateX, { ...SPRING, toValue: ai * tw }).start();
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
      {/* The bokeh backdrop runs on under the floating pill, so the bar area is
          the same continuous night scene as the rest of the app. Scrim + grain
          match the calmed bottom edge of the screens above, so stray warm
          lights never read like a photo bleeding under the bar. */}
      <View pointerEvents="none" style={styles.backdropClip}>
        <Image source={NIGHT} style={styles.backdrop} resizeMode="cover" />
        <View style={styles.backdropScrim} />
        <Image source={PAPER} style={styles.backdropGrain} resizeMode="cover" />
      </View>
      <View
        style={styles.bar}
        onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}
      >
        <View
          ref={rowRef}
          style={styles.row}
          onLayout={onRowLayout}
          {...pan.panHandlers}
        >
          {tabWidth > 0 && activeIndex >= 0 ? (
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
      </View>

      {/* Detached Create action — restored from the original floating-button
          navigation. It sits clear above the pill's upper-right corner and
          never consumes a tab slot. */}
      {activeRouteName !== 'create' ? (
        <Pressable
          onPress={() => router.push('/create')}
          accessibilityRole="button"
          accessibilityLabel="Create event"
          style={({ pressed }) => [
            styles.fab,
            { bottom: insets.bottom + spacing.sm + barHeight + spacing.sm },
            pressed && styles.fabPressed,
          ]}
        >
          <Ionicons name="add" size={32} color={colors.onInk} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
    overflow: 'visible',
  },
  backdropClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  // Bottom-anchored full-height slice of the backdrop, so the bar strip shows
  // the image's lower region — matching the screens above it.
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 900,
  },
  backdropScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,11,22,0.9)',
  },
  backdropGrain: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.05,
  },
  bar: {
    backgroundColor: 'rgba(16,20,33,0.92)',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  row: {
    flexDirection: 'row',
    position: 'relative',
  },
  bubble: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: 5,
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 14,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  label: {
    ...uiText(10, '600'),
  },
});
