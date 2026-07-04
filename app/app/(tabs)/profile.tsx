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
import { LinearGradient } from 'expo-linear-gradient';
import type { CardEntry, MyProfile } from '../../shared/types';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { confirmDialog, notify } from '../../lib/dialogs';
import { shareText } from '../../lib/share';
import { colors, radius, spacing } from '../../lib/theme';
import { Avatar } from '../../components/Avatar';
import { CoverGradient } from '../../components/CoverGradient';
import { Button } from '../../components/ui';

function joinedLabel(iso: string): string {
  const date = new Date(iso);
  const month = date.toLocaleDateString(undefined, { month: 'short' });
  return `${month} '${String(date.getFullYear()).slice(-2)}`;
}

function cardDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function cardDirection(card: CardEntry, myId: string | undefined): string {
  if (myId && card.from.id === myId) return `to ${card.to.name}`;
  return `${card.from.avatarEmoji} from ${card.from.name}`;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crushBusy, setCrushBusy] = useState<string | null>(null);

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

  async function openSettings() {
    const ok = await confirmDialog('Log out?', 'You can log back in with your phone number.', 'Log out');
    if (ok) logout().catch(() => {});
  }

  async function shareProfile() {
    if (!profile) return;
    await shareText(`Add me on Hausi 🎉 — ${profile.name}`);
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
          <Text style={styles.headerName} numberOfLines={1}>
            {profile.name}
          </Text>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/edit-profile')}
              style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
            >
              <Ionicons name="pencil" size={18} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={openSettings}
              style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
            >
              <Ionicons name="settings-sharp" size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <LinearGradient
            colors={['rgba(124,92,255,0.35)', 'rgba(180,140,255,0.12)', 'rgba(14,11,22,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.heroGlow}
          >
            <Avatar emoji={profile.avatarEmoji} size={120} />
          </LinearGradient>
          <Text style={styles.bigName}>{profile.name}</Text>
        </View>

        <View style={styles.actionRow}>
          <Button
            title="Edit profile"
            variant="ghost"
            onPress={() => router.push('/edit-profile')}
            style={styles.actionButton}
          />
          <Button
            title="Share profile"
            variant="ghost"
            onPress={shareProfile}
            style={styles.actionButton}
          />
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
              {profile.badges.map((badge, i) => (
                <View
                  key={badge.key}
                  style={[
                    styles.badgeChip,
                    { borderColor: i % 2 === 0 ? colors.accent : colors.success },
                  ]}
                >
                  <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                  <Text
                    style={[
                      styles.badgeValue,
                      { color: i % 2 === 0 ? colors.accent : colors.success },
                    ]}
                  >
                    {badge.value}
                  </Text>
                  <Text style={styles.badgeLabel}>{badge.label}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mutuals</Text>
          <Text style={styles.sectionSubtitle}>Everyone you've ever partied with 🥳</Text>
          {profile.mutuals.length === 0 ? (
            <Text style={styles.emptyText}>Party with someone to make your first mutual 🫂</Text>
          ) : (
            <View style={styles.mutualsGrid}>
              {profile.mutuals.map((m) => (
                <View key={m.user.id} style={styles.mutualItem}>
                  <Avatar emoji={m.user.avatarEmoji} size={44} />
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

        {profile.cards.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My cards 💌</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardsRow}
            >
              {profile.cards.map((card) => (
                <CoverGradient key={card.id} theme="candy" style={styles.cardItem}>
                  <Text style={styles.cardFrom} numberOfLines={1}>
                    {cardDirection(card, user?.id)}
                  </Text>
                  <Text style={styles.cardMessage} numberOfLines={3}>
                    {card.message}
                  </Text>
                  <Text style={styles.cardDate}>{cardDate(card.createdAt)}</Text>
                </CoverGradient>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: 15,
    textAlign: 'center',
  },
  container: {
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  headerName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roundButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  heroGlow: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigName: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  metaLine: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  section: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    paddingHorizontal: spacing.md,
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 14,
    paddingHorizontal: spacing.md,
    marginTop: -spacing.xs,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    paddingHorizontal: spacing.md,
  },
  badgeRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  badgeChip: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: 2,
    minWidth: 130,
  },
  badgeEmoji: {
    fontSize: 32,
  },
  badgeValue: {
    fontSize: 26,
    fontWeight: '800',
  },
  badgeLabel: {
    color: colors.muted,
    fontSize: 12,
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
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  mutualShared: {
    color: colors.muted,
    fontSize: 12,
  },
  heartButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardsRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cardItem: {
    width: 200,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardFrom: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cardMessage: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cardDate: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
});
