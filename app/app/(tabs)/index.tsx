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
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/ui';
import { formatEventDate } from '../../components/EventCard';
import { withScreenBackground } from '../../components/ScreenBackground';

export default withScreenBackground(HomeScreen);

// Never a plain "welcome back" — always something cheerful and party-flavored.
const GREETINGS: Array<(name: string) => { text: string; subtext: string }> = [
  (n) => ({ text: `Look who's back — ${n}! 🎉`, subtext: "Let's find your next party." }),
  (n) => ({ text: `${n} has entered the chat 🎊`, subtext: 'Good vibes incoming.' }),
  (n) => ({ text: `Ayy, ${n}! 🥳`, subtext: 'Who are we celebrating today?' }),
  (n) => ({ text: `The party missed you, ${n} 💃`, subtext: "Let's get something on the calendar." }),
  (n) => ({ text: `There they are — ${n} 🕺`, subtext: 'Ready to make plans?' }),
  (n) => ({ text: `${n} in the building ✨`, subtext: 'Time to stir something up.' }),
  (n) => ({ text: `Confetti's out for ${n} 🎈`, subtext: "What's the move tonight?" }),
];

function pickGreeting(name: string) {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)](name);
}

function HomeScreen() {
  const router = useRouter();
  const { welcomeBack, dismissWelcome } = useAuth();
  const [home, setHome] = useState<HomeFeed | null>(null);
  const [recents, setRecents] = useState<RecentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllMutuals, setShowAllMutuals] = useState(false);
  // Greet a returning user once, on app open, then let it fade.
  const [welcome, setWelcome] = useState<{ text: string; subtext: string } | null>(null);
  useEffect(() => {
    if (!welcomeBack) return;
    setWelcome(pickGreeting(welcomeBack));
    dismissWelcome(); // consume so it won't reappear on tab switches
    const t = setTimeout(() => setWelcome(null), 5000);
    return () => clearTimeout(t);
  }, [welcomeBack, dismissWelcome]);

  const fetchAll = useCallback(async () => {
    const [homeRes, storedRecents] = await Promise.all([
      api.home(),
      getRecentEvents(),
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
    return { homeRes, recentList };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchAll()
        .then((res) => {
          if (!active) return;
          setHome(res.homeRes);
          setRecents(res.recentList);
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
              <Text style={styles.welcomeSubtext}>{welcome.subtext}</Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.sectionGroup}>
          <Text style={styles.kicker}>Your crew</Text>
          <Text style={styles.sectionTitle}>Find your mutuals</Text>
          <Text style={styles.sectionBlurb}>See which parties your people are hitting.</Text>
          {home.palsGoing.length === 0 ? (
            <Text style={styles.emptyNote}>
              No mutual plans yet — RSVP to a few parties and your crew will pop up here.
            </Text>
          ) : (
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

        <View style={styles.sectionGroup}>
          <Text style={styles.kicker}>Need a plan?</Text>
          <Text style={styles.sectionTitle}>
            Party starters
          </Text>
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
          <Text style={styles.ctaTitle}>
            Throw{'\n'}something
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
          <Avatar emoji={event.friendGoing.avatarEmoji} size={28} />
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
        {faces.length > 0 ? <AvatarCluster emojis={faces} /> : null}
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

// Overlapping row of attendee avatar emoji.
function AvatarCluster({ emojis }: { emojis: string[] }) {
  return (
    <View style={styles.cluster}>
      {emojis.map((emoji, i) => (
        <View key={i} style={[styles.clusterChip, i > 0 && { marginLeft: -10 }]}>
          <Text style={styles.clusterEmoji}>{emoji}</Text>
        </View>
      ))}
    </View>
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
  emptyNote: {
    ...uiText(14),
    color: colors.muted,
  },
  ctaGroup: {
    marginTop: spacing.lg,
    alignItems: 'flex-start',
  },
  ctaTitle: {
    ...display(52),
    color: colors.text,
    marginBottom: spacing.md,
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
    borderRadius: radius.lg,
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
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterEmoji: {
    fontSize: 14,
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
    ...uiText(14, '700'),
    color: colors.text,
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
    ...display(16),
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
