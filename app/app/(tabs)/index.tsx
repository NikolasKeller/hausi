import React, { useCallback, useState } from 'react';
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
import { Redirect, useFocusEffect, useRouter } from 'expo-router';

// Screenshot-tour helper: set to a tab path to hop there, null for normal.
const DEV_TOUR_REDIRECT: string | null = null;
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ExploreEvent, HomeFeed } from '../../shared/types';
import { api } from '../../lib/api';
import { getRecentEvents, type RecentEvent } from '../../lib/recents';
import { colors, radius, spacing } from '../../lib/theme';
import { titleFontStyle } from '../../lib/fonts';
import { CoverGradient } from '../../components/CoverGradient';
import { Button } from '../../components/ui';
import { formatEventDate, formatEventTime } from '../../components/EventCard';
import { withScreenBackground } from '../../components/ScreenBackground';

const PROMOS: {
  emoji: string;
  title: string;
  subtitle: string;
  route: string;
  gradient: [string, string];
}[] = [
  {
    emoji: '📅',
    title: 'Introducing Calendars',
    subtitle: 'All your parties, one grid',
    route: '/calendar',
    gradient: ['#4A3580', '#241B3A'],
  },
  {
    emoji: '💘',
    title: 'Have a crush?',
    subtitle: 'Tell them. Anonymously-ish.',
    route: '/profile',
    gradient: ['#7A2E63', '#241B3A'],
  },
  {
    emoji: '💌',
    title: 'Send a card',
    subtitle: "Make someone's day",
    route: '/send-card',
    gradient: ['#8A5A3A', '#241B3A'],
  },
];

export default withScreenBackground(HomeScreen);

function HomeScreen() {
  const router = useRouter();
  const [home, setHome] = useState<HomeFeed | null>(null);
  const [recents, setRecents] = useState<RecentEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    const [homeRes, recentList, notifRes] = await Promise.all([
      api.home(),
      getRecentEvents(),
      api.notifications(),
    ]);
    return { homeRes, recentList, unread: notifRes.unread };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchAll()
        .then((res) => {
          if (!active) return;
          setHome(res.homeRes);
          setRecents(res.recentList);
          setUnread(res.unread);
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
      const res = await fetchAll();
      setHome(res.homeRes);
      setRecents(res.recentList);
      setUnread(res.unread);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not refresh');
    } finally {
      setRefreshing(false);
    }
  }

  const header = (
    <View style={styles.headerRow}>
      <Text style={styles.wordmark}>Hausi</Text>
      <Pressable
        onPress={() => router.push('/notifications')}
        hitSlop={8}
        style={({ pressed }) => [styles.bellButton, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="notifications-outline" size={24} color={colors.text} />
        {unread > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );

  if (DEV_TOUR_REDIRECT) {
    return <Redirect href={DEV_TOUR_REDIRECT as never} />;
  }

  if (error && !home) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>🫠</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Try again" variant="ghost" onPress={onRefresh} loading={refreshing} />
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

        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Trending in {home.city} 🔥</Text>
          {home.trendingNearby.length === 0 ? (
            <Text style={styles.emptyNote}>Nothing trending nearby yet — start something.</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              style={styles.horizontalScroll}
            >
              {home.trendingNearby.map((event) => (
                <TrendingCard key={event.id} event={event} />
              ))}
            </ScrollView>
          )}
        </View>

        {recents.length > 0 ? (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionTitle}>Recently viewed</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              style={styles.horizontalScroll}
            >
              {recents.map((recent) => (
                <RecentCard key={recent.slug} recent={recent} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={[styles.sectionGroup, { gap: spacing.sm }]}>
          {PROMOS.map((promo) => (
            <Pressable
              key={promo.route}
              onPress={() => router.push(promo.route)}
              style={({ pressed }) => [pressed && { opacity: 0.8 }]}
            >
              <LinearGradient
                colors={promo.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.promo}
              >
                <Text style={styles.promoEmoji}>{promo.emoji}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.promoTitle}>{promo.title}</Text>
                  <Text style={styles.promoSubtitle}>{promo.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </LinearGradient>
            </Pressable>
          ))}
        </View>

        {home.palsGoing.length > 0 ? (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionTitle}>Where your pals are going 🕺</Text>
            <View style={styles.rowList}>
              {home.palsGoing.map((event) => (
                <CompactRow
                  key={event.id}
                  event={event}
                  subtitle={event.friendGoing ? `${event.friendGoing.name} is going` : event.city}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Trending now 🌍</Text>
          {home.trendingNow.length === 0 ? (
            <Text style={styles.emptyNote}>The world is quiet right now.</Text>
          ) : (
            <View style={styles.rowList}>
              {home.trendingNow.map((event) => (
                <CompactRow
                  key={event.id}
                  event={event}
                  subtitle={`${event.city} · ⭐ ${event.interested} interested`}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.sectionGroup}>
          <Button title="Create an event 🎉" onPress={() => router.push('/new-event')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TrendingCard({ event }: { event: ExploreEvent }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.slug}`)}
      style={({ pressed }) => [styles.trendingCard, pressed && { opacity: 0.85 }]}
    >
      <CoverGradient theme={event.coverTheme} image={event.coverImage} style={styles.trendingCover} emojiOpacity={0.3}>
        <Text
          style={[styles.trendingTitle, titleFontStyle(event.titleFont)]}
          numberOfLines={2}
        >
          {event.title}
        </Text>
      </CoverGradient>
      <View style={styles.trendingBody}>
        <Text style={styles.trendingMeta} numberOfLines={1}>
          {formatEventDate(event.date)} · {formatEventTime(event.date)}
          {event.location ? ` · ${event.location}` : ''}
        </Text>
        <Text style={styles.trendingInterested}>⭐ {event.interested} interested</Text>
        {event.friendGoing ? (
          <Text style={styles.trendingFriend} numberOfLines={1}>
            {event.friendGoing.avatarEmoji} {event.friendGoing.name} is going
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function RecentCard({ recent }: { recent: RecentEvent }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/event/${recent.slug}`)}
      style={({ pressed }) => [styles.recentCard, pressed && { opacity: 0.85 }]}
    >
      <CoverGradient theme={recent.coverTheme} image={recent.coverImage} style={styles.recentCover} emojiOpacity={0.25}>
        <Text style={[styles.recentTitle, titleFontStyle(recent.titleFont)]} numberOfLines={2}>
          {recent.title}
        </Text>
      </CoverGradient>
      <Text style={styles.recentDate}>{formatEventDate(recent.date)}</Text>
    </Pressable>
  );
}

function CompactRow({ event, subtitle }: { event: ExploreEvent; subtitle: string }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.slug}`)}
      style={({ pressed }) => [styles.compactRow, pressed && { opacity: 0.85 }]}
    >
      <CoverGradient theme={event.coverTheme} image={event.coverImage} style={styles.compactCover} emojiOpacity={0.35} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.compactTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.compactDate}>{formatEventDate(event.date)}</Text>
        <Text style={styles.compactSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
    color: colors.text,
    fontSize: 17,
    textAlign: 'center',
  },
  content: {
    gap: spacing.lg,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  wordmark: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  bellButton: {
    padding: spacing.xs,
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  sectionGroup: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  emptyNote: {
    color: colors.muted,
    fontSize: 14,
  },
  horizontalScroll: {
    marginHorizontal: -spacing.md,
  },
  horizontalList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  trendingCard: {
    width: 300,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  trendingCover: {
    height: 140,
    padding: spacing.md,
    justifyContent: 'flex-end',
  },
  trendingTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  trendingBody: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  trendingMeta: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  trendingInterested: {
    color: colors.warning,
    fontWeight: '700',
    fontSize: 13,
  },
  trendingFriend: {
    color: colors.muted,
    fontSize: 13,
  },
  recentCard: {
    width: 150,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  recentCover: {
    height: 84,
    padding: spacing.sm,
    justifyContent: 'flex-end',
  },
  recentTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  recentDate: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    padding: spacing.sm,
    paddingTop: 6,
  },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  promoEmoji: {
    fontSize: 28,
  },
  promoTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  promoSubtitle: {
    color: colors.muted,
    fontSize: 13,
  },
  rowList: {
    gap: spacing.sm,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  compactCover: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
  },
  compactTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  compactDate: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  compactSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
});
