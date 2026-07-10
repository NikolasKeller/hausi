import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import type { MyProfile, PublicUser } from '../shared/types';
import { api } from '../lib/api';
import { notify } from '../lib/dialogs';
import { copyLink, shareText, textInvite } from '../lib/share';
import { colors, radius, shadow, spacing } from '../lib/theme';
import { display, uiText } from '../lib/fonts';
import { Avatar } from './Avatar';

export function EventInviteSheet({
  eventId,
  slug,
  title,
  canDirectInvite,
  onClose,
}: {
  eventId: string;
  slug: string;
  title: string;
  canDirectInvite: boolean;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const url = Linking.createURL(`e/${slug}`);
  const message = `You're invited: ${title}\n${url}`;

  useEffect(() => {
    if (!canDirectInvite) return;
    api
      .myProfile()
      .then((res) => setProfile(res.profile))
      .catch(() => setProfile(null));
  }, [canDirectInvite]);

  const people = useMemo(() => {
    const byId = new Map<string, PublicUser>();
    for (const friend of profile?.friends ?? []) byId.set(friend.user.id, friend.user);
    for (const mutual of profile?.mutuals ?? []) byId.set(mutual.user.id, mutual.user);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [profile]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendDirect() {
    if (!selected.size || sending) return;
    setSending(true);
    try {
      const res = await api.invitePeople(eventId, [...selected]);
      notify(
        'Invites sent ✨',
        `${res.invited.length} ${res.invited.length === 1 ? 'person has' : 'people have'} it in the app.`
      );
      onClose();
    } catch (e) {
      notify('Could not send invites', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>INVITE</Text>
            <Text style={styles.title}>Bring your people</Text>
          </View>
          <Pressable onPress={onClose} style={styles.close}>
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.shareActions}>
          <Pressable onPress={() => shareText(message, url)} style={styles.shareAction}>
            <Ionicons name="share-outline" size={21} color={colors.text} />
            <Text style={styles.shareLabel}>Share</Text>
          </Pressable>
          <Pressable onPress={() => textInvite('', message, url)} style={styles.shareAction}>
            <Ionicons name="chatbubble-outline" size={21} color={colors.text} />
            <Text style={styles.shareLabel}>Message</Text>
          </Pressable>
          <Pressable onPress={() => copyLink(url)} style={styles.shareAction}>
            <Ionicons name="link-outline" size={21} color={colors.text} />
            <Text style={styles.shareLabel}>Copy link</Text>
          </Pressable>
        </View>

        {canDirectInvite ? (
          <>
        <View style={styles.divider} />
        <Text style={styles.peopleLabel}>Friends & people you've met</Text>
        {!profile ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />
        ) : people.length === 0 ? (
          <Text style={styles.empty}>
            Add friends or meet people at events, and they'll appear here for one-tap invites.
          </Text>
        ) : (
          <ScrollView style={styles.peopleScroll} contentContainerStyle={styles.people}>
            {people.map((person) => {
              const active = selected.has(person.id);
              return (
                <Pressable
                  key={person.id}
                  onPress={() => toggle(person.id)}
                  style={[styles.person, active && styles.personSelected]}
                >
                  <Avatar name={person.name} image={person.avatarImage} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>{person.name}</Text>
                    <Text style={styles.handle}>@{person.username}</Text>
                  </View>
                  <View style={[styles.check, active && styles.checkActive]}>
                    {active ? <Ionicons name="checkmark" size={15} color={colors.onInk} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {people.length ? (
          <Pressable
            onPress={sendDirect}
            disabled={!selected.size || sending}
            style={[styles.send, !selected.size && styles.disabled]}
          >
            {sending ? (
              <ActivityIndicator color={colors.onInk} />
            ) : (
              <>
                <Ionicons name="paper-plane" size={18} color={colors.onInk} />
                <Text style={styles.sendText}>
                  Send {selected.size || ''} {selected.size === 1 ? 'invite' : 'invites'}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    zIndex: 60,
  },
  sheet: {
    maxHeight: '84%',
    backgroundColor: 'rgba(15,19,32,0.98)',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    ...shadow.float,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cardBorder,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kicker: { ...uiText(10, '700', { tracking: 0.12 }), color: colors.muted },
  title: { ...display(26), color: colors.text },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
  },
  shareActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  shareAction: {
    flex: 1,
    minHeight: 70,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  shareLabel: { ...uiText(12, '700'), color: colors.text },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.cardBorder, marginVertical: spacing.md },
  peopleLabel: { ...uiText(12, '700'), color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  peopleScroll: { maxHeight: 310, marginTop: spacing.sm },
  people: { gap: 6 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  personSelected: { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
  personName: { ...uiText(14, '700'), color: colors.text },
  handle: { ...uiText(11), color: colors.muted },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  empty: { ...uiText(13), color: colors.muted, textAlign: 'center', paddingVertical: spacing.lg },
  send: {
    minHeight: 48,
    marginTop: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { ...uiText(14, '700'), color: colors.onInk },
  disabled: { opacity: 0.4 },
});
