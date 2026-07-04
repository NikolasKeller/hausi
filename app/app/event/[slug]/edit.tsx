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
import { colors, light, radius, spacing } from '../../../lib/theme';
import { kicker, uiText } from '../../../lib/fonts';
import { themeInk } from '../../../lib/covers';
import { EventForm } from '../../../components/EventForm';
import { Glass } from '../../../components/glass';
import { ThemeBackground } from '../../../components/themes';
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
    const loadingTheme = 'sunset';
    const loadingInk = themeInk(loadingTheme);
    return (
      <ThemeBackground theme={loadingTheme}>
        <View style={styles.center}>
          {error ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          ) : (
            <ActivityIndicator color={loadingInk.text} size="large" />
          )}
        </View>
      </ThemeBackground>
    );
  }

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
        router.back();
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
                <Glass
                  key={ch.id}
                  radius={radius.md}
                  intensity={24}
                  tint={ink.glassTint}
                  style={styles.cohostRow}
                >
                  <Avatar emoji={ch.avatarEmoji} size={30} />
                  <Text style={[styles.cohostName, { color: ink.subtext }]}>{ch.name}</Text>
                  <Pressable
                    onPress={() => removeCohost(ch.id, ch.name)}
                    style={styles.cohostRemoveWrap}
                    hitSlop={8}
                  >
                    <Glass radius={13} intensity={30} tint={ink.glassTint} style={styles.cohostRemove}>
                      <Text style={[styles.cohostRemoveText, { color: ink.faint }]}>✕</Text>
                    </Glass>
                  </Pressable>
                </Glass>
              ))
            )}
            <View style={styles.cohostInputRow}>
              <Glass radius={14} intensity={24} tint={ink.glassTint} style={styles.cohostInputWrap}>
                <TextInput
                  value={cohostEmail}
                  onChangeText={setCohostEmail}
                  placeholder="friend@example.com"
                  placeholderTextColor={ink.faint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.cohostInput, { color: ink.text }]}
                />
              </Glass>
              <Pressable
                onPress={addCohost}
                disabled={cohostBusy || !cohostEmail.trim()}
                style={[styles.cohostAdd, !cohostEmail.trim() && { opacity: 0.4 }]}
              >
                {cohostBusy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.cohostAddText}>Add</Text>
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
  errorText: {
    color: colors.danger,
    ...uiText(16, '600'),
    textAlign: 'center',
  },
  cohostSection: {
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
    paddingTop: spacing.lg,
    marginTop: spacing.sm,
  },
  cohostKicker: {
    ...kicker('rgba(0,0,0,0.5)'),
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
  },
  cohostName: {
    color: light.text2,
    ...uiText(15, '500'),
    flex: 1,
  },
  cohostRemoveWrap: {
    width: 26,
    height: 26,
  },
  cohostRemove: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cohostRemoveText: {
    color: 'rgba(0,0,0,0.5)',
    fontSize: 12,
    fontWeight: '700',
  },
  cohostInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cohostInputWrap: {
    flex: 1,
  },
  cohostInput: {
    flex: 1,
    color: '#0A0A0A',
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
