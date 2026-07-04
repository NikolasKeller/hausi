import React, { useCallback, useEffect, useState } from 'react';
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
import { getRecentEvents, reconcileRecents, type RecentEvent } from '../../lib/recents';
import { EVENT_TEMPLATES, type EventTemplate } from '../../lib/eventTemplates';
import { colors, radius, spacing, shadow } from '../../lib/theme';
import { titleFontStyle, display, uiText, kicker } from '../../lib/fonts';
import { CoverGradient } from '../../components/CoverGradient';
import { Button } from '../../components/ui';
import { formatEventDate, formatEventTime } from '../../components/EventCard';
import { withScreenBackground } from '../../components/ScreenBackground';

const PROMOS: {
  emoji: string;
  title: string;
  subtitle: string;
  route: string;
}[] = [
  {
    emoji: '💌',
    title: 'Send a card',
    subtitle: "Make someone's day",
    route: '/send-card',
  },
];

export default withScreenBackground(HomeScreen);

function HomeScreen() {
  const router = useRouter();
  const { welcomeBack, dismissWelcome } = useAuth();
  const [home, setHome] = useState<HomeFeed | null>(null);
  const [recents, setRecents] = useState<RecentEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Greet a returning user once, on app open, then let it fade.
  const [welcome, setWelcome] = useState<string | null>(null);
  useEffect(() => {
    if (!welcomeBack) return;
    setWelcome(welcomeBack);
    dismissWelcome(); // consume so it won't reappear on tab switches
    const t = setTimeout(() => setWelcome(null), 5000);
    return () => clearTimeout(t);
  }, [welcomeBack, dismissWelcome]);

  const fetchAll = useCallback(async () => {
    const [homeRes, storedRecents, notifRes] = await Promise.all([
      api.home(),
      getRecentEvents(),
      api.notifications(),
    ]);
    // Recents are cached locally per device, so prune any whose event has since
    // been deleted server-side. Keep the cached list on a network hiccup.
    let recentList = storedRecents;
    if (storedRecents.length > 0) {
      try {
        const { slugs } = await api.existingEvents(storedRecents.map((r) => r.slug));
        recentList = await reconcileRecents(slugs);
      } catch {
        // Leave recents as-is rather than blanking the section.
      }
    }
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
      <View style={styles.wordmarkWrap}>
        <Text style={styles.wordmark}>Hausi</Text>
      </View>
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


  if (error && !home) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>🫠</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Try again" variant="ghost" tone="paper" onPress={onRefresh} loading={refreshing} />
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

        {welcome ? (
          <Pressable onPress={() => setWelcome(null)} style={styles.sectionGroup}>
            <View style={styles.welcomeBanner}>
              <Text style={styles.welcomeText}>Welcome back, {welcome}.</Text>
              <Text style={styles.welcomeSubtext}>Good to see you again.</Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.sectionGroup}>
          <Text style={styles.kicker}>Hot right now</Text>
          <Text style={styles.sectionTitle}>
            Trending in <Text style={styles.sectionTitleItalic}>{home.city}</Text>
          </Text>
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
            <Text style={styles.kicker}>Back to it</Text>
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
              style={({ pressed }) => [styles.promo, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.promoEmoji}>{promo.emoji}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.promoTitle}>{promo.title}</Text>
                <Text style={styles.promoSubtitle}>{promo.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        {home.palsGoing.length > 0 ? (
          <View style={styles.sectionGroup}>
            <Text style={styles.kicker}>Your crew</Text>
            <Text style={styles.sectionTitle}>
              Where your <Text style={styles.sectionTitleItalic}>pals</Text> are going
            </Text>
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
          <Text style={styles.kicker}>Need a plan?</Text>
          <Text style={styles.sectionTitle}>
            Party <Text style={styles.sectionTitleItalic}>starters</Text>
          </Text>
          <Text style={styles.sectionBlurb}>Tap an idea to spin up an event in seconds.</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            style={styles.horizontalScroll}
          >
            {EVENT_TEMPLATES.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </ScrollView>
        </View>

        <View style={[styles.sectionGroup, styles.ctaGroup]}>
          <Text style={styles.ctaKicker}>Your move</Text>
          <Text style={styles.ctaTitle}>
            Throw{'\n'}<Text style={styles.ctaTitleItalic}>something</Text>
          </Text>
          <Button
            title="Create an event"
            variant="primary"
            style={styles.ctaButton}
            onPress={() => router.push('/new-event')}
          />
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

function TemplateCard({ template }: { template: EventTemplate }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/new-event', params: { template: template.id } })}
      style={({ pressed }) => [styles.templateCard, pressed && { opacity: 0.85 }]}
    >
      <CoverGradient theme={template.coverTheme} style={styles.templateCover} emojiOpacity={0.22}>
        <Text style={styles.templateEmoji}>{template.emoji}</Text>
      </CoverGradient>
      <View style={styles.templateBody}>
        <Text style={styles.templateName} numberOfLines={1}>
          {template.name}
        </Text>
        <Text style={styles.templateVibe} numberOfLines={2}>
          {template.vibe}
        </Text>
        <Text style={styles.templateStart}>+ Start from this</Text>
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
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  wordmarkWrap: {
    position: 'relative',
  },
  wordmark: {
    ...display(38),
    color: colors.text,
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
  sectionTitleItalic: {
    fontStyle: 'italic',
  },
  emptyNote: {
    ...uiText(14),
    color: colors.muted,
  },
  sectionBlurb: {
    ...uiText(14),
    color: colors.muted,
    marginTop: -spacing.xs,
  },
  ctaGroup: {
    marginTop: spacing.lg,
    alignItems: 'flex-start',
  },
  ctaKicker: {
    ...kicker(colors.accent),
    marginBottom: spacing.xs,
  },
  ctaTitle: {
    ...display(52),
    color: colors.text,
    marginBottom: spacing.md,
  },
  ctaTitleItalic: {
    fontStyle: 'italic',
  },
  ctaButton: {
    alignSelf: 'stretch',
  },
  welcomeBanner: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    ...shadow.card,
  },
  welcomeText: {
    ...display(22),
    color: colors.text,
  },
  welcomeSubtext: {
    ...uiText(14),
    color: colors.muted,
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
    ...shadow.card,
  },
  trendingCover: {
    height: 220,
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
    ...uiText(13, '700'),
    color: colors.accent,
  },
  trendingInterested: {
    ...uiText(13, '700'),
    color: colors.accent,
  },
  trendingFriend: {
    ...uiText(13),
    color: colors.muted,
  },
  recentCard: {
    width: 150,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadow.card,
  },
  recentCover: {
    height: 96,
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
    ...uiText(12, '700'),
    color: colors.accent,
    padding: spacing.sm,
    paddingTop: 6,
  },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    ...shadow.card,
  },
  promoEmoji: {
    fontSize: 30,
  },
  promoTitle: {
    ...uiText(16, '700'),
    color: colors.text,
  },
  promoSubtitle: {
    ...uiText(13),
    color: colors.muted,
  },
  rowList: {
    gap: spacing.sm,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.sm,
    ...shadow.card,
  },
  compactCover: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
  },
  compactTitle: {
    ...uiText(15, '700'),
    color: colors.text,
  },
  compactDate: {
    ...uiText(12, '700'),
    color: colors.accent,
  },
  compactSubtitle: {
    ...uiText(12),
    color: colors.muted,
  },
  templateCard: {
    width: 172,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadow.card,
  },
  templateCover: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateEmoji: {
    fontSize: 46,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  templateBody: {
    padding: spacing.sm,
    gap: 2,
    minHeight: 96,
  },
  templateName: {
    ...uiText(15, '800'),
    color: colors.text,
  },
  templateVibe: {
    ...uiText(12),
    color: colors.muted,
    flex: 1,
  },
  templateStart: {
    ...uiText(12, '700'),
    color: colors.accent,
    marginTop: spacing.xs,
  },
});
