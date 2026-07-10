import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { EventDetail } from '../../../shared/types';
import { api } from '../../../lib/api';
import { confirmDialog, notify } from '../../../lib/dialogs';
import { colors, light, radius, shadow, spacing } from '../../../lib/theme';
import { kicker, uiText } from '../../../lib/fonts';
import { EventForm } from '../../../components/EventForm';
import { PaperBackground } from '../../../components/partiful';
import { Avatar } from '../../../components/Avatar';

export default function EditEventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cohostPhone, setCohostPhone] = useState('');
  const [cohostBusy, setCohostBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!slug || event) return;
      api
        .eventBySlug(slug)
        .then((res) => {
          if (!res.event.canManage) {
            setError('Only hosts can edit this event');
            return;
          }
          if (res.event.canceledAt) {
            setError("Canceled events can't be edited");
            return;
          }
          setEvent(res.event);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load event'));
    }, [slug, event])
  );

  async function addCohost() {
    if (!event || !cohostPhone.trim() || cohostBusy) return;
    setCohostBusy(true);
    try {
      const res = await api.addCohost(event.id, cohostPhone.trim());
      setEvent(res.event);
      setCohostPhone('');
      // No SMS provider (local dev): surface the invite link so it can be
      // shared manually — same idea as the login-code dev preview.
      if (!res.sent && res.devLink) {
        notify('Invite ready', `SMS is off. Share this link:\n${res.devLink}`);
      } else {
        notify('Invite sent', 'They can accept it once they open the link.');
      }
    } catch (e) {
      notify('Could not invite co-host', e instanceof Error ? e.message : 'Try again');
    } finally {
      setCohostBusy(false);
    }
  }

  async function removeCohost(userId: string, name: string) {
    if (!event) return;
    const ok = await confirmDialog(
      'Remove co-host?',
      `${name} will lose host powers but stay on the guest list.`,
      'Remove'
    );
    if (!ok) return;
    try {
      const res = await api.removeCohost(event.id, userId);
      setEvent(res.event);
    } catch (e) {
      notify('Remove failed', e instanceof Error ? e.message : 'Try again');
    }
  }

  if (!event) {
    return (
      <PaperBackground>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={10}
          style={styles.loadingClose}
        >
          <Text style={styles.loadingCloseText}>✕</Text>
        </Pressable>
        <View style={styles.center}>
          {error ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          ) : (
            <ActivityIndicator color={colors.accent} size="large" />
          )}
        </View>
      </PaperBackground>
    );
  }

  return (
    <EventForm
      submitLabel="Save changes"
      initial={{
        title: event.title,
        description: event.description,
        descriptionScale: event.descriptionScale,
        location: event.location,
        city: event.city,
        category: event.category,
        isPublic: event.isPublic,
        costPerPerson: event.costPerPerson,
        dressCode: event.dressCode,
        coverTheme: event.coverTheme,
        coverImage: event.coverImage,
        titleFont: event.titleFont,
        effect: event.effect,
        date: new Date(event.date),
        maxGuests: event.maxGuests,
        plusOneLimit: event.plusOneLimit,
      }}
      onSubmit={async (data) => {
        await api.updateEvent(event.id, data);
        if (router.canGoBack()) router.back();
        else router.replace(`/event/${slug}`);
      }}
      footer={
        event.isHost ? (
          <View style={styles.cohostSection}>
            <Text style={styles.cohostKicker}>Share the load</Text>
            <Text style={styles.cohostTitle}>Co-hosts 🤝</Text>
            {event.cohosts.length === 0 && event.cohostInvites.length === 0 ? (
              <Text style={styles.cohostEmpty}>
                Invite a co-host by phone. They can edit the event and manage the
                guest list once they accept.
              </Text>
            ) : (
              event.cohosts.map((ch) => (
                <View key={ch.id} style={styles.cohostRow}>
                  <Avatar name={ch.name} image={ch.avatarImage} size={30} />
                  <Text style={styles.cohostName}>{ch.name}</Text>
                  <Pressable
                    onPress={() => removeCohost(ch.id, ch.name)}
                    style={styles.cohostRemove}
                    hitSlop={8}
                  >
                    <Text style={styles.cohostRemoveText}>✕</Text>
                  </Pressable>
                </View>
              ))
            )}

            {/* Numbers that have been invited but haven't accepted yet. */}
            {event.cohostInvites.map((inv) => (
              <View key={inv.id} style={styles.cohostRow}>
                <View style={styles.pendingDot}>
                  <Text style={styles.pendingDotText}>🤝</Text>
                </View>
                <Text style={styles.cohostName}>{inv.phone}</Text>
                <Text style={styles.pendingTag}>Pending</Text>
              </View>
            ))}

            <View style={styles.cohostInputRow}>
              <View style={styles.cohostInputWrap}>
                <TextInput
                  value={cohostPhone}
                  onChangeText={setCohostPhone}
                  placeholder="+1 555 123 4567"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  keyboardType="phone-pad"
                  maxLength={20}
                  style={styles.cohostInput}
                />
              </View>
              <Pressable
                onPress={addCohost}
                disabled={cohostBusy || !cohostPhone.trim()}
                style={[
                  styles.cohostAdd,
                  !cohostPhone.trim() && { opacity: 0.4 },
                ]}
              >
                {cohostBusy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.cohostAddText}>Invite</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  loadingClose: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.md,
    zIndex: 1,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.card,
  },
  loadingCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  errorText: {
    color: colors.danger,
    ...uiText(16, '600'),
    textAlign: 'center',
  },
  cohostSection: {
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    paddingTop: spacing.lg,
    marginTop: spacing.sm,
  },
  cohostKicker: {
    ...kicker(light.text3),
  },
  cohostTitle: {
    color: light.text,
    ...uiText(20, '800'),
  },
  cohostEmpty: {
    color: light.text3,
    ...uiText(13, '400'),
  },
  cohostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    ...shadow.card,
  },
  cohostName: {
    color: light.text2,
    ...uiText(15, '500'),
    flex: 1,
  },
  pendingDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  pendingDotText: {
    fontSize: 14,
  },
  pendingTag: {
    ...kicker(colors.accent),
  },
  cohostRemove: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cohostRemoveText: {
    color: light.text3,
    fontSize: 12,
    fontWeight: '600',
  },
  cohostInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cohostInputWrap: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    ...shadow.card,
  },
  cohostInput: {
    flex: 1,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  cohostAdd: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  cohostAddText: {
    ...uiText(15, '600'),
    color: colors.onInk,
  },
});
