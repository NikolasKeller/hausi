import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { BlurView } from 'expo-blur';
import { colors, radius, shadow, spacing } from '../../lib/theme';
import { display, uiText } from '../../lib/fonts';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/ui';
import { EventCard } from '../../components/EventCard';
import { SettingsSheet } from '../../components/SettingsSheet';
import { withScreenBackground } from '../../components/ScreenBackground';

// No bloom here — the profile sits on the plain canvas.
export default withScreenBackground(ProfileScreen, { bloom: false });

function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  // Events with a bought ticket (any non-hosted event on "my events" — buying
  // marks them GOING server-side).
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
    // Best-effort — the profile renders fine without the ticket list.
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
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" variant="ghost" onPress={load} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const joinedYear = new Date(profile.joinedAt).getFullYear();
  const photo = mediaUrl(profile.avatarImage);

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          {photo ? (
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={styles.heroFallback}>
              <Avatar name={profile.name} image={null} size={160} />
            </View>
          )}
          {/* Top scrim keeps the buttons legible over a busy photo — only
              needed when there actually is one (it would read as a stray grey
              band on the plain fallback). */}
          {photo ? (
            <LinearGradient
              colors={['rgba(0,0,0,0.45)', 'transparent']}
              style={styles.topScrim}
              pointerEvents="none"
            />
          ) : null}
          {/* Photo fades into a soft dark scrim high up, so it ends well
              above the name — the ambient event photo keeps showing through
              rather than cutting to a flat block. */}
          <LinearGradient
            colors={['transparent', 'transparent', 'rgba(0,0,0,0.65)']}
            locations={[0, 0.4, 0.72]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={[styles.heroButtons, { top: insets.top + spacing.sm }]}>
            <Pressable onPress={shareProfile} style={({ pressed }) => [pressed && styles.pressed]}>
              <BlurView intensity={75} tint="light" style={styles.roundButton}>
                <View pointerEvents="none" style={styles.roundButtonFill} />
                <Ionicons name="share-outline" size={18} color={colors.onGlass} />
              </BlurView>
            </Pressable>
            <Pressable
              onPress={() => setSettingsOpen(true)}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <BlurView intensity={75} tint="light" style={styles.roundButton}>
                <View pointerEvents="none" style={styles.roundButtonFill} />
                <Ionicons name="settings-sharp" size={18} color={colors.onGlass} />
              </BlurView>
            </Pressable>
          </View>
        </View>

        {/* Name + stats sit over the ambient photo, below where the hero has
            already faded into the dark scrim. Pulled up a touch to stay close
            to the photo. */}
        <View style={styles.heroContent}>
          <Text style={styles.bigName} numberOfLines={2}>
            {profile.name}
          </Text>
          <BlurView intensity={75} tint="light" style={styles.joinedPill}>
            <View pointerEvents="none" style={styles.roundButtonFill} />
            <Ionicons name="sparkles" size={13} color={colors.onGlass} />
            <Text style={styles.joinedText}>joined {joinedYear}</Text>
          </BlurView>
        </View>

        {/* Events with a bought ticket — tapping "Buy ticket" on an event
            files it here (and on the calendar). */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My events</Text>
          {tickets.length === 0 ? (
            <Text style={styles.ticketsEmpty}>
              No tickets yet - grab one on an event page 🎟️
            </Text>
          ) : (
            <View style={styles.ticketList}>
              {tickets.map((ev) => (
                <EventCard key={ev.id} event={ev} />
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
    </View>
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
  errorText: {
    ...uiText(15),
    color: colors.danger,
    textAlign: 'center',
  },
  container: {
    paddingBottom: spacing.xxl,
  },
  pressed: {
    opacity: 0.7,
  },
  // Full-bleed photo hero; content sits at the bottom where the photo fades
  // into the page background.
  hero: {
    height: 360,
    width: '100%',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    // Nudge the photo down from the very top so it isn't glued to the edge.
    marginTop: spacing.xl,
  },
  // No user photo: let the ambient event backdrop keep showing through
  // instead of a flat block — just the avatar floats on it.
  heroFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    // Sit the avatar low in the hero, close to the name below it.
    paddingBottom: 16,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  heroButtons: {
    position: 'absolute',
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    zIndex: 2,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.glass,
  },
  heroContent: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    marginTop: -spacing.huge,
  },
  bigName: {
    ...display(44),
    color: colors.text,
    textAlign: 'center',
  },
  joinedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  joinedText: {
    ...uiText(13, '600'),
    color: colors.onGlass,
  },
  section: {
    marginTop: spacing.xl,
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    ...display(24),
    color: colors.text,
  },
  ticketsEmpty: {
    ...uiText(14),
    color: colors.muted,
  },
  ticketList: {
    gap: spacing.md,
  },
});
