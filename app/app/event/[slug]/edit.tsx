import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { EventDetail } from '../../../shared/types';
import { api } from '../../../lib/api';
import { colors, radius, spacing } from '../../../lib/theme';
import { EventForm } from '../../../components/EventForm';
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
      Alert.alert('Could not add co-host', e instanceof Error ? e.message : 'Try again');
    } finally {
      setCohostBusy(false);
    }
  }

  async function removeCohost(userId: string, name: string) {
    if (!event) return;
    Alert.alert('Remove co-host?', `${name} will lose host powers but stay on the guest list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await api.removeCohost(event.id, userId);
            setEvent(res.event);
          } catch (e) {
            Alert.alert('Remove failed', e instanceof Error ? e.message : 'Try again');
          }
        },
      },
    ]);
  }

  if (!event) {
    return (
      <View style={styles.center}>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <ActivityIndicator color={colors.accent} size="large" />
        )}
      </View>
    );
  }

  return (
    <EventForm
      submitLabel="Save changes"
      initial={{
        title: event.title,
        description: event.description,
        location: event.location,
        coverTheme: event.coverTheme,
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
          <View style={styles.cohostSection}>
            <Text style={styles.cohostTitle}>Co-hosts 🤝</Text>
            {event.cohosts.length === 0 ? (
              <Text style={styles.cohostEmpty}>
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
              <TextInput
                value={cohostEmail}
                onChangeText={setCohostEmail}
                placeholder="friend@example.com"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.cohostInput}
              />
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
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: 16,
    textAlign: 'center',
  },
  cohostSection: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.cardBorder,
    paddingTop: spacing.md,
  },
  cohostTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  cohostEmpty: {
    color: colors.muted,
    fontSize: 13,
  },
  cohostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cohostName: {
    color: colors.text,
    fontSize: 15,
    flex: 1,
  },
  cohostRemove: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cohostRemoveText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  cohostInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cohostInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  cohostAdd: {
    backgroundColor: colors.accentDark,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  cohostAddText: {
    color: '#fff',
    fontWeight: '700',
  },
});
