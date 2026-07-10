import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { EventSummary, MyProfile } from '../../shared/types';
import { api, mediaUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { confirmDialog } from '../../lib/dialogs';
import { shareText } from '../../lib/share';
import { radius, spacing } from '../../lib/theme';
import { thinDisplay, XLIGHT_ITALIC, kicker, uiText } from '../../lib/fonts';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/ui';
import { CoverGradient } from '../../components/CoverGradient';
import { GlassSurface } from '../../components/GlassSurface';
import { formatEventDate } from '../../components/EventCard';
import { SettingsSheet } from '../../components/SettingsSheet';

const PROFILE_BG = require('../../assets/brand/designshot-bg.png');

// Foggy atmospheric canvas — same designshot backdrop as Explore / event screens.
function ProfileAtmosphere({ children }: { children?: React.ReactNode }) {
  const webBlur =
    Platform.OS === 'web'
      ? ({
          filter: 'blur(42px) saturate(130%)',
          transform: [{ scale: 1.12 }],
        } as object)
      : null;
  return (
    <View style={styles.atmoFill}>
      <Image
        source={PROFILE_BG}
        blurRadius={Platform.OS === 'ios' ? 42 : 0}
        style={[StyleSheet.absoluteFill, webBlur]}
        resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFill, styles.atmoVeil]} pointerEvents="none" />
      <LinearGradient
        colors={['rgba(30,45,60,0.30)', 'rgba(11,12,16,0.15)', 'rgba(11,12,16,0.72)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

function DottedArc({ count = 14 }: { count?: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              opacity: 0.85 - i * 0.04,
              transform: [{ translateY: Math.pow(i - 3, 2) * 0.04 }],
            },
          ]}
        />
      ))}
    </View>
  );
}

function GlassFab({
  icon,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      <GlassSurface
        radius={999}
        blur={18}
        fill="rgba(255,255,255,0.10)"
        borderColor="rgba(255,255,255,0.30)"
        shadow={false}
        style={styles.fab}
      >
        <Ionicons name={icon} size={18} color="#FFFFFF" />
      </GlassSurface>
    </Pressable>
  );
}

const STATUS_LABEL: Record<string, string> = {
  GOING: 'Going',
  MAYBE: 'Maybe',
  CANT: "Can't go",
  WAITLIST: 'Waitlist',
};

function TicketCard({ event }: { event: EventSummary }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.slug}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <GlassSurface radius={30} blur={26} style={styles.eventCard}>
        <CoverGradient
          theme={event.coverTheme}
          image={event.coverImage}
          style={styles.poster}
          emojiOpacity={0.25}
          dim={false}
        />
        <View style={styles.cardBody}>
          <View style={styles.cardIconCircle}>
            <Ionicons name="ticket-outline" size={16} color="#0B0C10" />
          </View>
          <Text style={[styles.cardTitle, thinDisplay(20)]} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {formatEventDate(event.date)}
          </Text>
          {event.myRsvp ? (
            <Text style={styles.rsvpBadge}>{STATUS_LABEL[event.myRsvp] ?? event.myRsvp}</Text>
          ) : null}
        </View>
      </GlassSurface>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [tickets, setTickets] = useState<EventSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.myProfile();
      setProfile(res.profile);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load profile');
    }
    try {
      const res = await api.myEvents();
      setTickets(res.events.filter((ev) => !ev.isHost));
    } catch {
      // keep whatever we had
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const res = await api.myProfile();
          if (!active) return;
          setProfile(res.profile);
          setError(null);
        } catch (e) {
          if (!active) return;
          setError(e instanceof Error ? e.message : 'Could not load profile');
        }
        try {
          const res = await api.myEvents();
          if (active) setTickets(res.events.filter((ev) => !ev.isHost));
        } catch {
          // best-effort
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  async function confirmLogout() {
    const ok = await confirmDialog('Log out?', 'You can log back in with your phone number.', 'Log out');
    if (ok) logout().catch(() => {});
  }

  async function shareProfile() {
    if (!profile) return;
    await shareText(`Add me on iykyk 🎉 - ${profile.name}`);
  }

  if (error && !profile) {
    return (
      <ProfileAtmosphere>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.center}>
            <Text style={styles.errorEmoji}>🫠</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Button title="Retry" variant="ghost" tone="paper" onPress={load} />
          </View>
        </SafeAreaView>
      </ProfileAtmosphere>
    );
  }

  if (!profile) {
    return (
      <ProfileAtmosphere>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.center}>
            <ActivityIndicator color="#FFFFFF" size="large" />
          </View>
        </SafeAreaView>
      </ProfileAtmosphere>
    );
  }

  const joinedYear = new Date(profile.joinedAt).getFullYear();
  const photo = mediaUrl(profile.avatarImage);
  const kickerLine = profile.city?.trim()
    ? `Based in ${profile.city.trim()}`
    : 'Your profile';

  return (
    <ProfileAtmosphere>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl * 2 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.heroKicker}>{kickerLine}</Text>
              <Text style={[styles.heroName, thinDisplay(44)]} numberOfLines={2}>
                {profile.name}
              </Text>
              <DottedArc />
            </View>
            <View style={styles.headerActions}>
              <GlassFab icon="share-outline" onPress={shareProfile} />
              <GlassFab icon="settings-sharp" onPress={() => setSettingsOpen(true)} />
            </View>
          </View>

          <View style={styles.profileCardWrap}>
            <GlassSurface radius={30} blur={26} style={styles.profileCard}>
              <View style={styles.avatarRing}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.avatarPhoto} resizeMode="cover" />
                ) : (
                  <Avatar name={profile.name} image={null} size={88} />
                )}
              </View>
              <GlassSurface
                radius={999}
                blur={18}
                fill="rgba(255,255,255,0.10)"
                borderColor="rgba(255,255,255,0.30)"
                shadow={false}
                style={styles.joinedPill}
              >
                <Ionicons name="sparkles" size={13} color="#FFFFFF" />
                <Text style={styles.joinedText}>joined {joinedYear}</Text>
              </GlassSurface>
            </GlassSurface>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionKicker}>My events</Text>
            <Text style={[styles.sectionTitle, thinDisplay(28)]}>Tickets</Text>
            {tickets.length === 0 ? (
              <GlassSurface radius={30} blur={26} style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>🎟️</Text>
                <Text style={styles.emptyText}>
                  No tickets yet — grab one on an event page
                </Text>
              </GlassSurface>
            ) : (
              <View style={styles.grid}>
                {tickets.map((ev) => (
                  <TicketCard key={ev.id} event={ev} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {settingsOpen ? (
          <SettingsSheet
            onClose={() => setSettingsOpen(false)}
            onEditProfile={() => router.push('/edit-profile')}
            onShareProfile={shareProfile}
            onLogout={confirmLogout}
          />
        ) : null}
      </SafeAreaView>
    </ProfileAtmosphere>
  );
}

const styles = StyleSheet.create({
  atmoFill: {
    flex: 1,
    backgroundColor: '#0B0C10',
    overflow: 'hidden',
  },
  atmoVeil: {
    backgroundColor: 'rgba(11,12,16,0.50)',
  },
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
    color: '#FFFFFF',
    textAlign: 'center',
  },
  content: {
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  headerTitleWrap: {
    flex: 1,
    gap: 4,
  },
  headerActions: {
    gap: spacing.sm,
    marginTop: 4,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.95)',
    fontFamily: XLIGHT_ITALIC,
    fontSize: 14,
    letterSpacing: 0.3,
    marginLeft: 6,
    textShadowColor: 'rgba(30,45,60,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  heroName: {
    color: '#FFFFFF',
    marginLeft: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 6,
    marginLeft: 6,
  },
  dot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  fab: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCardWrap: {
    paddingHorizontal: spacing.md,
  },
  profileCard: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  avatarPhoto: {
    width: '100%',
    height: '100%',
  },
  joinedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  joinedText: {
    ...uiText(13, '600'),
    color: '#FFFFFF',
  },
  section: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sectionKicker: {
    ...kicker('rgba(255,255,255,0.45)'),
    marginLeft: 4,
  },
  sectionTitle: {
    color: '#FFFFFF',
    marginLeft: 4,
    marginBottom: spacing.xs,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyText: {
    ...uiText(15),
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  card: {
    width: '48%',
  },
  eventCard: {
    overflow: 'hidden',
  },
  poster: {
    height: 180,
    borderTopLeftRadius: 29,
    borderTopRightRadius: 29,
    overflow: 'hidden',
  },
  cardBody: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  cardTitle: {
    color: '#FFFFFF',
  },
  cardMeta: {
    ...uiText(12, '500'),
    color: 'rgba(255,255,255,0.65)',
  },
  rsvpBadge: {
    ...uiText(11, '700'),
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
});
