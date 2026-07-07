import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { MyProfile } from '../../shared/types';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { confirmDialog, notify } from '../../lib/dialogs';
import { shareText } from '../../lib/share';
import { colors, radius, shadow, spacing } from '../../lib/theme';
import { display, uiText } from '../../lib/fonts';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/ui';
import { SettingsSheet } from '../../components/SettingsSheet';
import { withScreenBackground } from '../../components/ScreenBackground';

function joinedLabel(iso: string): string {
  const date = new Date(iso);
  const month = date.toLocaleDateString(undefined, { month: 'short' });
  return `${month} '${String(date.getFullYear()).slice(-2)}`;
}

export default withScreenBackground(ProfileScreen);

function ProfileScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crushBusy, setCrushBusy] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.myProfile();
      setProfile(res.profile);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load profile');
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
    await shareText(`Add me on Now 🎉 - ${profile.name}`);
  }

  async function toggleCrush(userId: string) {
    if (crushBusy) return;
    setCrushBusy(userId);
    try {
      const res = await api.toggleCrush(userId);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              mutuals: prev.mutuals.map((m) =>
                m.user.id === userId ? { ...m, crushed: res.crushed } : m
              ),
            }
          : prev
      );
      if (res.matched) {
        notify("It's a match 💘", 'They crushed on you too. Go say hi!');
      }
    } catch (e) {
      notify('Crush failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setCrushBusy(null);
    }
  }

  if (error && !profile) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" variant="ghost" tone="ink" onPress={load} />
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

  const metaLine = [
    profile.city ? `📍 ${profile.city}` : null,
    `💥 Joined ${joinedLabel(profile.joinedAt)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => setSettingsOpen(true)}
            style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
          >
            <Ionicons name="settings-sharp" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.avatarStack}>
            <Avatar name={profile.name} image={profile.avatarImage} size={120} />
          </View>
          <Text style={styles.bigName}>{profile.name}</Text>
        </View>

        <Text style={styles.metaLine}>{metaLine}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badges</Text>
          {profile.badges.length === 0 ? (
            <Text style={styles.emptyText}>Go to a party to earn your first badge ✨</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.badgeRow}
            >
              {profile.badges.map((badge) => (
                <View key={badge.key} style={styles.badgeChip}>
                  <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                  <Text style={styles.badgeValue}>{badge.value}</Text>
                  <Text style={styles.badgeLabel}>{badge.label}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mutuals</Text>
          <Text style={styles.sectionSubtitle}>Everyone you've ever partied with</Text>
          {profile.mutuals.length === 0 ? (
            <Text style={styles.emptyText}>Party with someone to make your first mutual 🫂</Text>
          ) : (
            <View style={styles.mutualsGrid}>
              {profile.mutuals.map((m) => (
                <View key={m.user.id} style={styles.mutualItem}>
                  <Avatar name={m.user.name} image={m.user.avatarImage} size={44} />
                  <View style={styles.mutualInfo}>
                    <Text style={styles.mutualName} numberOfLines={1}>
                      {m.user.name}
                    </Text>
                    <Text style={styles.mutualShared} numberOfLines={1}>
                      {m.sharedEventTitle}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => toggleCrush(m.user.id)}
                    disabled={crushBusy === m.user.id}
                    style={({ pressed }) => [styles.heartButton, pressed && styles.pressed]}
                  >
                    <Ionicons
                      name={m.crushed ? 'heart' : 'heart-outline'}
                      size={20}
                      color={m.crushed ? colors.danger : colors.muted}
                    />
                  </Pressable>
                </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  hero: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.lg,
  },
  avatarStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigName: {
    ...display(48),
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  metaLine: {
    ...uiText(14),
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  section: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...display(28),
    color: colors.text,
    paddingHorizontal: spacing.md,
  },
  sectionSubtitle: {
    ...uiText(14),
    color: colors.muted,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  emptyText: {
    ...uiText(14),
    color: colors.muted,
    paddingHorizontal: spacing.md,
  },
  badgeRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  badgeChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: 2,
    minWidth: 130,
    ...shadow.card,
  },
  badgeEmoji: {
    fontSize: 32,
  },
  badgeValue: {
    ...display(26),
    color: colors.text,
  },
  badgeLabel: {
    ...uiText(12),
    color: colors.muted,
    textAlign: 'center',
  },
  mutualsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  mutualItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mutualInfo: {
    flex: 1,
    gap: 1,
  },
  mutualName: {
    ...uiText(14, '700'),
    color: colors.text,
  },
  mutualShared: {
    ...uiText(12),
    color: colors.muted,
  },
  heartButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
