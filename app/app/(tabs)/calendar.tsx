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

// Height of the drag-handle block at the top of the panel (paddingVertical
// spacing.sm on both sides + the 4px bar). Used to size the docked
// selected-day content to exactly the visible strip of the panel.
const HANDLE_BLOCK_HEIGHT = 2 * 8 + 4;

const SHEET_SPRING = { useNativeDriver: true, friction: 10, tension: 90 };

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

  // 0 = sheet parked below the screen (grid mode), 1 = sheet open. Driven by
  // the finger while dragging and by a spring on release, so the list glides
  // over the calendar instead of hard-swapping views.
  const sheetProgress = useRef(new Animated.Value(0)).current;
  const [containerH, setContainerH] = useState(0);
  const containerHRef = useRef(0);

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

  // Swipe up anywhere on the calendar to pull the events sheet over the grid.
  // The sheet tracks the finger while dragging (no hard swap) and springs to
  // its resting spot on release. Only claim decisive upward drags so day taps
  // and the panel's internal scroll still work.
  const travel = useCallback(
    () => Math.max(1, (containerHRef.current || 1200) - SHEET_TOP_GAP),
    []
  );
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

  // Sheet choreography: the events list rides sheetProgress from parked below
  // the screen (0) to just under the top edge (1) while the calendar recedes —
  // dimming and shrinking slightly — so it visibly stays "behind" the list.
  const sheetTranslateY = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [containerH || 1200, SHEET_TOP_GAP],
  });
  const gridOpacity = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.3],
  });
  const gridScale = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.96],
  });

  // One stacked layout: the grid fills the screen (header + month grid on top,
  // the "Today" panel flexing below) and the events sheet lives above it,
  // parked off-screen until a swipe pulls it up over the calendar.
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View
        style={styles.stack}
        onLayout={(e) => {
          setContainerH(e.nativeEvent.layout.height);
          containerHRef.current = e.nativeEvent.layout.height;
        }}
      >
        <Animated.View
          style={[
            styles.gridContent,
            { opacity: gridOpacity, transform: [{ scale: gridScale }] },
          ]}
          pointerEvents={mode === 'grid' ? 'auto' : 'none'}
          {...(mode === 'grid' ? swipeUp.panHandlers : {})}
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

          <View style={styles.panel}>
            {/* Tap or swipe up: both pull the events sheet over the grid. */}
            <Pressable
              onPress={openSheet}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Show all my events"
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

            {selectedEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyBody}>
                  <Text style={styles.emptyTitle}>{EMPTY_TITLE}</Text>
                  {/* An empty day shouldn't dead-end — send people to the
                      events feed to find something for it. */}
                  <Button
                    title="Explore events"
                    variant="primary"
                    onPress={() => router.push('/explore')}
                  />
                </View>
              </View>
            ) : (
              <ScrollView
                style={styles.panelScroll}
                contentContainerStyle={styles.panelEvents}
                showsVerticalScrollIndicator={false}
              >
                {selectedEvents.map((ev) => (
                  <EventCard key={ev.id} event={ev} />
                ))}
              </ScrollView>
            )}
          </View>
        </Animated.View>

        {/* The events sheet — rides over the dimmed calendar instead of
            replacing it, so pulling it up never reads as the calendar
            vanishing. A strip of the grid stays visible above the sheet and
            tapping the handle (or dragging down) brings it back. */}
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}
          pointerEvents={mode === 'list' ? 'auto' : 'none'}
          {...swipeDown.panHandlers}
        >
          <Pressable
            onPress={closeSheet}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back to calendar"
            style={styles.listHandleWrap}
          >
            <View style={styles.listHandle} />
          </Pressable>
          <ScrollView
            contentContainerStyle={styles.content}
            onScroll={(e) => {
              listAtTop.current = e.nativeEvent.contentOffset.y <= 0;
            }}
            scrollEventThrottle={16}
          >
            <View style={styles.listSections}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Upcoming</Text>
              </View>
              {upcoming.length === 0 ? (
                <View style={styles.sectionEmptyWrap}>
                  <Text style={styles.sectionEmpty}>Nothing planned - yet 👀</Text>
                  <Button
                    title="Explore events"
                    variant="primary"
                    onPress={() => router.push('/explore')}
                  />
                </View>
              ) : (
                upcoming.map((ev) => <EventCard key={ev.id} event={ev} />)
              )}

              {past.length > 0 ? (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Past</Text>
                  {past.map((ev) => (
                    <EventCard key={ev.id} event={ev} />
                  ))}
                </>
              ) : null}
            </View>
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
  content: {
    padding: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  // Hosts both layers: the calendar grid below and the events sheet above.
  stack: {
    flex: 1,
  },
  // Grid mode fills the screen so the panel below the calendar is always fully
  // visible; children take their natural height and the panel flexes to fill.
  gridContent: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  // The events list as an overlay sheet: parked below the screen and slid up
  // by sheetProgress, over the receding calendar.
  sheet: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,17,29,0.98)',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...shadow.float,
  },
  listHandleWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: spacing.sm,
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
  // Swipe-down affordance at the top of the events sheet (mirror of
  // panelHandle); its wrapper is tappable as an explicit way back.
  listHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
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
  // A bottom-sheet look: the panel bleeds to the screen edges, rounds only its
  // top corners and separates from the grid with a soft fill (no hard border).
  panel: {
    flex: 1,
    backgroundColor: 'rgba(14,18,31,0.72)',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    marginHorizontal: -spacing.md,
    marginBottom: -spacing.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  panelHandleWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginVertical: -spacing.xs,
    paddingVertical: spacing.xs,
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
  panelEvents: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  emptyState: {
    flex: 1,
    gap: spacing.sm,
  },
  // The decorative block takes the space left above the pinned CTA and centers
  // its content. overflow: hidden means that if the panel is ever too short it
  // clips gracefully instead of spilling over the title above or the button.
  emptyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  emptyTitle: {
    ...display(24),
    color: colors.text,
    textAlign: 'center',
  },
  listSections: {
    gap: spacing.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...display(30),
    color: colors.text,
  },
  sectionEmpty: {
    ...uiText(15),
    color: colors.muted,
  },
  sectionEmptyWrap: {
    gap: spacing.md,
    alignItems: 'flex-start',
  },
});
