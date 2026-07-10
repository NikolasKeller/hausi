import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { EventSummary } from '../../shared/types';
import { api, mediaUrl } from '../../lib/api';
import { display, kicker, uiText } from '../../lib/fonts';
import { colors, radius, shadow, spacing } from '../../lib/theme';
import { COVERS } from '../../lib/covers';
import { EventCard } from '../../components/EventCard';
import { ChromeText } from '../../components/ChromeText';
import { Button } from '../../components/ui';
import { withScreenBackground } from '../../components/ScreenBackground';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMPTY_TITLE = 'Nothing planned yet';

const PAST_GRACE_MS = 6 * 60 * 60 * 1000;

// Months span 4, 5 or 6 week rows. We lay the grid out at a constant height for
// the tallest case (6 rows) and let each row flex to fill it, so a long month
// like a 1st-to-31st never grows the grid and squeezes the panel below (which
// would push the empty-state emoji into the title and the CTA off screen).
const MAX_WEEK_ROWS = 6;
const GRID_ROW_HEIGHT = 46;
const GRID_HEIGHT = MAX_WEEK_ROWS * GRID_ROW_HEIGHT;

// There is ONE events panel. Docked, its top edge sits right under the month
// grid and it shows the selected day. Dragging up stretches the same panel
// until it stops this far short of the top, so the dimmed month header still
// peeks out behind it and the way back is obvious.
const SHEET_TOP_GAP = 68;

// The panel's top edge is a layout prop (it resizes the one panel), so the
// spring must run on the JS driver.
const SHEET_SPRING = { useNativeDriver: false, friction: 10, tension: 90 };

// Cells for a month grid: leading/trailing nulls pad to full weeks.
function buildMonthCells(year: number, month: number): (Date | null)[] {
  const startPad = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function chunkWeeks(cells: (Date | null)[]): (Date | null)[][] {
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default withScreenBackground(CalendarScreen);

function CalendarScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // 0 = panel docked under the month grid (grid mode), 1 = panel stretched to
  // near the top (list mode). Driven by the finger while dragging and by a
  // spring on release. It's ONE panel that grows and shrinks — not a second
  // sheet sliding over the first.
  const sheetProgress = useRef(new Animated.Value(0)).current;
  const [containerH, setContainerH] = useState(0);
  const containerHRef = useRef(0);
  // Y (in stack coordinates) where the panel's top edge rests when docked —
  // measured off the calendar block so it always sits right under the grid.
  const [dockedTop, setDockedTop] = useState(0);
  const dockedTopRef = useRef(0);

  const openSheet = useCallback(() => {
    setMode('list');
    Animated.spring(sheetProgress, { ...SHEET_SPRING, toValue: 1 }).start();
  }, [sheetProgress]);

  const closeSheet = useCallback(() => {
    setMode('grid');
    Animated.spring(sheetProgress, { ...SHEET_SPRING, toValue: 0 }).start();
  }, [sheetProgress]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const res = await api.myEvents();
          if (!active) return;
          // The calendar only lists events you host or hold a ticket for
          // (GOING will be set by the upcoming purchase tracking). Favorites
          // (MAYBE) live on the profile only — a mostly-empty calendar until
          // purchase tracking lands is intentional.
          setEvents(res.events.filter((ev) => ev.isHost || ev.myRsvp === 'GOING'));
          setError(null);
        } catch (e) {
          if (!active) return;
          setError(e instanceof Error ? e.message : 'Could not load your calendar');
        }
      })();
      return () => {
        active = false;
      };
    }, [reloadKey])
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventSummary[]>();
    for (const ev of events ?? []) {
      const key = new Date(ev.date).toDateString();
      const list = map.get(key);
      if (list) list.push(ev);
      else map.set(key, [ev]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return map;
  }, [events]);

  const { upcoming, past } = useMemo(() => {
    const cutoff = Date.now() - PAST_GRACE_MS;
    const up: EventSummary[] = [];
    const pa: EventSummary[] = [];
    for (const ev of events ?? []) {
      if (new Date(ev.date).getTime() < cutoff) pa.push(ev);
      else up.push(ev);
    }
    up.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    pa.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { upcoming: up, past: pa };
  }, [events]);

  // Swipe up anywhere (grid or docked panel) to stretch the panel toward the
  // top. It tracks the finger while dragging and springs to its resting spot
  // on release. Only claim decisive upward drags so day taps and the panel's
  // internal scroll still work.
  const travel = useCallback(() => {
    const docked = dockedTopRef.current || (containerHRef.current || 1200) * 0.55;
    return Math.max(1, docked - SHEET_TOP_GAP);
  }, []);
  const swipeUp = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          g.dy < -10 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          sheetProgress.setValue(Math.min(1, Math.max(0, -g.dy / travel())));
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy < -50 || (g.dy < -20 && g.vy < -0.4)) openSheet();
          else Animated.spring(sheetProgress, { ...SHEET_SPRING, toValue: 0 }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(sheetProgress, { ...SHEET_SPRING, toValue: 0 }).start();
        },
      }),
    [openSheet, sheetProgress, travel]
  );

  // The mirror gesture on the open sheet: drag down to reveal the grid again —
  // hinted by the handle above the list. Only claimed while the list is
  // scrolled to the very top, so normal downward scrolling keeps working.
  const listAtTop = useRef(true);
  const swipeDown = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          listAtTop.current && g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          sheetProgress.setValue(Math.min(1, Math.max(0, 1 - g.dy / travel())));
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 50 || (g.dy > 20 && g.vy > 0.4)) closeSheet();
          else Animated.spring(sheetProgress, { ...SHEET_SPRING, toValue: 1 }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(sheetProgress, { ...SHEET_SPRING, toValue: 1 }).start();
        },
      }),
    [closeSheet, sheetProgress, travel]
  );

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function goToToday() {
    const now = new Date();
    setSelected(now);
    setView({ year: now.getFullYear(), month: now.getMonth() });
  }

  function retry() {
    setEvents(null);
    setError(null);
    setReloadKey((k) => k + 1);
  }

  if (error) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>🫠</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Try again" variant="ghost" onPress={retry} />
        </View>
      </SafeAreaView>
    );
  }

  if (!events) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const today = new Date();
  const todayKey = today.toDateString();
  const selectedKey = selected.toDateString();
  const selectedIsToday = selectedKey === todayKey;
  const selectedEvents = eventsByDay.get(selectedKey) ?? [];
  const weeks = chunkWeeks(buildMonthCells(view.year, view.month));
  const isViewingCurrentYear = view.year === today.getFullYear();

  const header = (
    <View style={styles.header}>
      <View style={styles.monthRow}>
        <View style={styles.monthTitleWrap}>
          {/* Month name at one fixed size. When viewing another year, the year
              is appended so it stays visible without a purple eyebrow label. */}
          <ChromeText style={styles.monthTitle} numberOfLines={1}>
            {isViewingCurrentYear ? MONTHS[view.month] : `${MONTHS[view.month]} ${view.year}`}
          </ChromeText>
        </View>
        <View style={styles.chevrons}>
          <Pressable onPress={() => shiftMonth(-1)} style={styles.chevronButton} hitSlop={6}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => shiftMonth(1)} style={styles.chevronButton} hitSlop={6}>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>
      <View style={styles.headerActions}>
        <Pressable onPress={goToToday} style={styles.todayPill} hitSlop={4}>
          <Text style={styles.todayPillText}>Today</Text>
        </Pressable>
      </View>
    </View>
  );

  // Panel choreography: ONE panel. Its top edge rides sheetProgress from just
  // under the month grid (docked) up to SHEET_TOP_GAP (expanded) — the same
  // window simply gets taller while the calendar recedes behind it, dimming
  // and shrinking slightly.
  const panelTop = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [dockedTop || Math.max(SHEET_TOP_GAP + 1, (containerH || 1200) * 0.55), SHEET_TOP_GAP],
  });
  const panelBg = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(13,17,29,0.80)', 'rgba(13,17,29,0.98)'],
  });
  const gridOpacity = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.3],
  });
  const gridScale = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.96],
  });

  // One stacked layout: the calendar block (header + month grid) sits on top
  // and the single events panel is anchored to the bottom, docked right under
  // the grid. Swiping up stretches that same panel toward the top — no second
  // sheet slides over it.
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View
        style={styles.stack}
        onLayout={(e) => {
          setContainerH(e.nativeEvent.layout.height);
          containerHRef.current = e.nativeEvent.layout.height;
        }}
        {...(mode === 'grid' ? swipeUp.panHandlers : {})}
      >
        <Animated.View
          style={[
            styles.calBlock,
            { opacity: gridOpacity, transform: [{ scale: gridScale }] },
          ]}
          pointerEvents={mode === 'grid' ? 'auto' : 'none'}
          onLayout={(e) => {
            // The panel docks flush under the calendar block.
            const bottom = e.nativeEvent.layout.y + e.nativeEvent.layout.height + spacing.sm;
            setDockedTop(bottom);
            dockedTopRef.current = bottom;
          }}
        >
          {header}

          <View style={styles.weekdayRow}>
            {WEEKDAYS_SHORT.map((d) => (
              <Text key={d} style={styles.weekdayLabel}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((date, di) => {
                  if (!date) return <View key={di} style={styles.dayCell} />;
                  const key = date.toDateString();
                  const dayEvents = eventsByDay.get(key);
                  const isToday = key === todayKey;
                  const isSelected = key === selectedKey;
                  return (
                    <Pressable key={di} style={styles.dayCell} onPress={() => setSelected(date)}>
                      <View
                        style={[
                          styles.dayCircle,
                          isToday && styles.dayCircleToday,
                          isSelected && styles.dayCircleSelected,
                        ]}
                      >
                        {dayEvents?.length ? (
                          dayEvents[0].coverImage ? (
                            <Image
                              source={{ uri: mediaUrl(dayEvents[0].coverImage) }}
                              style={styles.dayThumb}
                            />
                          ) : (
                            <Text style={styles.dayEmoji}>
                              {COVERS[dayEvents[0].coverTheme].emoji}
                            </Text>
                          )
                        ) : (
                          <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>
                            {date.getDate()}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </Animated.View>

        {/* THE panel — docked it shows the selected day; dragging the handle
            up stretches the very same panel and reveals the Upcoming/Past
            sections further down its content. */}
        <Animated.View
          style={[styles.panel, { top: panelTop, backgroundColor: panelBg }]}
          {...(mode === 'list' ? swipeDown.panHandlers : {})}
        >
          <Pressable
            onPress={mode === 'grid' ? openSheet : closeSheet}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={mode === 'grid' ? 'Show all my events' : 'Back to calendar'}
            style={styles.panelHandleWrap}
          >
            <View style={styles.panelHandle} />
          </Pressable>
          <Text style={styles.panelTitle}>
            {selectedIsToday ? <Text style={styles.panelStrong}>Today </Text> : null}
            <Text style={selectedIsToday ? styles.panelMuted : styles.panelStrong}>
              {selected.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </Text>

          <ScrollView
            style={styles.panelScroll}
            contentContainerStyle={styles.panelContent}
            showsVerticalScrollIndicator={false}
            // Docked, the list must not claim upward drags — those stretch the
            // panel. Scrolling unlocks once it's expanded.
            scrollEnabled={mode === 'list'}
            onScroll={(e) => {
              listAtTop.current = e.nativeEvent.contentOffset.y <= 0;
            }}
            scrollEventThrottle={16}
          >
            {selectedEvents.length === 0 ? (
              <View style={styles.emptyDay}>
                <Text style={styles.emptyTitle}>{EMPTY_TITLE}</Text>
                {/* An empty day shouldn't dead-end — send people to the
                    events feed to find something for it. */}
                <Button
                  title="Explore events"
                  variant="primary"
                  onPress={() => router.push('/explore')}
                />
              </View>
            ) : (
              selectedEvents.map((ev) => <EventCard key={ev.id} event={ev} />)
            )}

            {/* The rest of the agenda lives below in the SAME panel — sliding
                up just uncovers it. Sections only render when they have
                content, so the day empty state above is never echoed by a
                second "nothing planned" line. */}
            {upcoming.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Upcoming</Text>
                {upcoming.map((ev) => (
                  <EventCard key={ev.id} event={ev} />
                ))}
              </>
            ) : null}

            {past.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Past</Text>
                {past.map((ev) => (
                  <EventCard key={ev.id} event={ev} />
                ))}
              </>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  errorEmoji: {
    fontSize: 48,
  },
  errorText: {
    ...uiText(17),
    color: colors.text,
    textAlign: 'center',
  },
  // Hosts both layers: the calendar block on top and the single events panel
  // anchored below it.
  stack: {
    flex: 1,
  },
  // The calendar block (header + weekday row + month grid) takes its natural
  // height; the panel docks right under it.
  calBlock: {
    padding: spacing.md,
    paddingBottom: 0,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    flex: 1,
  },
  monthTitleWrap: {
    // Fill the row so the chevrons always land at the same spot on the right,
    // regardless of the month name's length (e.g. "May" vs "September").
    flex: 1,
    gap: spacing.xs,
  },
  kicker: {
    color: colors.accent,
  },
  monthTitle: {
    // One fixed size for all 12 months. 32 is the size that fits the longest
    // name ("September") in the row alongside the chevrons, so every month
    // matches it and the title never resizes as you page through months.
    ...display(32),
    color: colors.helio,
    flexShrink: 1,
  },
  chevrons: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  chevronButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  todayPill: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  todayPillText: {
    ...uiText(12, '600'),
    color: colors.text,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    ...kicker(),
    flex: 1,
    textAlign: 'center',
    color: colors.muted,
  },
  grid: {
    // Constant height for every month (see MAX_WEEK_ROWS). Rows flex to share
    // it, so 4/5/6-week months all keep the grid the same size and leave the
    // panel below the same room.
    height: GRID_HEIGHT,
  },
  weekRow: {
    flex: 1,
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  dayCircleSelected: {
    backgroundColor: colors.accent,
  },
  dayNumber: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  dayNumberSelected: {
    // Sits on the (now light silver) accent circle — needs dark ink.
    color: colors.onAccent,
    fontWeight: '800',
  },
  dayEmoji: {
    fontSize: 20,
  },
  dayThumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  // THE one events panel: absolutely anchored to the bottom edge, its top is
  // animated between the docked spot (under the grid) and near the screen top.
  // Bottom-sheet look — full-bleed, only the top corners rounded.
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: spacing.lg,
    paddingTop: 0,
    gap: spacing.md,
    ...shadow.float,
  },
  panelHandleWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  panelHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  panelTitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  panelStrong: {
    ...uiText(15, '800'),
    color: colors.text,
  },
  panelMuted: {
    ...uiText(15, '600'),
    color: colors.muted,
  },
  panelScroll: {
    flex: 1,
  },
  panelContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  // The selected day's empty state — sized to read nicely in the docked strip
  // (no flex centering: the panel content is one top-anchored scroll).
  emptyDay: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  emptyTitle: {
    ...display(24),
    color: colors.text,
    textAlign: 'center',
  },
  sectionTitle: {
    ...display(30),
    color: colors.text,
  },
});
