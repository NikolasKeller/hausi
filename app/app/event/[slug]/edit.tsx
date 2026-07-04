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
import { themeInk } from '../../../lib/covers';
import { EventForm } from '../../../components/EventForm';
import { PaperBackground } from '../../../components/partiful';
import { Avatar } from '../../../components/Avatar';

export default function EditEventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cohostEmail, setCohostEmail] = useState('');
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
    if (!event || !cohostEmail.trim() || cohostBusy) return;
    setCohostBusy(true);
    try {
      const res = await api.addCohost(event.id, cohostEmail.trim());
      setEvent(res.event);
      setCohostEmail('');
    } catch (e) {
      notify('Could not add co-host', e instanceof Error ? e.message : 'Try again');
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

  // The co-host footer renders on the full-screen theme gradient, so its
  // floating text + CTA adapt to the theme's mood for guaranteed contrast.
  const ink = themeInk(event.coverTheme);

  return (
    <EventForm
      submitLabel="Save changes"
      initial={{
        title: event.title,
        description: event.description,
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
          <View style={[styles.cohostSection, { borderColor: ink.hairline }]}>
            <Text style={[styles.cohostKicker, { color: ink.faint }]}>Share the load</Text>
            <Text style={[styles.cohostTitle, { color: ink.text }]}>Co-hosts 🤝</Text>
            {event.cohosts.length === 0 ? (
              <Text style={[styles.cohostEmpty, { color: ink.faint }]}>
                Co-hosts can edit the event and manage the guest list.
              </Text>
            ) : (
              event.cohosts.map((ch) => (
                <View key={ch.id} style={styles.cohostRow}>
                  <Avatar emoji={ch.avatarEmoji} size={30} />
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
            <View style={styles.cohostInputRow}>
              <View style={styles.cohostInputWrap}>
                <TextInput
                  value={cohostEmail}
                  onChangeText={setCohostEmail}
                  placeholder="friend@example.com"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.cohostInput}
                />
              </View>
              <Pressable
                onPress={addCohost}
                disabled={cohostBusy || !cohostEmail.trim()}
                style={[
                  styles.cohostAdd,
                  { backgroundColor: ink.dark ? '#fff' : colors.ink },
                  !cohostEmail.trim() && { opacity: 0.4 },
                ]}
              >
                {cohostBusy ? (
                  <ActivityIndicator color={ink.dark ? colors.ink : '#fff'} size="small" />
                ) : (
                  <Text style={[styles.cohostAddText, { color: ink.dark ? colors.ink : '#fff' }]}>Add</Text>
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  cohostAddText: {
    color: '#fff',
    ...uiText(15, '700'),
  },
});
