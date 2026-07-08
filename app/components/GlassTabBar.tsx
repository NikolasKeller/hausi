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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
// to the bar so it can never slip past the edges. The "Create" screen isn't a
// bar tab: it lives in a white + button floating above the bar's right edge.
export function GlassTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Only the four primary destinations live in the bar; Create is the FAB,
  // which jumps straight into the event editor.
  const barRoutes = state.routes.filter((r) => r.name !== 'create');
  const count = barRoutes.length;

  const [rowWidth, setRowWidth] = useState(0);
  const [barHeight, setBarHeight] = useState(0);
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

  const goCreate = () => router.push('/new-event');

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + spacing.sm }]}>
      <View
        style={styles.bar}
        onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
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

      {/* Floating Create button — sits clear above the bar's right edge so it
          never overlaps the tab items. */}
      <Pressable
        onPress={goCreate}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + spacing.sm + barHeight + spacing.sm },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="add" size={32} color={colors.onInk} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    backgroundColor: 'transparent',
  },
  bar: {
    backgroundColor: 'rgba(28,28,30,0.94)',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 6,
    shadowColor: '#000',
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
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
  },
  label: {
    ...uiText(11, '600'),
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
});
