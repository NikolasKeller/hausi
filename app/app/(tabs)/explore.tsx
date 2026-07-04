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
import { colors, radius, spacing } from '../../lib/theme';
import { titleFontStyle } from '../../lib/fonts';
import { CoverGradient } from '../../components/CoverGradient';
import { Button } from '../../components/ui';
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

export default function ExploreScreen() {
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
          <Text style={styles.headerTitle}>Explore</Text>
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
                    style={[styles.chip, active && styles.chipActive]}
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
              <Text style={styles.heroTitle}>The streets are calling</Text>
              <Text style={styles.heroSubtitle}>
                {city ? `See what's happening in ${city}` : "See what's happening everywhere"}
              </Text>
            </CoverGradient>

            <Text style={styles.sectionTitle}>Meet new people! 👋</Text>

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
    backgroundColor: colors.bg,
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
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
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
  },
  cityPillText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
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
    top: 58,
    right: spacing.md,
    left: spacing.md,
    maxHeight: 340,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    overflow: 'hidden',
    zIndex: 20,
    elevation: 8,
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
    color: colors.text,
    fontSize: 15,
  },
  menuItemTextActive: {
    color: colors.accent,
    fontWeight: '700',
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
    borderColor: colors.accent,
    backgroundColor: '#241C3B',
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  chipLabelActive: {
    color: colors.text,
  },
  hero: {
    minHeight: 160,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroSubtitle: {
    color: colors.muted,
    fontSize: 15,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  inlineState: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
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
  },
  poster: {
    height: 180,
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
    color: colors.muted,
    fontSize: 12,
  },
  friendName: {
    color: colors.text,
    fontWeight: '700',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cardMeta: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  cardDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  interested: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
