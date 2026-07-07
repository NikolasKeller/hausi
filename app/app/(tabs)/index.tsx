import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ExploreEvent, HomeFeed } from '../../shared/types';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { colors, radius, spacing, shadow } from '../../lib/theme';
import { titleFontStyle, display, displayTitle, uiText, kicker } from '../../lib/fonts';
import { CoverGradient } from '../../components/CoverGradient';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/ui';
import { formatEventDate } from '../../components/EventCard';
import { withScreenBackground } from '../../components/ScreenBackground';
import { hasLocationPermission, locateCity } from '../../lib/location';

export default withScreenBackground(HomeScreen);

// Never a plain "welcome back" — always something cheerful and party-flavored.
const GREETINGS: Array<(name: string) => { text: string }> = [
  (n) => ({ text: `Look who's back - ${n}! 🎉` }),
  (n) => ({ text: `${n} has entered the chat 🎊` }),
  (n) => ({ text: `Ayy, ${n}! 🥳` }),
  (n) => ({ text: `The party missed you, ${n} 💃` }),
  (n) => ({ text: `There they are - ${n} 🕺` }),
  (n) => ({ text: `${n} in the building ✨` }),
  (n) => ({ text: `Confetti's out for ${n} 🎈` }),
];

function pickGreeting(name: string) {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)](name);
}

function HomeScreen() {
  const router = useRouter();
  const { welcomeBack, dismissWelcome } = useAuth();
  const [home, setHome] = useState<HomeFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllMutuals, setShowAllMutuals] = useState(false);
  // Greet a returning user once, on app open, then let it fade.
  const [welcome, setWelcome] = useState<{ text: string } | null>(null);
  useEffect(() => {
    if (!welcomeBack) return;
    setWelcome(pickGreeting(welcomeBack));
    dismissWelcome(); // consume so it won't reappear on tab switches
    const t = setTimeout(() => setWelcome(null), 5000);
    return () => clearTimeout(t);
  }, [welcomeBack, dismissWelcome]);

  // Keep the user's city in sync with where they actually are, so the feed
  // localizes ("Trending in Munich") for returning users too — not just fresh
  // onboarders. Best-effort and silent: only runs when location is already
  // granted (never prompts here), and only writes when the city changed.
  const locationSynced = useRef(false);
  useEffect(() => {
    if (locationSynced.current) return;
    locationSynced.current = true;
    (async () => {
      try {
        if (!(await hasLocationPermission())) return;
        const { city } = await locateCity();
        if (!city) return;
        await api.updateProfile({ city });
        setHome(await api.home());
      } catch {
        // Ignore — keep whatever city we already have.
      }
    })();
  }, []);

  const fetchAll = useCallback(() => api.home(), []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchAll()
        .then((res) => {
          if (!active) return;
          setHome(res);
          setError(null);
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : 'Could not load your feed');
        });
      return () => {
        active = false;
      };
    }, [fetchAll])
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      setHome(await fetchAll());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not refresh');
    } finally {
      setRefreshing(false);
    }
  }

  const header = (
    <View style={styles.headerRow}>
      <View style={styles.wordmarkWrap}>
        <Text style={styles.wordmark}>iykyk</Text>
      </View>
    </View>
  );

  if (error && !home) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>🫠</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Try again" variant="ghost" tone="ink" onPress={onRefresh} loading={refreshing} />
        </View>
      </SafeAreaView>
    );
  }

  if (!home) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // Surface the discover feed's trending events. Prefer the geo-local list
  // (titled with the user's city); fall back to the global list otherwise.
  const city = home.city?.trim();
  const nearby = home.trendingNearby ?? [];
  const trending =
    nearby.length > 0
      ? { title: city ? `Trending in ${city}` : 'Trending near you', list: nearby }
      : { title: 'Trending now', list: home.trendingNow ?? [] };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {header}

        {welcome ? (
          <Pressable onPress={() => setWelcome(null)} style={styles.sectionGroup}>
            <View style={styles.welcomeBanner}>
              <Text style={styles.welcomeText}>{welcome.text}</Text>
            </View>
          </Pressable>
        ) : null}

        {home.palsGoing.length > 0 ? (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionTitle}>Find your mutuals</Text>
            <View style={styles.mutualFeed}>
              {(showAllMutuals ? home.palsGoing : home.palsGoing.slice(0, 3)).map((event) => (
                <MutualCard key={event.id} event={event} />
              ))}
              {home.palsGoing.length > 3 ? (
                <Pressable
                  onPress={() => setShowAllMutuals((v) => !v)}
                  style={({ pressed }) => [styles.seeMore, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.seeMoreText}>{showAllMutuals ? 'See less' : 'See more'}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {trending.list.length > 0 ? (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionTitle}>{trending.title}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              style={styles.horizontalScroll}
            >
              {trending.list.map((event) => (
                <TrendingCard key={event.id} event={event} />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// One entry in the "Find your mutuals" feed: a friend's attribution, the event
// card, then the interested faces + a save (⭐ Interested) toggle.
function MutualCard({ event }: { event: ExploreEvent }) {
  const router = useRouter();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleSaved() {
    if (busy) return;
    const next = !saved;
    setSaved(next); // optimistic — revert if the request fails
    setBusy(true);
    try {
      if (next) await api.rsvp(event.id, 'MAYBE');
      else if (user) await api.removeGuest(event.id, user.id);
    } catch {
      setSaved(!next);
    } finally {
      setBusy(false);
    }
  }

  const faces = event.interestedAvatars.slice(0, 3);
  const interested = event.interested + (saved ? 1 : 0);
  const blurb = event.description.trim()
    ? event.description
    : `${formatEventDate(event.date)}${event.location ? ` · ${event.location}` : ''}`;

  return (
    <View style={styles.mutualEntry}>
      {event.friendGoing ? (
        <View style={styles.mutualAttrib}>
          <Avatar name={event.friendGoing.name} image={event.friendGoing.avatarImage} size={28} />
          <Text style={styles.mutualAttribText} numberOfLines={1}>
            <Text style={styles.mutualName}>{event.friendGoing.name}</Text>
            <Text style={styles.mutualGoing}> is going</Text> 👍
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push(`/event/${event.slug}`)}
        style={({ pressed }) => [styles.mutualCard, pressed && { opacity: 0.85 }]}
      >
        <CoverGradient
          theme={event.coverTheme}
          image={event.coverImage}
          style={styles.mutualCover}
          emojiOpacity={0.3}
        />
        <View style={styles.mutualBody}>
          <Text style={[styles.mutualTitle, titleFontStyle(event.titleFont)]} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.mutualDesc} numberOfLines={3}>
            {blurb}
          </Text>
        </View>
      </Pressable>

      <View style={styles.mutualFooter}>
        {faces.length > 0 ? <AvatarCluster faces={faces} /> : null}
        <Text style={styles.mutualInterested}>{interested} interested</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={toggleSaved}
          hitSlop={10}
          style={({ pressed }) => pressed && { opacity: 0.6 }}
        >
          <Ionicons
            name={saved ? 'star' : 'star-outline'}
            size={22}
            color={saved ? colors.accent : colors.muted}
          />
        </Pressable>
      </View>
    </View>
  );
}

// Overlapping row of attendee faces.
function AvatarCluster({ faces }: { faces: { name: string; avatarImage: string }[] }) {
  return (
    <View style={styles.cluster}>
      {faces.map((f, i) => (
        <View key={i} style={[styles.clusterChip, i > 0 && { marginLeft: -10 }]}>
          <Avatar name={f.name} image={f.avatarImage} size={26} />
        </View>
      ))}
    </View>
  );
}

// A trending event from the discover feed: cover poster, date, and how many
// people are interested — tap through to the event page.
function TrendingCard({ event }: { event: ExploreEvent }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.slug}`)}
      style={({ pressed }) => [styles.recentCard, pressed && { opacity: 0.85 }]}
    >
      <CoverGradient theme={event.coverTheme} image={event.coverImage} style={styles.recentCover} emojiOpacity={0.25}>
        <Text style={[styles.recentTitle, displayTitle]} numberOfLines={2}>
          {event.title}
        </Text>
      </CoverGradient>
      <View style={styles.trendingMeta}>
        <Text style={styles.trendingDate} numberOfLines={1}>
          {formatEventDate(event.date)}
        </Text>
        {event.interested > 0 ? (
          <Text style={styles.trendingInterested}>{event.interested} interested</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
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
    gap: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.section,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  wordmarkWrap: {
    position: 'relative',
  },
  wordmark: {
    ...display(38),
    color: colors.text,
    textAlign: 'center',
    textShadowColor: 'rgba(255,106,43,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  sectionGroup: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  kicker: {
    ...kicker(colors.accent),
    marginBottom: -spacing.xs,
  },
  sectionTitle: {
    ...display(30),
    color: colors.text,
  },
  welcomeBanner: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    // Orange accent stripe down the left edge.
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    ...shadow.card,
  },
  welcomeText: {
    ...display(22),
    color: colors.text,
  },
  horizontalScroll: {
    marginHorizontal: -spacing.md,
  },
  horizontalList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  mutualFeed: {
    gap: spacing.lg,
  },
  mutualEntry: {
    gap: spacing.sm,
  },
  mutualAttrib: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mutualAttribText: {
    ...uiText(15),
    color: colors.text,
    flex: 1,
  },
  mutualName: {
    ...uiText(15, '800'),
    color: colors.text,
  },
  mutualGoing: {
    ...uiText(15),
    color: colors.muted,
  },
  mutualCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadow.card,
  },
  mutualCover: {
    width: 108,
    alignSelf: 'stretch',
  },
  mutualBody: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  mutualTitle: {
    ...display(18),
    color: colors.text,
  },
  mutualDesc: {
    ...uiText(13),
    color: colors.muted,
    lineHeight: 18,
  },
  mutualFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  mutualInterested: {
    ...uiText(13, '700'),
    color: colors.muted,
  },
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clusterChip: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  seeMore: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginTop: spacing.xs,
  },
  seeMoreText: {
    ...uiText(14, '600'),
    color: colors.text,
  },
  recentCard: {
    width: 178,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadow.card,
  },
  recentCover: {
    height: 124,
    padding: spacing.sm,
    justifyContent: 'flex-end',
  },
  recentTitle: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 22,
    // Reserve exactly two lines and top-align, so every card's title starts on
    // the same horizontal line regardless of one- vs two-line length.
    height: 44,
    textAlignVertical: 'top',
    fontWeight: '800',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  trendingMeta: {
    padding: spacing.sm,
    paddingTop: 6,
    gap: 2,
  },
  trendingDate: {
    ...uiText(12, '700'),
    color: colors.muted,
  },
  trendingInterested: {
    ...uiText(12, '700'),
    color: colors.accent,
  },
});
