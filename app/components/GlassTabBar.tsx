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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, shadow, spacing } from '../lib/theme';
import { uiText } from '../lib/fonts';
import { GlassSurface } from './GlassSurface';

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
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          bottom: 0,
          paddingBottom: insets.bottom + spacing.sm,
        },
      ]}
    >
      <GlassSurface
        radius={radius.pill}
        blur={26}
        fill="rgba(255,255,255,0.12)"
        borderColor="rgba(255,255,255,0.28)"
        style={[styles.bar, shadow.float]}
      >
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
            const color = focused ? '#FFFFFF' : 'rgba(255,255,255,0.55)';
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
      </GlassSurface>
    </View>
  );
}

// Floating oval glass downbar — same designshot recipe as the event action bar:
// frosted pill lifted above the safe-area edge, with a silver bubble gliding
// under the active tab.
const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'transparent',
    elevation: 10,
  },
  bar: {
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    position: 'relative',
  },
  bubble: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
  },
  label: {
    ...uiText(10, '600'),
  },
});
