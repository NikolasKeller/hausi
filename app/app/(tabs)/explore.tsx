import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { colors, radius, spacing, shadow } from '../../lib/theme';
import { display, uiText, kicker } from '../../lib/fonts';
import { CoverGradient } from '../../components/CoverGradient';
import { Button } from '../../components/ui';
import { withScreenBackground } from '../../components/ScreenBackground';
import { formatEventDate } from '../../components/EventCard';
import { Avatar } from '../../components/Avatar';
import { ChromeCard } from '../../components/glass';

// Monochrome line icons instead of the colorful category emojis — everything
// in the chrome UI stays black/silver; color is reserved for event artwork.
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

function ExploreCard({ event }: { event: ExploreEvent }) {
  const router = useRouter();
  const faces = event.interestedAvatars.slice(0, 3);
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.slug}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <ChromeCard radius={radius.lg} style={shadow.card}>
        <CoverGradient
          theme={event.coverTheme}
          image={event.coverImage}
          style={styles.poster}
          emojiOpacity={0.25}
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
              <Text style={styles.facesLabel}>+{event.interested} going</Text>
            </View>
          ) : null}
        </View>
      </ChromeCard>
    </Pressable>
  );
}

export default withScreenBackground(ExploreScreen);

function ExploreScreen() {
  // city: null = not resolved yet, '' = all cities, otherwise a city name.
  const [city, setCity] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [events, setEvents] = useState<ExploreEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  // Live real-city results for the search box (Open-Meteo) — so only cities
  // that actually exist can be searched and viewed, never a made-up name.
  const [citySearchResults, setCitySearchResults] = useState<string[]>([]);
  const [citySearching, setCitySearching] = useState(false);
  const [recentCities, setRecentCities] = useState<string[]>([]);
  const [myLocation, setMyLocation] = useState<LocatedCity | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  // Refs mirror state so async locate callbacks read fresh values, not the
  // closure from the render they were started in.
  const cityRef = useRef(city);
  const myLocationRef = useRef<LocatedCity | null>(null);
  const locatingRef = useRef(false);
  // Token value at the moment the user asked to select the locate result;
  // null = no pending intent. Comparing against the live token on landing
  // drops intents the user has since superseded, not fresh ones.
  const wantSelectTokenRef = useRef<number | null>(null);
  // Bumped on every selection or menu close; a locate intent stamped with an
  // older token must not auto-select (the user moved on while in flight).
  const locateTokenRef = useRef(0);
  useEffect(() => {
    cityRef.current = city;
  }, [city]);

  // Debounced live city search: query Open-Meteo for real cities as the user
  // types, deduped by name. Aborts the in-flight request on each keystroke.
  useEffect(() => {
    const q = citySearch.trim();
    // Clear stale results on every keystroke so the previous query's cities
    // don't linger under the spinner while the new query is in flight.
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
          // First load: pick the initial city from a full (all-cities) fetch.
          // Prefer the user's saved city when it actually has events; otherwise
          // open on the city with the MOST public events (so Explore never
          // opens empty, and lands on the busiest place — e.g. Munich — rather
          // than an alphabetical first). The "Use my location" button still
          // lets the user switch to where they are.
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
          return; // effect re-runs scoped to the chosen city
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
    if (next) {
      recordRecentCity(next).then(setRecentCities);
    }
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
    // Only resolve quietly when permission was already granted — opening the
    // menu should never trigger a surprise permission prompt.
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
      // Apply only if the user hasn't picked something else or closed the
      // menu since expressing the intent to select.
      if (wantSelectTokenRef.current === locateTokenRef.current) {
        selectCity(located.city);
      }
    } catch (e) {
      // Suppress errors nobody is waiting on (quiet resolve after the user
      // already moved on) so a stale message doesn't greet the next open.
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
      // A resolve is in flight — apply its result when it lands.
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
  // Suggestions only appear while typing — the resting menu shows My Location
  // and recents instead. Results are real cities from the live geocoder.
  const suggestions = query ? citySearchResults : [];
  const myLocationSubtitle = locating
    ? 'Finding you…'
    : myLocation
      ? [myLocation.city, myLocation.region].filter(Boolean).join(', ')
      : locateError ?? 'Use your current location';

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={{ flex: 1 }}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleWrap}>
            {/* The liquid-chrome wordmark artwork — the brand IS the header. */}
            <Image
              source={require('../../assets/wordmark-chrome-dark.png')}
              style={styles.headerWordmark}
              resizeMode="contain"
              accessibilityLabel="iykyk"
            />
          </View>
          <Pressable
            onPress={toggleCityMenu}
            style={({ pressed }) => [styles.cityPill, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="location-outline" size={14} color={colors.text} />
            <Text style={styles.cityPillText} numberOfLines={1}>
              {cityLabel}
            </Text>
            <Ionicons
              name={cityMenuOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.text}
            />
          </Pressable>
        </View>

        {city === null && error ? (
          <View style={styles.center}>
            <Text style={styles.errorEmoji}>🫠</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Button title="Try again" variant="ghost" onPress={() => load(() => true)} />
          </View>
        ) : city === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {CATEGORY_CHIPS.map((chip) => {
                const active = category === chip.key;
                return (
                  <Pressable
                    key={chip.key}
                    onPress={() => selectCategory(chip.key)}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons
                      name={CATEGORY_ICONS[chip.key]}
                      size={14}
                      color={active ? colors.onInk : colors.muted}
                    />
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {error ? (
              <View style={styles.inlineState}>
                <Text style={styles.errorEmoji}>🫠</Text>
                <Text style={styles.errorText}>{error}</Text>
                <Button title="Try again" variant="ghost" onPress={() => load(() => true)} />
              </View>
            ) : events === null ? (
              <View style={styles.inlineState}>
                <ActivityIndicator color={colors.accent} size="large" />
              </View>
            ) : events.length === 0 ? (
              <View style={styles.inlineState}>
                <Text style={styles.errorEmoji}>🫥</Text>
                <Text style={styles.emptyText}>
                  Nothing here yet - be the first to throw something public in{' '}
                  {city || 'your city'}
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
            <View style={styles.cityMenu}>
              <View style={styles.citySearchRow}>
                <Ionicons name="search" size={16} color={colors.muted} />
                <TextInput
                  value={citySearch}
                  onChangeText={setCitySearch}
                  placeholder="Search any city…"
                  placeholderTextColor={colors.muted}
                  style={styles.citySearchInput}
                  autoFocus
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={() => {
                    // Only commit a real city — the top live result — and only
                    // once results match the current query (not a stale prefix).
                    if (!citySearching && suggestions[0]) selectCity(suggestions[0]);
                  }}
                />
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
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
                          <View style={styles.menuItemLeft}>
                            <Ionicons name="location-outline" size={15} color={colors.muted} />
                            <Text
                              style={[styles.menuItemText, active && styles.menuItemTextActive]}
                            >
                              {option}
                            </Text>
                          </View>
                          {active ? (
                            <Ionicons name="checkmark" size={16} color={colors.accent} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                    {citySearching ? (
                      <View style={styles.citySearchState}>
                        <ActivityIndicator size="small" color={colors.accent} />
                      </View>
                    ) : suggestions.length === 0 && query.length >= 2 ? (
                      <Text style={styles.citySearchEmpty}>
                        No city by that name - check the spelling
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Pressable
                      onPress={onMyLocationPress}
                      style={[styles.locationRow, styles.menuItemBorder]}
                    >
                      <View style={styles.locationIcon}>
                        {locating ? (
                          <ActivityIndicator size="small" color={colors.accent} />
                        ) : (
                          <Ionicons name="navigate" size={18} color={colors.text} />
                        )}
                      </View>
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
                      <View style={styles.menuItemLeft}>
                        <Ionicons name="earth-outline" size={15} color={colors.muted} />
                        <Text style={[styles.menuItemText, city === '' && styles.menuItemTextActive]}>
                          All cities
                        </Text>
                      </View>
                      {city === '' ? (
                        <Ionicons name="checkmark" size={16} color={colors.accent} />
                      ) : null}
                    </Pressable>
                    {recentCities.length > 0 ? (
                      <>
                        <Text style={styles.recentHeader}>Recent locations</Text>
                        {recentCities.map((option, index) => {
                          const active = option === city;
                          return (
                            <Pressable
                              key={option}
                              onPress={() => selectCity(option)}
                              style={[
                                styles.menuItem,
                                index < recentCities.length - 1 && styles.menuItemBorder,
                              ]}
                            >
                              <View style={styles.menuItemLeft}>
                                <Ionicons name="time-outline" size={15} color={colors.muted} />
                                <Text
                                  style={[
                                    styles.menuItemText,
                                    active && styles.menuItemTextActive,
                                  ]}
                                >
                                  {option}
                                </Text>
                              </View>
                              {active ? (
                                <Ionicons name="checkmark" size={16} color={colors.accent} />
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </>
                    ) : null}
                  </>
                )}
              </ScrollView>
            </View>
          </>
        ) : null}
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
    fontSize: 44,
  },
  errorText: {
    ...uiText(16),
    color: colors.text,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    // Generous, Partiful-style breathing room around the wordmark.
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerTitleWrap: {
    gap: spacing.xs,
  },
  headerWordmark: {
    // The cropped artwork is 940x440 — keep its ratio at header scale.
    width: 118,
    height: 55,
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    maxWidth: 200,
    ...shadow.card,
  },
  cityPillText: {
    ...uiText(14, '600'),
    color: colors.text,
    flexShrink: 1,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
  },
  cityMenu: {
    position: 'absolute',
    top: 78,
    right: spacing.md,
    left: spacing.md,
    maxHeight: 340,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    overflow: 'hidden',
    zIndex: 20,
    ...shadow.float,
  },
  citySearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.inputBg,
  },
  citySearchInput: {
    flex: 1,
    color: colors.text,
    // 16px avoids mobile Safari's auto-zoom when this autoFocus input opens.
    fontSize: 16,
    // Give the line box its full height (+ a hair of headroom) so the
    // placeholder isn't clipped top/bottom — RN-Web collapses a single-line
    // input with paddingVertical:0 and no lineHeight down onto its text.
    lineHeight: 22,
    minHeight: 24,
    paddingVertical: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  menuItemText: {
    ...uiText(15),
    color: colors.text,
  },
  menuItemTextActive: {
    ...uiText(15, '700'),
    color: colors.accent,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  locationIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTextWrap: {
    flex: 1,
    gap: 2,
  },
  locationSubtitle: {
    ...uiText(13),
    color: colors.muted,
  },
  recentHeader: {
    ...kicker(colors.muted),
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  citySearchState: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  citySearchEmpty: {
    ...uiText(14),
    color: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  content: {
    paddingBottom: spacing.xl * 2,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    // Clear separation between the chip row and the event grid below.
    paddingBottom: spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipLabel: {
    ...uiText(14, '600'),
    color: colors.text,
  },
  chipLabelActive: {
    // Sits on the white active pill (colors.ink) — needs dark ink to stay legible.
    color: colors.onInk,
  },
  inlineState: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyText: {
    ...uiText(15),
    color: colors.muted,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  card: {
    width: '48%',
  },
  poster: {
    height: 240,
  },
  cardBody: {
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  friendStrip: {
    ...uiText(12),
    color: colors.muted,
  },
  friendName: {
    color: colors.text,
    fontWeight: '700',
  },
  cardTitle: {
    ...uiText(15, '700'),
    color: colors.text,
  },
  cardMeta: {
    ...uiText(13, '600'),
    color: colors.muted,
  },
  facesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  faceWrap: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#121212',
  },
  facesLabel: {
    ...uiText(12, '600'),
    color: colors.muted,
    marginLeft: 2,
  },
});
