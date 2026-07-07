import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const PAST_GRACE_MS = 6 * 60 * 60 * 1000;

// Months span 4, 5 or 6 week rows. We lay the grid out at a constant height for
// the tallest case (6 rows) and let each row flex to fill it, so a long month
// like a 1st-to-31st never grows the grid and squeezes the panel below (which
// would push the empty-state emoji into the title and the CTA off screen).
const MAX_WEEK_ROWS = 6;
const GRID_ROW_HEIGHT = 46;
const GRID_HEIGHT = MAX_WEEK_ROWS * GRID_ROW_HEIGHT;

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

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const res = await api.myEvents();
          if (!active) return;
          setEvents(res.events);
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

  // Swipe up anywhere on the calendar to pull up the full list of events —
  // the panel handle below the grid hints at the gesture. Only claim decisive
  // upward drags so day taps and the panel's internal scroll still work.
  const swipeUp = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          g.dy < -10 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_e, g) => {
          if (g.dy < -50 || (g.dy < -20 && g.vy < -0.4)) setMode('list');
        },
      }),
    []
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
          <Button title="Try again" variant="ghost" tone="ink" onPress={retry} />
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
          <Text style={styles.monthTitle} numberOfLines={1}>
            {isViewingCurrentYear ? MONTHS[view.month] : `${MONTHS[view.month]} ${view.year}`}
          </Text>
        </View>
        {mode === 'grid' ? (
          <View style={styles.chevrons}>
            <Pressable onPress={() => shiftMonth(-1)} style={styles.chevronButton} hitSlop={6}>
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <Pressable onPress={() => shiftMonth(1)} style={styles.chevronButton} hitSlop={6}>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
          </View>
        ) : null}
      </View>
      <View style={styles.headerActions}>
        {mode === 'grid' ? (
          <Pressable onPress={goToToday} style={styles.todayPill} hitSlop={4}>
            <Text style={styles.todayPillText}>Today</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setMode('grid')} style={styles.toggleButton} hitSlop={4}>
            <Ionicons name="calendar-outline" size={20} color={colors.text} />
          </Pressable>
        )}
      </View>
    </View>
  );

  // Grid mode fills the screen exactly: the header + month grid take their
  // natural height at the top and the "Today" panel flexes to fill the rest,
  // so its CTA is always fully in view without scrolling (the panel scrolls
  // internally only when a day holds more events than fit). List mode keeps a
  // plain ScrollView since it can grow arbitrarily long.
  if (mode === 'grid') {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.gridContent} {...swipeUp.panHandlers}>
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
            <View style={styles.panelHandle} />
            <Text style={styles.panelTitle}>
              {selectedIsToday ? <Text style={styles.panelStrong}>Today </Text> : null}
              <Text style={selectedIsToday ? styles.panelMuted : styles.panelStrong}>
                {WEEKDAYS_LONG[selected.getDay()]} · {MONTHS[selected.getMonth()]}{' '}
                {selected.getDate()}
              </Text>
            </Text>

            {selectedEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyBody}>
                  <Text style={styles.emptyEmoji}>🕊️</Text>
                  <Text style={styles.emptyTitle}>Free as a bird</Text>
                  <Text style={styles.emptySubtitle}>
                    No commitments today. Do whatever you want
                  </Text>
                </View>
                <Button
                  title="Plan something"
                  variant="primary"
                  onPress={() => router.push('/new-event')}
                  style={styles.planButton}
                />
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
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {header}

        <View style={styles.listSections}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Upcoming</Text>
          </View>
          {upcoming.length === 0 ? (
            <Text style={styles.sectionEmpty}>Nothing planned - yet 👀</Text>
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
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  // Grid mode fills the screen so the panel below the calendar is always fully
  // visible; children take their natural height and the panel flexes to fill.
  gridContent: {
    flex: 1,
    padding: spacing.md,
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
    color: colors.text,
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
  toggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: colors.bg,
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
  panel: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  panelHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cardBorder,
  },
  panelTitle: {
    fontSize: 17,
    textAlign: 'center',
  },
  panelStrong: {
    ...uiText(17, '800'),
    color: colors.text,
  },
  panelMuted: {
    ...uiText(17, '600'),
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
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    ...display(24),
    color: colors.text,
  },
  emptySubtitle: {
    ...uiText(15),
    color: colors.muted,
    textAlign: 'center',
  },
  planButton: {
    alignSelf: 'stretch',
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
});
