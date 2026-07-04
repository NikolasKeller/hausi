import React, { useCallback, useState } from 'react';
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
    setCityMenuOpen(false);
    setCitySearch('');
    if (next !== city) {
      setEvents(null);
      setCity(next);
    }
  }

  function selectCategory(next: Category | 'all') {
    if (next !== category) {
      setEvents(null);
      setCategory(next);
    }
  }

  const cityLabel = city === null ? '…' : city === '' ? 'All cities' : city;
  // Search across every known city plus the common-cities list; free text works too.
  const suggestions = citySuggestions(cities, citySearch);
  const cityOptions = citySearch.trim() ? suggestions : ['', ...suggestions];
  const exactMatch = suggestions.some(
    (s) => s.toLowerCase() === citySearch.trim().toLowerCase()
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={{ flex: 1 }}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerKicker}>Discover</Text>
            <Text style={styles.headerTitle}>Explore</Text>
          </View>
          <Pressable
            onPress={() => setCityMenuOpen((open) => !open)}
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
            <Pressable
              style={styles.menuBackdrop}
              onPress={() => {
                setCityMenuOpen(false);
                setCitySearch('');
              }}
            />
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
                {citySearch.trim() && !exactMatch ? (
                  <Pressable
                    onPress={() => selectCity(citySearch.trim())}
                    style={[styles.menuItem, styles.menuItemBorder]}
                  >
                    <Text style={styles.menuItemText}>🔎 Search “{citySearch.trim()}”</Text>
                  </Pressable>
                ) : null}
                {cityOptions.map((option, index) => {
                  const active = option === city;
                  return (
                    <Pressable
                      key={option || 'all'}
                      onPress={() => selectCity(option)}
                      style={[
                        styles.menuItem,
                        index < cityOptions.length - 1 && styles.menuItemBorder,
                      ]}
                    >
                      <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>
                        {option === '' ? '🌍 All cities' : `📍 ${option}`}
                      </Text>
                      {active ? (
                        <Ionicons name="checkmark" size={16} color={colors.accent} />
                      ) : null}
                    </Pressable>
                  );
                })}
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
    fontSize: 15,
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
