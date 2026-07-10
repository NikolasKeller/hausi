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
import type { DirectEventInvite, EventSummary, Mutual, MyProfile } from '../../shared/types';
import { api, mediaUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { confirmDialog, notify } from '../../lib/dialogs';
import { shareText } from '../../lib/share';
import { colors, radius, shadow, spacing } from '../../lib/theme';
import { display, uiText } from '../../lib/fonts';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/ui';
import { EventCard, formatEventDate } from '../../components/EventCard';
import { ChromeText } from '../../components/ChromeText';
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
  // Favorited events (heart toggle) — reuses the "interested"/MAYBE RSVP.
  const [favorites, setFavorites] = useState<EventSummary[]>([]);
  const [eventInvites, setEventInvites] = useState<DirectEventInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // User ids with an in-flight friend action, so a row can't double-fire.
  const [friendBusy, setFriendBusy] = useState<Set<string>>(new Set());
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
      setFavorites(res.events.filter((ev) => ev.myRsvp === 'MAYBE'));
    } catch {
      // keep whatever we had
    }
    try {
      setEventInvites((await api.myEventInvites()).invites);
    } catch {
      // best-effort
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
          if (active) setFavorites(res.events.filter((ev) => ev.myRsvp === 'MAYBE'));
        } catch {
          // best-effort
        }
        try {
          const res = await api.myEventInvites();
          if (active) setEventInvites(res.invites);
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

  // Run a friend-graph mutation for one person, then refetch the profile so
  // every section (requests, friends, mutuals) reflects the new state.
  async function friendAction(userId: string, run: () => Promise<unknown>) {
    if (friendBusy.has(userId)) return;
    setFriendBusy((prev) => new Set(prev).add(userId));
    try {
      await run();
      const res = await api.myProfile();
      setProfile(res.profile);
    } catch (e) {
      notify('Could not update', e instanceof Error ? e.message : 'Try again');
    } finally {
      setFriendBusy((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  }

  // The inline action on a mutuals row, driven by the friendship state.
  function mutualAction(m: Mutual) {
    switch (m.friendState) {
      case 'none':
        return {
          label: 'Add',
          icon: 'person-add-outline' as const,
          onPress: () => friendAction(m.user.id, () => api.sendFriendRequest(m.user.id)),
        };
      case 'outgoing':
        return { label: 'Sent', icon: 'time-outline' as const, onPress: null };
      case 'incoming': {
        const req = profile?.incomingRequests.find((r) => r.user.id === m.user.id);
        return {
          label: 'Accept',
          icon: 'checkmark-circle-outline' as const,
          onPress: req
            ? () => friendAction(m.user.id, () => api.acceptFriendRequest(req.id))
            : null,
        };
      }
      case 'friends':
        return { label: 'Friends', icon: 'checkmark-done-outline' as const, onPress: null };
    }
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
            <>
              <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              {/* Scrims only exist WITH a photo: a top darkener for the buttons
                  and a fade that melts the photo into the paper canvas. Without
                  a photo neither renders, so the hero is just the avatar on
                  paper — no stray grey band. */}
              <LinearGradient
                colors={['rgba(0,0,0,0.45)', 'transparent']}
                style={styles.topScrim}
                pointerEvents="none"
              />
              <LinearGradient
                colors={['transparent', 'transparent', colors.bg]}
                locations={[0, 0.4, 0.72]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            </>
          ) : (
            <View style={styles.heroFallback}>
              <Avatar name={profile.name} image={null} size={140} />
            </View>
          )}

          <View style={[styles.heroButtons, { top: insets.top + spacing.sm }]}>
            <Pressable
              onPress={() => router.push('/people')}
              style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
            >
              <Ionicons name="person-add-outline" size={18} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={shareProfile}
              style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
            >
              <Ionicons name="share-outline" size={18} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => setSettingsOpen(true)}
              style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
            >
              <Ionicons name="settings-sharp" size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Name + stats sit on the solid dark canvas, below where the photo has
            already faded out. Pulled up a touch to stay close to the photo. */}
        <View style={styles.heroContent}>
          <ChromeText style={styles.bigName} numberOfLines={2}>
            {profile.name}
          </ChromeText>
          <Text style={styles.username}>@{profile.username}</Text>
          <View style={styles.pillRow}>
            <View style={styles.joinedPill}>
              <Ionicons name="sparkles" size={13} color={colors.accent} />
              <Text style={styles.joinedText}>joined {joinedYear}</Text>
            </View>
            <View style={styles.joinedPill}>
              <Ionicons name="people-outline" size={13} color={colors.accent} />
              <Text style={styles.joinedText}>
                {profile.friends.length} {profile.friends.length === 1 ? 'friend' : 'friends'}
              </Text>
            </View>
          </View>
          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : (
            <Pressable onPress={() => router.push('/edit-profile')} hitSlop={6}>
              <Text style={styles.bioEmpty}>+ add a bio</Text>
            </Pressable>
          )}
          {profile.badges.length ? (
            <View style={styles.badgeRow}>
              {profile.badges.map((b) => (
                <View key={b.key} style={styles.badgePill}>
                  <Text style={styles.badgeText}>
                    {b.emoji} {b.value} {b.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Incoming friend requests — the most actionable social item, so it
            sits right under the hero. */}
        {eventInvites.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invites for you ✨</Text>
            <View style={styles.personList}>
              {eventInvites.map((invite) => (
                <View key={invite.id} style={styles.personRow}>
                  <Pressable
                    onPress={() => router.push(`/event/${invite.event.slug}`)}
                    style={({ pressed }) => [styles.personMain, pressed && styles.pressed]}
                  >
                    <Avatar
                      name={invite.invitedBy.name}
                      image={invite.invitedBy.avatarImage}
                      size={40}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {invite.event.title}
                      </Text>
                      <Text style={styles.personMeta} numberOfLines={1}>
                        {invite.invitedBy.name} invited you · {formatEventDate(invite.event.date)}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      await api.dismissEventInvite(invite.id).catch(() => {});
                      setEventInvites((current) => current.filter((item) => item.id !== invite.id));
                    }}
                    style={styles.declineButton}
                  >
                    <Ionicons name="close" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {profile.incomingRequests.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Friend requests 💌</Text>
            <View style={styles.personList}>
              {profile.incomingRequests.map((req) => (
                <View key={req.id} style={styles.personRow}>
                  <Pressable
                    onPress={() => router.push(`/user/${req.user.id}`)}
                    style={({ pressed }) => [styles.personMain, pressed && styles.pressed]}
                  >
                    <Avatar name={req.user.name} image={req.user.avatarImage} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {req.user.name}
                      </Text>
                      <Text style={styles.personMeta}>wants to be friends</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    disabled={friendBusy.has(req.user.id)}
                    onPress={() => friendAction(req.user.id, () => api.acceptFriendRequest(req.id))}
                    style={({ pressed }) => [styles.acceptButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.acceptText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    disabled={friendBusy.has(req.user.id)}
                    onPress={() =>
                      friendAction(req.user.id, () => api.declineFriendRequest(req.id))
                    }
                    hitSlop={6}
                    style={({ pressed }) => [styles.declineButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="close" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Accepted friends. */}
        {profile.friends.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Friends</Text>
            <View style={styles.personList}>
              {profile.friends.map((f) => (
                <Pressable
                  key={f.user.id}
                  onPress={() => router.push(`/user/${f.user.id}`)}
                  style={({ pressed }) => [styles.personRow, pressed && styles.pressed]}
                >
                  <View style={styles.personMain}>
                    <Avatar name={f.user.name} image={f.user.avatarImage} size={40} />
                    <Text style={[styles.personName, { flex: 1 }]} numberOfLines={1}>
                      {f.user.name}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* People you've partied with (computed mutuals) — the pool to make
            friends from. Rows already covered by a friendship still show their
            state so the list reads consistently. */}
        {profile.mutuals.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Partied with</Text>
            <View style={styles.personList}>
              {profile.mutuals.map((m) => {
                const action = mutualAction(m);
                return (
                  <View key={m.user.id} style={styles.personRow}>
                    <Pressable
                      onPress={() => router.push(`/user/${m.user.id}`)}
                      style={({ pressed }) => [styles.personMain, pressed && styles.pressed]}
                    >
                      <Avatar name={m.user.name} image={m.user.avatarImage} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.personName} numberOfLines={1}>
                          {m.user.name}
                        </Text>
                        {m.sharedEventTitle ? (
                          <Text style={styles.personMeta} numberOfLines={1}>
                            🪩 {m.sharedEventTitle}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                    {action.onPress ? (
                      <Pressable
                        disabled={friendBusy.has(m.user.id)}
                        onPress={action.onPress}
                        style={({ pressed }) => [styles.acceptButton, pressed && styles.pressed]}
                      >
                        {friendBusy.has(m.user.id) ? (
                          <ActivityIndicator size="small" color={colors.onInk} />
                        ) : (
                          <Text style={styles.acceptText}>{action.label}</Text>
                        )}
                      </Pressable>
                    ) : (
                      <View style={styles.stateTag}>
                        <Ionicons name={action.icon} size={13} color={colors.muted} />
                        <Text style={styles.stateTagText}>{action.label}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* The Wallet — entry passes (with QR) for hosted/going events, plus
            agent-purchased ticket PDFs. Lives on its own screen. */}
        <View style={styles.section}>
          <Pressable
            onPress={() => router.push('/wallet')}
            style={({ pressed }) => [styles.walletRow, pressed && styles.pressed]}
          >
            <View style={styles.walletIcon}>
              <Ionicons name="wallet-outline" size={22} color={colors.onInk} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.walletTitle}>Wallet</Text>
              <Text style={styles.walletMeta}>Your entry passes & tickets</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
          {profile.isAdmin ? (
            <Pressable
              onPress={() => router.push('/admin/events')}
              style={({ pressed }) => [styles.walletRow, pressed && styles.pressed]}
            >
              <View style={styles.walletIcon}>
                <Ionicons name="shield-checkmark-outline" size={22} color={colors.onInk} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletTitle}>Public event review</Text>
                <Text style={styles.walletMeta}>Approve submissions for Explore</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {/* Favorited events — tap the heart on an event to save it here. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Favorites</Text>
          {favorites.length === 0 ? (
            <Text style={styles.ticketsEmpty}>
              No favorites yet - tap the heart on an event 🤍
            </Text>
          ) : (
            <View style={styles.ticketList}>
              {favorites.map((ev) => (
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
    // Transparent so the paper texture shows through — no flat block/bar.
    backgroundColor: 'transparent',
    overflow: 'hidden',
    // Nudge the photo down from the very top so it isn't glued to the edge
    // (raised twice per user feedback: xl+12 → xl+24).
    marginTop: spacing.xl + 24,
  },
  heroFallback: {
    ...StyleSheet.absoluteFillObject,
    // No fill — just the avatar centered on the paper canvas.
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
    // Dark glass so it reads on both the night canvas and over a photo.
    backgroundColor: 'rgba(10,13,24,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
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
  username: {
    ...uiText(14, '600'),
    color: colors.muted,
    marginTop: -spacing.sm,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  joinedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  joinedText: {
    ...uiText(13, '600'),
    color: colors.text,
  },
  bio: {
    ...uiText(15, '400', { lineHeight: 1.45 }),
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  bioEmpty: {
    ...uiText(14, '600'),
    color: colors.muted,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  badgePill: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  badgeText: {
    ...uiText(13, '600'),
    color: colors.text,
  },
  personList: {
    gap: spacing.sm,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  personMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  personName: {
    ...uiText(15, '600'),
    color: colors.text,
  },
  personMeta: {
    ...uiText(12, '500'),
    color: colors.muted,
    marginTop: 1,
  },
  acceptButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  acceptText: {
    ...uiText(13, '700'),
    color: colors.onInk,
  },
  declineButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  stateTagText: {
    ...uiText(12, '600'),
    color: colors.muted,
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
  // The Wallet entry row — a bright card so the ticket feature reads as the
  // section's primary action.
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.card,
  },
  walletIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletTitle: {
    ...uiText(15, '700'),
    color: colors.text,
  },
  walletMeta: {
    ...uiText(13, '500'),
    color: colors.muted,
    marginTop: 2,
  },
});
