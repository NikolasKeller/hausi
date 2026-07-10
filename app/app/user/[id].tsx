import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { FriendshipState, PublicProfile } from '../../shared/types';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { confirmDialog, notify } from '../../lib/dialogs';
import { colors, radius, spacing } from '../../lib/theme';
import { display, kicker, uiText } from '../../lib/fonts';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/ui';
import { ChromeText } from '../../components/ChromeText';
import { Glass } from '../../components/glass';
import { withScreenBackground } from '../../components/ScreenBackground';

export default withScreenBackground(UserProfileScreen, { bloom: false });

// The friend button's copy/icon per friendship state.
const FRIEND_ACTION: Record<
  FriendshipState,
  { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  none: { label: 'Add friend', icon: 'person-add-outline' },
  outgoing: { label: 'Requested', icon: 'time-outline' },
  incoming: { label: 'Accept request', icon: 'checkmark-circle-outline' },
  friends: { label: 'Friends', icon: 'checkmark-done-outline' },
};

function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: viewer } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.userProfile(id);
      setProfile(res.profile);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load profile');
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onFriendAction() {
    if (!profile || busy) return;
    setBusy(true);
    try {
      if (profile.friendState === 'none') {
        const res = await api.sendFriendRequest(profile.id);
        if (res.state === 'friends') notify('Friends! 🎉', `You and ${profile.name} are now friends.`);
      } else if (profile.friendState === 'incoming' && profile.requestId) {
        await api.acceptFriendRequest(profile.requestId);
        notify('Friends! 🎉', `You and ${profile.name} are now friends.`);
      } else if (profile.friendState === 'outgoing' && profile.requestId) {
        const ok = await confirmDialog(
          'Cancel request?',
          `Your friend request to ${profile.name} will be withdrawn.`,
          'Cancel request',
          'Keep it'
        );
        if (!ok) return;
        await api.cancelFriendRequest(profile.requestId);
      } else if (profile.friendState === 'friends') {
        const ok = await confirmDialog(
          `Unfriend ${profile.name}?`,
          'You can always send a new request later.',
          'Unfriend'
        );
        if (!ok) return;
        await api.unfriend(profile.id);
      }
      await load();
    } catch (e) {
      notify('Could not update', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>🫠</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Back" variant="ghost" tone="paper" onPress={() => router.back()} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const isSelf = viewer?.id === profile.id;
  const joinedYear = new Date(profile.joinedAt).getFullYear();
  const action = FRIEND_ACTION[profile.friendState];

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 64 }]}>
        <View style={styles.hero}>
          <Avatar name={profile.name} image={profile.avatarImage} size={120} />
          <ChromeText style={styles.bigName} numberOfLines={2}>
            {profile.name}
          </ChromeText>
          <View style={styles.pillRow}>
            {profile.city ? (
              <View style={styles.pill}>
                <Ionicons name="location-outline" size={13} color={colors.accent} />
                <Text style={styles.pillText}>{profile.city}</Text>
              </View>
            ) : null}
            <View style={styles.pill}>
              <Ionicons name="sparkles" size={13} color={colors.accent} />
              <Text style={styles.pillText}>joined {joinedYear}</Text>
            </View>
            <View style={styles.pill}>
              <Ionicons name="people-outline" size={13} color={colors.accent} />
              <Text style={styles.pillText}>
                {profile.friendsCount} {profile.friendsCount === 1 ? 'friend' : 'friends'}
              </Text>
            </View>
          </View>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          {profile.sharedEventTitle ? (
            <Text style={styles.metLine}>🪩 You partied together at “{profile.sharedEventTitle}”</Text>
          ) : null}
        </View>

        {!isSelf && !profile.isOrganization ? (
          <View style={styles.actionWrap}>
            <Pressable
              onPress={onFriendAction}
              disabled={busy}
              style={({ pressed }) => [
                styles.friendButton,
                profile.friendState === 'friends' || profile.friendState === 'outgoing'
                  ? styles.friendButtonQuiet
                  : styles.friendButtonPrimary,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                busy && { opacity: 0.6 },
              ]}
            >
              {busy ? (
                <ActivityIndicator
                  color={
                    profile.friendState === 'friends' || profile.friendState === 'outgoing'
                      ? colors.text
                      : colors.onInk
                  }
                />
              ) : (
                <>
                  <Ionicons
                    name={action.icon}
                    size={18}
                    color={
                      profile.friendState === 'friends' || profile.friendState === 'outgoing'
                        ? colors.text
                        : colors.onInk
                    }
                  />
                  <Text
                    style={[
                      styles.friendButtonText,
                      {
                        color:
                          profile.friendState === 'friends' || profile.friendState === 'outgoing'
                            ? colors.text
                            : colors.onInk,
                      },
                    ]}
                  >
                    {action.label}
                  </Text>
                </>
              )}
            </Pressable>
            {profile.friendState === 'incoming' ? (
              <Text style={styles.incomingHint}>{profile.name} sent you a friend request 💌</Text>
            ) : null}
          </View>
        ) : null}

        {profile.badges.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Party résumé</Text>
            <View style={styles.badgeRow}>
              {profile.badges.map((b) => (
                <Glass key={b.key} tint="dark" radius={radius.md} style={styles.badgeCard}>
                  <Text style={styles.badgeEmoji}>{b.emoji}</Text>
                  <Text style={styles.badgeValue}>{b.value}</Text>
                  <Text style={styles.badgeLabel}>{b.label}</Text>
                </Glass>
              ))}
            </View>
          </View>
        ) : null}

        {profile.mutualFriends.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionKicker}>friends in common</Text>
            <Text style={styles.sectionTitle}>
              {profile.mutualFriends.length} mutual{profile.mutualFriends.length === 1 ? '' : 's'}
            </Text>
            <View style={styles.mutualList}>
              {profile.mutualFriends.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => router.push(`/user/${m.id}`)}
                  style={({ pressed }) => [styles.mutualRow, pressed && { opacity: 0.7 }]}
                >
                  <Avatar name={m.name} image={m.avatarImage} size={40} />
                  <Text style={styles.mutualName} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={10}
        style={[styles.backFab, { top: insets.top + spacing.sm }]}
      >
        <Glass tint="dark" radius={999} style={styles.fabInner}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Glass>
      </Pressable>
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
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  errorEmoji: { fontSize: 48 },
  errorText: { color: colors.text, ...uiText(17, '500'), textAlign: 'center' },
  container: {
    paddingBottom: spacing.section,
  },
  backFab: {
    position: 'absolute',
    left: spacing.lg,
    zIndex: 20,
  },
  fabInner: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  bigName: {
    ...display(38),
    color: colors.text,
    textAlign: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pill: {
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
  pillText: {
    ...uiText(13, '600'),
    color: colors.text,
  },
  bio: {
    ...uiText(15, '400', { lineHeight: 1.45 }),
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  metLine: {
    ...uiText(13, '500'),
    color: colors.muted,
    textAlign: 'center',
  },
  actionWrap: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  friendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    alignSelf: 'stretch',
  },
  friendButtonPrimary: {
    backgroundColor: colors.ink,
  },
  friendButtonQuiet: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  friendButtonText: {
    ...uiText(16, '700'),
  },
  incomingHint: {
    ...uiText(13, '500'),
    color: colors.muted,
  },
  section: {
    marginTop: spacing.xl,
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  sectionKicker: {
    ...kicker(),
    color: colors.muted,
  },
  sectionTitle: {
    ...display(24),
    color: colors.text,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeCard: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minWidth: 104,
  },
  badgeEmoji: {
    fontSize: 22,
  },
  badgeValue: {
    ...display(22),
    color: colors.text,
  },
  badgeLabel: {
    ...uiText(12, '600'),
    color: colors.muted,
    textAlign: 'center',
  },
  mutualList: {
    gap: spacing.xs,
  },
  mutualRow: {
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
  mutualName: {
    flex: 1,
    ...uiText(15, '600'),
    color: colors.text,
  },
});
