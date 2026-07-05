import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES, CATEGORY_META, type Category, type ExploreEvent } from '../../shared/types';
import { api } from '../../lib/api';
import { citySuggestions } from '../../lib/cities';
import { hasLocationPermission, locateCity, type LocatedCity } from '../../lib/location';
import { getRecentCities, recordRecentCity } from '../../lib/recentCities';
import { shareText } from '../../lib/share';
import { colors, radius, spacing, shadow } from '../../lib/theme';
import { titleFontStyle, display, uiText, kicker } from '../../lib/fonts';
import { CoverGradient } from '../../components/CoverGradient';
import { Button } from '../../components/ui';
import { withScreenBackground } from '../../components/ScreenBackground';
import { formatEventDate } from '../../components/EventCard';

const CATEGORY_CHIPS: { key: Category | 'all'; emoji: string; label: string }[] = [
  { key: 'all', emoji: '🔍', label: 'All' },
  ...CATEGORIES.map((c) => ({
    key: c,
    emoji: CATEGORY_META[c].emoji,
    label: CATEGORY_META[c].label,
  })),
];

async function shareEvent(event: ExploreEvent) {
  const url = Linking.createURL(`e/${event.slug}`);
  await shareText(
    `${event.title} — ${formatEventDate(event.date)} in ${event.city}.\nOpen in Hausi: ${url}`,
    url
  );
}

function ExploreCard({ event }: { event: ExploreEvent }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.slug}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <CoverGradient theme={event.coverTheme} image={event.coverImage} style={styles.poster} emojiOpacity={0.25}>
        <Text style={[styles.posterTitle, titleFontStyle(event.titleFont)]} numberOfLines={3}>
          {event.title}
        </Text>
      </CoverGradient>
      <View style={styles.cardBody}>
        {event.friendGoing ? (
          <Text style={styles.friendStrip} numberOfLines={1}>
            {event.friendGoing.avatarEmoji}{' '}
            <Text style={styles.friendName}>{event.friendGoing.name}</Text> is interested
          </Text>
        ) : null}
        <Text style={styles.cardTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {formatEventDate(event.date)} · {event.city}
        </Text>
        {event.description ? (
          <Text style={styles.cardDescription} numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}
        <View style={styles.cardFooter}>
          <Text style={styles.interested}>⭐ {event.interested} Interested</Text>
          <Pressable onPress={() => shareEvent(event)} hitSlop={10}>
            <Ionicons name="share-outline" size={18} color={colors.muted} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export default withScreenBackground(ExploreScreen);

function ExploreScreen() {
  // city: null = not resolved yet, '' = all cities, otherwise a city name.
  const [city, setCity] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [events, setEvents] = useState<ExploreEvent[] | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
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

  const load = useCallback(
    async (isActive: () => boolean) => {
      try {
        let target = city;
        if (target === null) {
          // First load: default to the user's own city from the home feed.
          const feed = await api.home().catch(() => null);
          target = feed?.city ?? '';
        }
        const res = await api.explore(target || undefined, category);
        if (!isActive()) return;
        setCities(res.cities);
        if (city === null) {
          // Lock in the default city; fall back to the first city from the API.
          const fallback = res.cities[0] ?? '';
          setCity(target || fallback);
          if (!target && fallback) return; // effect re-runs scoped to the fallback
        }
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
  // and recents instead of the full city list.
  const suggestions = query ? citySuggestions(cities, citySearch) : [];
  const exactMatch = suggestions.some((s) => s.toLowerCase() === query.toLowerCase());
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
            <Text style={styles.headerKicker}>Discover</Text>
            <Text style={styles.headerTitle}>Explore</Text>
          </View>
          <Pressable
            onPress={toggleCityMenu}
            style={({ pressed }) => [styles.cityPill, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.cityPillText} numberOfLines={1}>
              📍 {cityLabel}
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
            <Button title="Try again" variant="ghost" tone="ink" onPress={() => load(() => true)} />
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
                    <Text style={styles.chipEmoji}>{chip.emoji}</Text>
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <CoverGradient theme="midnight" style={styles.hero} emojiOpacity={0.2}>
              <Text style={styles.heroKicker}>Get out there</Text>
              <Text style={styles.heroTitle}>
                The streets are <Text style={styles.heroTitleItalic}>calling</Text>
              </Text>
              <Text style={styles.heroSubtitle}>
                {city ? `See what's happening in ${city}` : "See what's happening everywhere"}
              </Text>
            </CoverGradient>

            <Text style={styles.sectionKicker}>New faces</Text>
            <Text style={styles.sectionTitle}>
              Meet new <Text style={styles.sectionTitleItalic}>people</Text>
            </Text>

            {error ? (
              <View style={styles.inlineState}>
                <Text style={styles.errorEmoji}>🫠</Text>
                <Text style={styles.errorText}>{error}</Text>
                <Button title="Try again" variant="ghost" tone="ink" onPress={() => load(() => true)} />
              </View>
            ) : events === null ? (
              <View style={styles.inlineState}>
                <ActivityIndicator color={colors.accent} size="large" />
              </View>
            ) : events.length === 0 ? (
              <View style={styles.inlineState}>
                <Text style={styles.errorEmoji}>🫥</Text>
                <Text style={styles.emptyText}>
                  Nothing here yet — be the first to throw something public in{' '}
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
                    const q = citySearch.trim();
                    if (q) selectCity(suggestions[0] ?? q);
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
                            (!exactMatch || index < suggestions.length - 1) &&
                              styles.menuItemBorder,
                          ]}
                        >
                          <Text
                            style={[styles.menuItemText, active && styles.menuItemTextActive]}
                          >
                            📍 {option}
                          </Text>
                          {active ? (
                            <Ionicons name="checkmark" size={16} color={colors.accent} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                    {!exactMatch ? (
                      <Pressable onPress={() => selectCity(query)} style={styles.menuItem}>
                        <Text style={styles.menuItemText}>🔎 Search “{query}”</Text>
                      </Pressable>
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
                      <Text style={[styles.menuItemText, city === '' && styles.menuItemTextActive]}>
                        🌍 All cities
                      </Text>
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
                              <Text
                                style={[
                                  styles.menuItemText,
                                  active && styles.menuItemTextActive,
                                ]}
                              >
                                📍 {option}
                              </Text>
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerTitleWrap: {
    gap: spacing.xs,
  },
  headerKicker: {
    ...kicker(colors.accent),
  },
  headerTitle: {
    ...display(44),
    color: colors.text,
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
    ...uiText(14, '700'),
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
  content: {
    paddingBottom: spacing.xl * 2,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  chipEmoji: {
    fontSize: 14,
  },
  chipLabel: {
    ...uiText(14, '700'),
    color: colors.text,
  },
  chipLabelActive: {
    // Sits on the black active pill — white is intentional here.
    color: colors.onAccent,
  },
  hero: {
    minHeight: 200,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadow.card,
  },
  // White text below sits ON the dark "midnight" photo hero — intentional.
  heroKicker: {
    ...kicker('#fff'),
    opacity: 0.9,
  },
  heroTitle: {
    ...display(38),
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroTitleItalic: {
    fontStyle: 'italic',
  },
  heroSubtitle: {
    ...uiText(15),
    color: '#fff',
    opacity: 0.85,
  },
  sectionKicker: {
    ...kicker(colors.accent),
    marginHorizontal: spacing.md,
    marginTop: spacing.xl,
  },
  sectionTitle: {
    ...display(28),
    color: colors.text,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  sectionTitleItalic: {
    fontStyle: 'italic',
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
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadow.card,
  },
  poster: {
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  posterTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
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
    ...uiText(15, '800'),
    color: colors.text,
  },
  cardMeta: {
    ...uiText(13, '700'),
    color: colors.accent,
  },
  cardDescription: {
    ...uiText(13),
    color: colors.muted,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  interested: {
    ...uiText(13, '700'),
    color: colors.text,
  },
});
