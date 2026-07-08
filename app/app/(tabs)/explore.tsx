import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES, CATEGORY_META, type Category, type ExploreEvent } from '../../shared/types';
import { api } from '../../lib/api';
import { searchCities } from '../../lib/geocoding';
import { hasLocationPermission, locateCity, type LocatedCity } from '../../lib/location';
import { getRecentCities, recordRecentCity } from '../../lib/recentCities';
import { colors, glass, radius, spacing } from '../../lib/theme';
import { thinDisplay, thinLabel, uiText } from '../../lib/fonts';
import { CoverGradient } from '../../components/CoverGradient';
import { Button } from '../../components/ui';
import { withScreenBackground } from '../../components/ScreenBackground';
import { formatEventDate } from '../../components/EventCard';
import { Avatar } from '../../components/Avatar';
import { MilkyCard } from '../../components/MilkyCard';
import { VibeGauge } from '../../components/VibeGauge';
import { GlassPill } from '../../components/glass';

const CATEGORY_ICONS: Record<Category | 'all', keyof typeof Ionicons.glyphMap> = {
  all: 'search',
  music: 'musical-notes-outline',
  community: 'people-outline',
  arts: 'color-palette-outline',
  food: 'restaurant-outline',
  sports: 'basketball-outline',
  other: 'sparkles-outline',
};

const CATEGORY_CHIPS: { key: Category | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  ...CATEGORIES.map((c) => ({
    key: c,
    label: CATEGORY_META[c].label,
  })),
];

function vibeScore(events: ExploreEvent[]): number {
  if (!events.length) return 32;
  const interested = events.reduce((n, e) => n + e.interested, 0);
  const friends = events.filter((e) => e.friendGoing).length;
  const raw = 28 + Math.min(60, events.length * 4 + interested * 0.6 + friends * 8);
  return Math.round(Math.min(99, raw));
}

function ExploreCard({ event }: { event: ExploreEvent }) {
  const router = useRouter();
  const faces = event.interestedAvatars.slice(0, 3);
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.slug}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
    >
      <MilkyCard radius={radius.milkySm} contentStyle={styles.cardInner}>
        <CoverGradient
          theme={event.coverTheme}
          image={event.coverImage}
          style={styles.poster}
          emojiOpacity={0.2}
          dim={false}
        />
        <View style={styles.cardBody}>
          {event.friendGoing ? (
            <Text style={styles.friendStrip} numberOfLines={1}>
              <Text style={styles.friendName}>{event.friendGoing.name}</Text> is interested
            </Text>
          ) : null}
          <Text style={styles.cardTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {formatEventDate(event.date)}
          </Text>
          {event.interested > 0 ? (
            <View style={styles.facesRow}>
              {faces.map((f, i) => (
                <View key={i} style={[styles.faceWrap, i > 0 && { marginLeft: -8 }]}>
                  <Avatar name={f.name} image={f.avatarImage} size={20} />
                </View>
              ))}
              <Text style={styles.facesLabel}>+{event.interested}</Text>
            </View>
          ) : null}
        </View>
      </MilkyCard>
    </Pressable>
  );
}

export default withScreenBackground(ExploreScreen);

function ExploreScreen() {
  const [city, setCity] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [events, setEvents] = useState<ExploreEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [citySearchResults, setCitySearchResults] = useState<string[]>([]);
  const [citySearching, setCitySearching] = useState(false);
  const [recentCities, setRecentCities] = useState<string[]>([]);
  const [myLocation, setMyLocation] = useState<LocatedCity | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const cityRef = useRef(city);
  const myLocationRef = useRef<LocatedCity | null>(null);
  const locatingRef = useRef(false);
  const wantSelectTokenRef = useRef<number | null>(null);
  const locateTokenRef = useRef(0);

  useEffect(() => {
    cityRef.current = city;
  }, [city]);

  useEffect(() => {
    const q = citySearch.trim();
    setCitySearchResults([]);
    if (q.length < 2) {
      setCitySearching(false);
      return;
    }
    setCitySearching(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchCities(q, ctrl.signal)
        .then((found) => {
          if (ctrl.signal.aborted) return;
          const seen = new Set<string>();
          const names: string[] = [];
          for (const r of found) {
            const key = r.name.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              names.push(r.name);
            }
          }
          setCitySearchResults(names);
          setCitySearching(false);
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          setCitySearchResults([]);
          setCitySearching(false);
        });
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [citySearch]);

  const load = useCallback(
    async (isActive: () => boolean) => {
      try {
        if (city === null) {
          const feed = await api.home().catch(() => null);
          const savedCity = (feed?.city ?? '').trim();
          const all = await api.explore(undefined, category);
          if (!isActive()) return;
          const counts = new Map<string, number>();
          for (const e of all.events) {
            const k = e.city?.trim();
            if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
          }
          let chosen = savedCity;
          if (!(savedCity && (counts.get(savedCity) ?? 0) > 0)) {
            let bestN = 0;
            for (const [k, n] of counts.entries()) {
              if (n > bestN) {
                bestN = n;
                chosen = k;
              }
            }
            if (!chosen) chosen = all.cities[0] ?? savedCity;
          }
          setCity(chosen);
          return;
        }
        const res = await api.explore(city || undefined, category);
        if (!isActive()) return;
        setEvents(res.events);
        setError(null);
      } catch (e) {
        if (isActive()) setError(e instanceof Error ? e.message : 'Could not load events');
      }
    },
    [city, category]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load(() => active);
      return () => {
        active = false;
      };
    }, [load])
  );

  function selectCity(next: string) {
    locateTokenRef.current += 1;
    wantSelectTokenRef.current = null;
    setCityMenuOpen(false);
    setCitySearch('');
    if (next) recordRecentCity(next).then(setRecentCities);
    if (next !== cityRef.current) {
      cityRef.current = next;
      setEvents(null);
      setCity(next);
    }
  }

  function closeCityMenu() {
    locateTokenRef.current += 1;
    wantSelectTokenRef.current = null;
    setCityMenuOpen(false);
    setCitySearch('');
  }

  function toggleCityMenu() {
    if (cityMenuOpen) {
      closeCityMenu();
      return;
    }
    setCityMenuOpen(true);
    getRecentCities().then(setRecentCities);
    if (!myLocationRef.current && !locatingRef.current) {
      hasLocationPermission().then((granted) => {
        if (granted && !myLocationRef.current && !locatingRef.current) {
          resolveMyLocation(false);
        }
      });
    }
  }

  async function resolveMyLocation(select: boolean) {
    if (locatingRef.current) return;
    locatingRef.current = true;
    if (select) wantSelectTokenRef.current = locateTokenRef.current;
    const startToken = locateTokenRef.current;
    setLocating(true);
    setLocateError(null);
    try {
      const located = await locateCity();
      myLocationRef.current = located;
      setMyLocation(located);
      if (wantSelectTokenRef.current === locateTokenRef.current) {
        selectCity(located.city);
      }
    } catch (e) {
      const relevant =
        startToken === locateTokenRef.current ||
        wantSelectTokenRef.current === locateTokenRef.current;
      if (relevant) {
        setLocateError(e instanceof Error ? e.message : 'Could not find your location');
      }
    } finally {
      wantSelectTokenRef.current = null;
      locatingRef.current = false;
      setLocating(false);
    }
  }

  function onMyLocationPress() {
    if (locatingRef.current) {
      wantSelectTokenRef.current = locateTokenRef.current;
      return;
    }
    if (myLocationRef.current) {
      selectCity(myLocationRef.current.city);
    } else {
      resolveMyLocation(true);
    }
  }

  function selectCategory(next: Category | 'all') {
    if (next !== category) {
      setEvents(null);
      setCategory(next);
    }
  }

  const cityLabel = city === null ? '…' : city === '' ? 'All cities' : city;
  const query = citySearch.trim();
  const suggestions = query ? citySearchResults : [];
  const myLocationSubtitle = locating
    ? 'Finding you…'
    : myLocation
      ? [myLocation.city, myLocation.region].filter(Boolean).join(', ')
      : locateError ?? 'Use your current location';

  const score = useMemo(() => vibeScore(events ?? []), [events]);
  const gaugeValue = score / 100;
  const tonightCount = events?.length ?? 0;
  const interestedTotal = useMemo(
    () => (events ?? []).reduce((n, e) => n + e.interested, 0),
    [events]
  );
  const latestPct = tonightCount ? Math.min(100, Math.round((interestedTotal / tonightCount) * 12)) : 0;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={{ flex: 1 }}>
        {/* Reference-style top bar: filter left, title center, city pill right */}
        <View style={styles.topBar}>
          <Pressable hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="options-outline" size={20} color={glass.textMuted} />
          </Pressable>
          <Text style={styles.screenTitle}>Tonight's Connection Profile</Text>
          <Pressable
            onPress={toggleCityMenu}
            style={({ pressed }) => [styles.cityPill, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.cityPillText} numberOfLines={1}>
              {cityLabel}
            </Text>
          </Pressable>
        </View>

        {city === null && error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <Button title="Try again" variant="ghost" onPress={() => load(() => true)} />
          </View>
        ) : city === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Hero milky card — Match Vibe Index + gauge */}
            <MilkyCard radius={radius.milkyLg} contentStyle={styles.heroCard}>
              <View style={styles.heroTop}>
                <View style={styles.heroLeft}>
                  <Text style={styles.heroLabel}>Match Vibe Index</Text>
                  <View style={styles.heroNumberRow}>
                    <Text style={styles.heroNumber}>{score}</Text>
                    <Text style={styles.heroUnit}>MVI</Text>
                  </View>
                </View>
                <View style={styles.heroIndicators}>
                  <View style={styles.indicatorChip}>
                    <Ionicons name="people-outline" size={14} color={glass.text} />
                    <Text style={styles.indicatorNum}>+{Math.min(9, (events ?? []).filter((e) => e.friendGoing).length)}</Text>
                  </View>
                  <View style={styles.indicatorChip}>
                    <Ionicons name="heart-outline" size={14} color={glass.text} />
                    <Text style={styles.indicatorNum}>{interestedTotal}</Text>
                  </View>
                </View>
              </View>

              <VibeGauge value={gaugeValue} />

              <View style={styles.gaugeLabels}>
                <Text style={styles.gaugeLabel}>Pass</Text>
                <Text style={styles.gaugeLabel}>Match</Text>
              </View>

              <View style={styles.insightBlock}>
                <Text style={styles.insightTitle}>Smart Connection Insight</Text>
                <Text style={styles.insightBody}>
                  {tonightCount > 0
                    ? `${tonightCount} gatherings in ${city} tonight — your social window is opening.`
                    : `Quiet in ${city} right now — be the one who starts something worth showing up for.`}
                </Text>
              </View>
            </MilkyCard>

            {/* Twin bottom milky cards */}
            <View style={styles.twinRow}>
              <MilkyCard radius={radius.milky} style={styles.twinCard} contentStyle={styles.twinInner}>
                <Text style={styles.twinLabel}>Latest Interest</Text>
                <Text style={styles.twinValue}>{latestPct || 0}%</Text>
                <Pressable style={({ pressed }) => [styles.donePill, pressed && { opacity: 0.9 }]}>
                  <Ionicons name="heart" size={12} color="#0A0A0A" />
                  <Text style={styles.doneText}>INTO IT</Text>
                </Pressable>
              </MilkyCard>
              <MilkyCard radius={radius.milky} style={styles.twinCard} contentStyle={styles.twinInner}>
                <Text style={styles.twinLabel}>Active Tonight</Text>
                <Text style={styles.twinValue}>{tonightCount}</Text>
                <Text style={styles.twinUnit}>events</Text>
              </MilkyCard>
            </View>

            {/* Category filters — glass pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {CATEGORY_CHIPS.map((chip) => {
                const active = category === chip.key;
                return (
                  <Pressable key={chip.key} onPress={() => selectCategory(chip.key)}>
                    <GlassPill active={active} style={styles.chipPill}>
                      <View style={styles.chipInner}>
                        <Ionicons
                          name={CATEGORY_ICONS[chip.key]}
                          size={13}
                          color={active ? colors.text : glass.textMuted}
                        />
                        <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                          {chip.label}
                        </Text>
                      </View>
                    </GlassPill>
                  </Pressable>
                );
              })}
            </ScrollView>

            {error ? (
              <View style={styles.inlineState}>
                <Text style={styles.errorText}>{error}</Text>
                <Button title="Try again" variant="ghost" onPress={() => load(() => true)} />
              </View>
            ) : events === null ? (
              <View style={styles.inlineState}>
                <ActivityIndicator color={colors.accent} size="large" />
              </View>
            ) : events.length === 0 ? (
              <View style={styles.inlineState}>
                <Text style={styles.emptyText}>
                  Nothing here yet — be the first to throw something public in {city || 'your city'}
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {events.map((event) => (
                  <ExploreCard key={event.id} event={event} />
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {cityMenuOpen ? (
          <>
            <Pressable style={styles.menuBackdrop} onPress={closeCityMenu} />
            <MilkyCard radius={radius.milkySm} style={styles.cityMenu} contentStyle={{ padding: 0 }}>
              <View style={styles.citySearchRow}>
                <Ionicons name="search" size={16} color={glass.textMuted} />
                <TextInput
                  value={citySearch}
                  onChangeText={setCitySearch}
                  placeholder="Search any city…"
                  placeholderTextColor={glass.textFaint}
                  style={styles.citySearchInput}
                  autoFocus
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={() => {
                    if (!citySearching && suggestions[0]) selectCity(suggestions[0]);
                  }}
                />
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 280 }}>
                {query ? (
                  <>
                    {suggestions.map((option, index) => {
                      const active = option === city;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => selectCity(option)}
                          style={[
                            styles.menuItem,
                            index < suggestions.length - 1 && styles.menuItemBorder,
                          ]}
                        >
                          <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>
                            {option}
                          </Text>
                          {active ? (
                            <Ionicons name="checkmark" size={16} color={colors.text} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                    {citySearching ? (
                      <View style={styles.citySearchState}>
                        <ActivityIndicator size="small" color={colors.accent} />
                      </View>
                    ) : suggestions.length === 0 && query.length >= 2 ? (
                      <Text style={styles.citySearchEmpty}>No city by that name</Text>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Pressable
                      onPress={onMyLocationPress}
                      style={[styles.locationRow, styles.menuItemBorder]}
                    >
                      <Ionicons name="navigate-outline" size={18} color={colors.text} />
                      <View style={styles.locationTextWrap}>
                        <Text style={styles.menuItemText}>My Location</Text>
                        <Text style={styles.locationSubtitle} numberOfLines={1}>
                          {myLocationSubtitle}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => selectCity('')}
                      style={[styles.menuItem, recentCities.length > 0 && styles.menuItemBorder]}
                    >
                      <Text style={[styles.menuItemText, city === '' && styles.menuItemTextActive]}>
                        All cities
                      </Text>
                    </Pressable>
                    {recentCities.map((option, index) => (
                      <Pressable
                        key={option}
                        onPress={() => selectCity(option)}
                        style={[
                          styles.menuItem,
                          index < recentCities.length - 1 && styles.menuItemBorder,
                        ]}
                      >
                        <Text style={[styles.menuItemText, option === city && styles.menuItemTextActive]}>
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </>
                )}
              </ScrollView>
            </MilkyCard>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    ...thinLabel(13),
    color: glass.textMuted,
    flex: 1,
    textAlign: 'center',
  },
  cityPill: {
    backgroundColor: glass.fillLite,
    borderWidth: 1,
    borderColor: glass.borderSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 110,
  },
  cityPillText: {
    ...thinLabel(12),
    color: glass.text,
    fontStyle: 'normal',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 3,
    gap: spacing.md,
  },
  heroCard: {
    paddingTop: 22,
    paddingBottom: 18,
    gap: 4,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  heroLeft: { gap: 2 },
  heroLabel: {
    ...thinLabel(12),
    color: glass.textMuted,
  },
  heroNumberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  heroNumber: {
    ...thinDisplay(72),
    color: glass.text,
    lineHeight: 68,
  },
  heroUnit: {
    ...thinLabel(14),
    color: glass.textMuted,
    marginBottom: 10,
  },
  heroIndicators: { gap: 8, alignItems: 'flex-end' },
  indicatorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: glass.borderSoft,
  },
  indicatorNum: {
    ...thinLabel(11),
    color: glass.text,
    fontStyle: 'normal',
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    marginTop: -6,
  },
  gaugeLabel: {
    ...thinLabel(11),
    color: glass.textFaint,
  },
  insightBlock: {
    marginTop: spacing.md,
    gap: 6,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: glass.borderSoft,
  },
  insightTitle: {
    ...thinLabel(14),
    color: glass.text,
    fontStyle: 'italic',
  },
  insightBody: {
    ...thinLabel(12),
    color: glass.textMuted,
    lineHeight: 18,
  },
  twinRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  twinCard: { flex: 1 },
  twinInner: {
    minHeight: 130,
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  twinLabel: {
    ...thinLabel(12),
    color: glass.textMuted,
  },
  twinValue: {
    ...thinDisplay(42),
    color: glass.text,
  },
  twinUnit: {
    ...thinLabel(11),
    color: glass.textFaint,
    marginTop: -4,
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  doneText: {
    ...uiText(11, '700'),
    color: '#0A0A0A',
    letterSpacing: 0.6,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipPill: { paddingHorizontal: 12, paddingVertical: 7 },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipLabel: {
    ...thinLabel(12),
    color: glass.textMuted,
    fontStyle: 'normal',
  },
  chipLabelActive: { color: glass.text },
  inlineState: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyText: {
    ...thinLabel(14),
    color: glass.textMuted,
    textAlign: 'center',
  },
  errorText: {
    ...uiText(15),
    color: colors.text,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  card: { width: '48%' },
  cardInner: { padding: 0, overflow: 'hidden' },
  poster: { height: 140 },
  cardBody: { padding: spacing.sm, paddingHorizontal: spacing.md, gap: 4 },
  friendStrip: { ...thinLabel(11), color: glass.textFaint, fontStyle: 'normal' },
  friendName: { color: glass.text, fontStyle: 'italic' },
  cardTitle: { ...thinLabel(14), color: glass.text, fontStyle: 'normal' },
  cardMeta: { ...thinLabel(11), color: glass.textMuted, fontStyle: 'normal' },
  facesRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  faceWrap: { borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.4)' },
  facesLabel: { ...thinLabel(10), color: glass.textFaint, fontStyle: 'normal' },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
  },
  cityMenu: {
    position: 'absolute',
    top: 64,
    right: spacing.md,
    left: spacing.md,
    zIndex: 20,
  },
  citySearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: glass.borderSoft,
  },
  citySearchInput: {
    flex: 1,
    color: glass.text,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 24,
    paddingVertical: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: glass.borderSoft,
  },
  menuItemText: {
    ...thinLabel(14),
    color: glass.text,
    fontStyle: 'normal',
  },
  menuItemTextActive: { color: glass.text, fontStyle: 'italic' },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  locationTextWrap: { flex: 1, gap: 2 },
  locationSubtitle: {
    ...thinLabel(12),
    color: glass.textFaint,
    fontStyle: 'normal',
  },
  citySearchState: { alignItems: 'center', paddingVertical: spacing.md },
  citySearchEmpty: {
    ...thinLabel(13),
    color: glass.textMuted,
    padding: spacing.md,
    fontStyle: 'normal',
  },
});
