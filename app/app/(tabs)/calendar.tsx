import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
          <Button title="Try again" variant="ghost" tone="paper" onPress={retry} />
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
  const monthTitle =
    view.year === today.getFullYear()
      ? MONTHS[view.month]
      : `${MONTHS[view.month]} ${view.year}`;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.monthRow}>
            <View style={styles.monthTitleWrap}>
              <Text style={[styles.kicker, kicker(colors.accent)]}>Your calendar</Text>
              <Text style={styles.monthTitle} numberOfLines={1}>
                {monthTitle}
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
            ) : null}
            <Pressable
              onPress={() => setMode((m) => (m === 'grid' ? 'list' : 'grid'))}
              style={styles.toggleButton}
              hitSlop={4}
            >
              <Ionicons
                name={mode === 'grid' ? 'list-outline' : 'calendar-outline'}
                size={20}
                color={colors.text}
              />
            </Pressable>
          </View>
        </View>

        {mode === 'grid' ? (
          <>
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
                      <Pressable
                        key={di}
                        style={styles.dayCell}
                        onPress={() => setSelected(date)}
                      >
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
                            <Text
                              style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}
                            >
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
                  <Text style={styles.emptyEmoji}>🕊️</Text>
                  <Text style={styles.emptyTitle}>Free as a bird</Text>
                  <Text style={styles.emptySubtitle}>
                    No commitments today. Do whatever you want
                  </Text>
                  <Button
                    title="Plan something"
                    variant="primary"
                    onPress={() => router.push('/new-event')}
                    style={styles.planButton}
                  />
                </View>
              ) : (
                <View style={styles.panelEvents}>
                  {selectedEvents.map((ev) => (
                    <EventCard key={ev.id} event={ev} />
                  ))}
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.listSections}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>
                <Text style={styles.sectionTitleItalic}>Upcoming</Text>
              </Text>
            </View>
            {upcoming.length === 0 ? (
              <Text style={styles.sectionEmpty}>Nothing planned — yet 👀</Text>
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
        )}
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
    flexShrink: 1,
    gap: spacing.xs,
  },
  kicker: {
    color: colors.accent,
  },
  monthTitle: {
    ...display(44),
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
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  todayPillText: {
    ...uiText(13, '700'),
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
    gap: spacing.sm,
  },
  weekRow: {
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
  panelEvents: {
    gap: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
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
    marginTop: spacing.sm,
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
  sectionTitleItalic: {
    ...display(30),
    color: colors.text,
    fontStyle: 'italic',
  },
  sectionEmpty: {
    ...uiText(15),
    color: colors.muted,
  },
});
