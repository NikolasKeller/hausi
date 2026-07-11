import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
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
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { type ExploreEvent } from '../../shared/types';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  eventDateFilterLabel,
  fromLocalDateKey,
  getEventDateRange,
  startOfLocalDay,
  toLocalDateKey,
  type EventDateFilter,
  type EventDatePreset,
} from '../../lib/eventDateFilter';
import { searchCities } from '../../lib/geocoding';
import { hasLocationPermission, locateCity, type LocatedCity } from '../../lib/location';
import { getRecentCities, recordRecentCity } from '../../lib/recentCities';
import { colors, radius, spacing, shadow } from '../../lib/theme';
import { uiText, kicker } from '../../lib/fonts';
import { CoverGradient } from '../../components/CoverGradient';
import { DateFilterSheet } from '../../components/DateFilterSheet';
import { Button } from '../../components/ui';
import { withScreenBackground } from '../../components/ScreenBackground';
import { formatEventDate } from '../../components/EventCard';
import { TonightBanner } from '../../components/TonightBanner';

// The chrome "iykyk" wordmark used as the header logo (same asset family as the
// welcome screen).
const WORDMARK = require('../../assets/wordmark-chrome-header.png');

const DATE_CHIPS: { key: EventDatePreset; label: string }[] = [
  { key: 'any', label: 'Any date' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'weekend', label: 'This weekend' },
];

function ExploreCard({ event }: { event: ExploreEvent }) {
  const router = useRouter();
  const { user } = useAuth();
  // Favorite = the "interested"/MAYBE RSVP; optimistic with revert on failure.
  const [fav, setFav] = useState(event.myRsvp === 'MAYBE');
  const [favBusy, setFavBusy] = useState(false);

  async function toggleFav() {
    if (!user || favBusy) return;
    const next = !fav;
    setFav(next);
    setFavBusy(true);
    try {
      if (next) await api.rsvp(event.id, 'MAYBE');
      else await api.removeGuest(event.id, user.id);
    } catch {
      setFav(!next);
    } finally {
      setFavBusy(false);
    }
  }

  return (
    <Pressable
      onPress={() => router.push(`/event/${event.slug}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <CoverGradient
        theme={event.coverTheme}
        image={event.coverImage}
        fallback={{
          title: event.title,
          description: event.description,
          category: event.category,
        }}
        style={styles.poster}
      >
        {user ? (
          <Pressable
            onPress={toggleFav}
            disabled={favBusy}
            hitSlop={8}
            style={({ pressed }) => [styles.favBadge, pressed && { opacity: 0.6 }]}
          >
            <Ionicons
              name={fav ? 'heart' : 'heart-outline'}
              size={18}
              color={fav ? colors.danger : '#FFFFFF'}
            />
          </Pressable>
        ) : null}
      </CoverGradient>
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
      </View>
    </Pressable>
  );
}

export default withScreenBackground(ExploreScreen);

function ExploreScreen() {
  // city: null = not resolved yet, '' = all cities, otherwise a city name.
  const [city, setCity] = useState<string | null>(null);
  // Free-text event search: searchInput follows the keystrokes, search is the
  // debounced value that actually drives the (server-side) query.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<EventDateFilter>({ kind: 'any' });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
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

  // Commit the search text after a pause so we don't refetch on every
  // keystroke. The current results stay on screen until the new ones land —
  // no blank flash while typing.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
        const dateRange = getEventDateRange(dateFilter);
        if (city === null) {
          // First load: pick the initial city from a full (all-cities) fetch.
          // Prefer the user's saved city when it actually has events; otherwise
          // open on the city with the MOST public events (so Explore never
          // opens empty, and lands on the busiest place — e.g. Munich — rather
          // than an alphabetical first). The "Use my location" button still
          // lets the user switch to where they are.
          const feed = await api.home().catch(() => null);
          const savedCity = (feed?.city ?? '').trim();
          const all = await api.explore(undefined, dateRange, search);
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
        const res = await api.explore(city || undefined, dateRange, search);
        if (!isActive()) return;
        setEvents(res.events);
        setError(null);
      } catch (e) {
        if (isActive()) setError(e instanceof Error ? e.message : 'Could not load events');
      }
    },
    [city, dateFilter, search]
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

  function selectDatePreset(next: EventDatePreset) {
    if (dateFilter.kind === next) return;
    setEvents(null);
    setDateFilter({ kind: next });
  }

  function selectCustomDate(date: string) {
    if (dateFilter.kind === 'date' && dateFilter.date === date) return;
    setEvents(null);
    setDateFilter({ kind: 'date', date });
  }

  function openCustomDatePicker() {
    const minimum = startOfLocalDay(new Date());
    const current = dateFilter.kind === 'date' ? fromLocalDateKey(dateFilter.date) : null;
    const value = current && current.getTime() >= minimum.getTime() ? current : minimum;

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        minimumDate: minimum,
        mode: 'date',
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) {
            selectCustomDate(toLocalDateKey(selected));
          }
        },
      });
      return;
    }

    setDatePickerOpen(true);
  }

  function clearFilters() {
    if (dateFilter.kind === 'any' && !search && !searchInput) return;
    setEvents(null);
    setDateFilter({ kind: 'any' });
    setSearchInput('');
    setSearch('');
  }

  const cityLabel = city === null ? '…' : city === '' ? 'All cities' : city;
  const hasActiveFilters = dateFilter.kind !== 'any' || search !== '';
  const customDateLabel =
    dateFilter.kind === 'date' ? eventDateFilterLabel(dateFilter) : 'Pick a date';
  const filterSummary = [
    search ? `“${search}”` : null,
    dateFilter.kind !== 'any' ? eventDateFilterLabel(dateFilter) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const pickerDate =
    dateFilter.kind === 'date' ? dateFilter.date : toLocalDateKey(new Date());
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
            {/* Chrome wordmark logo, sized to the height the "Iykyk" text
                header used (display(32)) so the header footprint is unchanged. */}
            <Image source={WORDMARK} style={styles.headerLogo} resizeMode="contain" />
          </View>
          {/* The pill only appears once the city is resolved — no "…" flash.
              The row's height is carried by the logo, so nothing jumps. */}
          {city !== null ? (
            <Pressable
              onPress={toggleCityMenu}
              style={({ pressed }) => [styles.cityPill, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.cityPillText} numberOfLines={1}>
                {cityLabel}
              </Text>
              <Ionicons
                name={cityMenuOpen ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.text}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Same-day ticket reminder — sits between the header and the feed so
            it's visible regardless of the explore feed's loading state. */}
        <TonightBanner />

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
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Free-text event search — matches title, description, city and
                host name, combinable with the date filters below. */}
            <View style={styles.searchRow}>
              <Ionicons name="search" size={16} color={colors.muted} />
              <TextInput
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Search events…"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                onSubmitEditing={() => setSearch(searchInput.trim())}
              />
              {searchInput ? (
                <Pressable
                  onPress={() => {
                    setSearchInput('');
                    setSearch('');
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.filters}>
              <View style={styles.filterHeader}>
                <Text style={styles.filterTitle}>Filters</Text>
                {hasActiveFilters ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear search and date filters"
                    onPress={clearFilters}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.clearFilters,
                      pressed && { opacity: 0.65 },
                    ]}
                  >
                    <Ionicons name="close" size={14} color={colors.muted} />
                    <Text style={styles.clearFiltersText}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.filterGroupLabel}>Date</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {DATE_CHIPS.map((chip) => {
                  const active = dateFilter.kind === chip.key;
                  return (
                    <Pressable
                      key={chip.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => selectDatePreset(chip.key)}
                      style={({ pressed }) => [
                        styles.chip,
                        active && styles.chipActive,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                        {chip.label}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: dateFilter.kind === 'date' }}
                  onPress={openCustomDatePicker}
                  style={({ pressed }) => [
                    styles.chip,
                    styles.customDateChip,
                    dateFilter.kind === 'date' && styles.chipActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color={dateFilter.kind === 'date' ? colors.onInk : colors.text}
                  />
                  <Text
                    style={[
                      styles.chipLabel,
                      dateFilter.kind === 'date' && styles.chipLabelActive,
                    ]}
                  >
                    {customDateLabel}
                  </Text>
                </Pressable>
              </ScrollView>
            </View>

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
                  {hasActiveFilters
                    ? `No events match ${filterSummary} in ${city || 'the selected cities'}.`
                    : `Nothing here yet - be the first to throw something public in ${
                        city || 'your city'
                      }`}
                </Text>
                {hasActiveFilters ? (
                  <Button title="Clear filters" variant="ghost" onPress={clearFilters} />
                ) : null}
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
                          <Text
                            style={[styles.menuItemText, active && styles.menuItemTextActive]}
                          >
                            {option}
                          </Text>
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
                      <Text style={[styles.menuItemText, city === '' && styles.menuItemTextActive]}>
                        All cities
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
                                {option}
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

        {datePickerOpen ? (
          <DateFilterSheet
            value={pickerDate}
            minimumDate={new Date()}
            onSelect={selectCustomDate}
            onClose={() => setDatePickerOpen(false)}
          />
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
    // Center both header elements on one horizontal line: the logo's mid-line
    // and the city pill's mid-line sit at the same height.
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    // Generous, Partiful-style breathing room around the wordmark.
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerTitleWrap: {
    justifyContent: 'center',
  },
  headerLogo: {
    // The asset is now TIGHT-cropped (863×409 — the old file carried ~42%
    // empty transparent space below the letters, which is why every marginTop
    // guess still looked high). With no dead space, the image centre IS the
    // letter centre, so the row's alignItems:'center' lines it up with the
    // city pill exactly — no manual offset needed.
    height: 28,
    width: 28 * (863 / 409),
    // Sit a touch lower than the mathematical centre — the i-dot makes the
    // wordmark read higher than it is, so a small drop looks level with the pill.
    marginTop: 8,
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
    // Solid fill (not the translucent card token) — the filter chips behind
    // the open dropdown otherwise bleed through it.
    backgroundColor: '#141928',
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    ...shadow.card,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    // 16px avoids mobile Safari's auto-zoom; explicit line box keeps the
    // placeholder from clipping on RN-Web (same fix as the city search).
    fontSize: 16,
    lineHeight: 22,
    minHeight: 24,
    paddingVertical: 0,
  },
  filters: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  filterHeader: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  filterTitle: {
    ...kicker(colors.muted),
  },
  clearFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.inputBg,
  },
  clearFiltersText: {
    ...uiText(12, '700'),
    color: colors.muted,
  },
  filterGroupLabel: {
    ...uiText(13, '700'),
    color: colors.text,
    paddingHorizontal: spacing.md,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
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
  customDateChip: {
    gap: 6,
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
  favBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
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
});
