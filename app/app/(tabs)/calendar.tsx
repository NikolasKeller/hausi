import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { EventSummary } from '../../shared/types';
import { api, mediaUrl } from '../../lib/api';
import { thinDisplay, XLIGHT_ITALIC, kicker, uiText } from '../../lib/fonts';
import { radius, spacing } from '../../lib/theme';
import { COVERS } from '../../lib/covers';
import { EventCard } from '../../components/EventCard';
import { Button } from '../../components/ui';
import { GlassSurface } from '../../components/GlassSurface';

const CALENDAR_BG = require('../../assets/brand/designshot-bg.png');

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

function CalendarAtmosphere({ children }: { children?: React.ReactNode }) {
  const webBlur =
    Platform.OS === 'web'
      ? ({
          filter: 'blur(42px) saturate(130%)',
          transform: [{ scale: 1.12 }],
        } as object)
      : null;
  return (
    <View style={styles.atmoFill}>
      <Image
        source={CALENDAR_BG}
        blurRadius={Platform.OS === 'ios' ? 42 : 0}
        style={[StyleSheet.absoluteFill, webBlur]}
        resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFill, styles.atmoVeil]} pointerEvents="none" />
      <LinearGradient
        colors={['rgba(30,45,60,0.30)', 'rgba(11,12,16,0.15)', 'rgba(11,12,16,0.72)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

function DottedArc({ count = 12 }: { count?: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              opacity: 0.85 - i * 0.04,
              transform: [{ translateY: Math.pow(i - 3, 2) * 0.04 }],
            },
          ]}
        />
      ))}
    </View>
  );
}

export default CalendarScreen;

function CalendarScreen() {
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

  // The mirror gesture in list mode: swipe down to fall back to the grid —
  // hinted by the handle above the list. Only claimed while the list is
  // scrolled to the very top, so normal downward scrolling keeps working.
  const listAtTop = useRef(true);
  const swipeDown = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          listAtTop.current && g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 50 || (g.dy > 20 && g.vy > 0.4)) setMode('grid');
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
      <CalendarAtmosphere>
        <SafeAreaView edges={['top']} style={styles.safe}>
          <View style={styles.center}>
            <Text style={styles.errorEmoji}>🫠</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Button title="Try again" variant="ghost" tone="paper" onPress={retry} />
          </View>
        </SafeAreaView>
      </CalendarAtmosphere>
    );
  }

  if (!events) {
    return (
      <CalendarAtmosphere>
        <SafeAreaView edges={['top']} style={styles.safe}>
          <View style={styles.center}>
            <ActivityIndicator color="#FFFFFF" size="large" />
          </View>
        </SafeAreaView>
      </CalendarAtmosphere>
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
          <Text style={styles.heroKicker}>Your calendar</Text>
          <Text style={[styles.monthTitle, thinDisplay(36)]} numberOfLines={1}>
            {isViewingCurrentYear ? MONTHS[view.month] : `${MONTHS[view.month]} ${view.year}`}
          </Text>
          <DottedArc />
        </View>
        {mode === 'grid' ? (
          <View style={styles.chevrons}>
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={6}>
              <GlassSurface
                radius={999}
                blur={18}
                fill="rgba(255,255,255,0.10)"
                borderColor="rgba(255,255,255,0.30)"
                shadow={false}
                style={styles.chevronButton}
              >
                <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
              </GlassSurface>
            </Pressable>
            <Pressable onPress={() => shiftMonth(1)} hitSlop={6}>
              <GlassSurface
                radius={999}
                blur={18}
                fill="rgba(255,255,255,0.10)"
                borderColor="rgba(255,255,255,0.30)"
                shadow={false}
                style={styles.chevronButton}
              >
                <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
              </GlassSurface>
            </Pressable>
          </View>
        ) : null}
      </View>
      {mode === 'grid' ? (
        <View style={styles.headerActions}>
          <Pressable onPress={goToToday} hitSlop={4}>
            <View style={styles.todayPill}>
              <Text style={styles.todayPillText}>Today</Text>
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  // Grid mode fills the screen exactly: the header + month grid take their
  // natural height at the top and the "Today" panel flexes to fill the rest,
  // so its CTA is always fully in view without scrolling (the panel scrolls
  // internally only when a day holds more events than fit). List mode keeps a
  // plain ScrollView since it can grow arbitrarily long.
  if (mode === 'grid') {
    return (
      <CalendarAtmosphere>
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
                            isToday && !isSelected && styles.dayCircleToday,
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

            <GlassSurface radius={30} blur={26} style={styles.panel}>
              <View style={styles.panelHandle} />
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
                    <Text style={[styles.emptyTitle, thinDisplay(24)]}>{EMPTY_TITLE}</Text>
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
            </GlassSurface>
          </View>
        </SafeAreaView>
      </CalendarAtmosphere>
    );
  }

  return (
    <CalendarAtmosphere>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={{ flex: 1 }} {...swipeDown.panHandlers}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              listAtTop.current = e.nativeEvent.contentOffset.y <= 0;
            }}
            scrollEventThrottle={16}
          >
            <View style={styles.listHandle} />
            {header}

            <View style={styles.listSections}>
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, thinDisplay(30)]}>Upcoming</Text>
              </View>
              {upcoming.length === 0 ? (
                <Text style={styles.sectionEmpty}>Nothing planned - yet 👀</Text>
              ) : (
                upcoming.map((ev) => <EventCard key={ev.id} event={ev} />)
              )}

              {past.length > 0 ? (
                <>
                  <Text style={[styles.sectionTitle, thinDisplay(30), { marginTop: spacing.lg }]}>
                    Past
                  </Text>
                  {past.map((ev) => (
                    <EventCard key={ev.id} event={ev} />
                  ))}
                </>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </CalendarAtmosphere>
  );
}

const styles = StyleSheet.create({
  atmoFill: {
    flex: 1,
    backgroundColor: '#0B0C10',
    overflow: 'hidden',
  },
  atmoVeil: {
    backgroundColor: 'rgba(11,12,16,0.50)',
  },
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
    color: '#FFFFFF',
    textAlign: 'center',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  gridContent: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    flex: 1,
  },
  monthTitleWrap: {
    flex: 1,
    gap: 4,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.95)',
    fontFamily: XLIGHT_ITALIC,
    fontSize: 14,
    letterSpacing: 0.3,
    marginLeft: 6,
    textShadowColor: 'rgba(30,45,60,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  monthTitle: {
    color: '#FFFFFF',
    marginLeft: 4,
    flexShrink: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 6,
    marginLeft: 6,
  },
  dot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  chevrons: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  chevronButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 8,
  },
  todayPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  todayPillText: {
    ...uiText(12, '700'),
    color: '#0B0C10',
  },
  listHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: spacing.xs,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    ...kicker('rgba(255,255,255,0.45)'),
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
  },
  grid: {
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
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  dayCircleSelected: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dayNumber: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    fontWeight: 'normal',
  },
  dayNumberSelected: {
    color: '#0B0C10',
    fontFamily: 'Inter_700Bold',
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
    marginHorizontal: -spacing.md,
    marginBottom: -spacing.md,
    padding: spacing.lg,
    gap: spacing.md,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  panelHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  panelTitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  panelStrong: {
    ...uiText(15, '800'),
    color: '#FFFFFF',
  },
  panelMuted: {
    ...uiText(15, '600'),
    color: 'rgba(255,255,255,0.55)',
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
  emptyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  emptyTitle: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
  },
  sectionEmpty: {
    ...uiText(15),
    color: 'rgba(255,255,255,0.55)',
  },
});
