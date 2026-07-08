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
import type { ExploreEvent, HomeFeed, PendingCohostInvite } from '../../shared/types';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { notify } from '../../lib/dialogs';
import { colors, radius, spacing, shadow } from '../../lib/theme';
import { titleFontStyle, display, uiText, kicker } from '../../lib/fonts';
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
  const [cohostInvites, setCohostInvites] = useState<PendingCohostInvite[]>([]);
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

  // Pending co-host invites addressed to me — surfaced at the top so I can
  // Accept/Decline without hunting for the event. Best-effort: a failure here
  // never blocks the main feed.
  const loadInvites = useCallback(async () => {
    try {
      const res = await api.myCohostInvites();
      setCohostInvites(res.invites);
    } catch {
      // Ignore — the feed is the priority.
    }
  }, []);

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
      loadInvites();
      return () => {
        active = false;
      };
    }, [fetchAll, loadInvites])
  );

  async function respondToInvite(invite: PendingCohostInvite, accept: boolean) {
    try {
      if (accept) {
        await api.acceptCohostInvite(invite.id);
        notify("You're a co-host! 🤝", `You can now help run ${invite.event.title}.`);
      } else {
        await api.declineCohostInvite(invite.id);
      }
    } catch (e) {
      notify('Something went wrong', e instanceof Error ? e.message : 'Try again');
      return;
    }
    setCohostInvites((list) => list.filter((i) => i.id !== invite.id));
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      setHome(await fetchAll());
      loadInvites();
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

        {cohostInvites.length > 0 ? (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionTitle}>Co-host invites</Text>
            <View style={styles.inviteFeed}>
              {cohostInvites.map((invite) => (
                <View key={invite.id} style={styles.inviteCard}>
                  <Pressable
                    onPress={() => router.push(`/event/${invite.event.slug}`)}
                    style={({ pressed }) => [styles.inviteHead, pressed && { opacity: 0.85 }]}
                  >
                    <CoverGradient
                      theme={invite.event.coverTheme}
                      image={invite.event.coverImage}
                      style={styles.inviteCover}
                      emojiOpacity={0.3}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.inviteEventTitle, titleFontStyle(invite.event.titleFont)]}
                        numberOfLines={2}
                      >
                        {invite.event.title}
                      </Text>
                      <Text style={styles.inviteBy} numberOfLines={1}>
                        {invite.invitedBy.name} invited you to co-host 🤝
                      </Text>
                    </View>
                  </Pressable>
                  <View style={styles.inviteActions}>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Accept"
                        variant="primary"
                        onPress={() => respondToInvite(invite, true)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Decline"
                        variant="ghost"
                        tone="paper"
                        onPress={() => respondToInvite(invite, false)}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
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
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionTitle}>{trending.title}</Text>
              <Pressable
                onPress={() => router.push('/explore')}
                style={({ pressed }) => [styles.viewAllPill, pressed && { opacity: 0.7 }]}
                hitSlop={6}
              >
                <Text style={styles.viewAllText}>View all</Text>
              </Pressable>
            </View>
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

// A trending event from the discover feed — the big discovery card: an
// attribution strip when a mutual is in, the cover poster, then title, date ·
// city, a description snippet and the interested count.
function TrendingCard({ event }: { event: ExploreEvent }) {
  const router = useRouter();
  const meta = [formatEventDate(event.date), event.city || event.location]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.slug}`)}
      style={({ pressed }) => [styles.trendingCard, pressed && { opacity: 0.9 }]}
    >
      {event.friendGoing ? (
        <View style={styles.trendingAttrib}>
          <Avatar name={event.friendGoing.name} image={event.friendGoing.avatarImage} size={20} />
          <Text style={styles.trendingAttribText} numberOfLines={1}>
            <Text style={styles.trendingAttribName}>{event.friendGoing.name}</Text> is interested
          </Text>
        </View>
      ) : null}
      <CoverGradient
        theme={event.coverTheme}
        image={event.coverImage}
        style={styles.trendingCover}
        emojiOpacity={0.3}
      />
      <View style={styles.trendingBody}>
        <Text style={styles.trendingTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.trendingDate} numberOfLines={1}>
          {meta}
        </Text>
        {event.description.trim() ? (
          <Text style={styles.trendingDesc} numberOfLines={2}>
            {event.description.trim()}
          </Text>
        ) : null}
        <View style={styles.trendingFooter}>
          <Ionicons name="star-outline" size={16} color={colors.muted} />
          <Text style={styles.trendingInterested}>{event.interested} Interested</Text>
        </View>
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
    ...display(24),
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
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...display(21),
    color: colors.text,
  },
  viewAllPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  viewAllText: {
    ...uiText(13, '600'),
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
  inviteFeed: {
    gap: spacing.md,
  },
  inviteCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  inviteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  inviteCover: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  inviteEventTitle: {
    ...display(20),
    color: colors.text,
  },
  inviteBy: {
    ...uiText(13, '600'),
    color: colors.muted,
    marginTop: 2,
  },
  inviteActions: {
    flexDirection: 'row',
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
  trendingCard: {
    width: 300,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadow.card,
  },
  trendingAttrib: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  trendingAttribText: {
    ...uiText(12),
    color: colors.muted,
    flex: 1,
  },
  trendingAttribName: {
    ...uiText(12, '700'),
    color: colors.text,
  },
  trendingCover: {
    height: 220,
  },
  trendingBody: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  trendingTitle: {
    ...display(19, { tracking: -0.01 }),
    color: colors.text,
  },
  trendingDate: {
    ...uiText(13, '700'),
    color: colors.muted,
  },
  trendingDesc: {
    ...uiText(13),
    color: colors.muted,
    lineHeight: 18,
  },
  trendingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.xs,
  },
  trendingInterested: {
    ...uiText(13, '700'),
    color: colors.muted,
  },
});
