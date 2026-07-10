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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { AdminEventSubmission } from '../../shared/types';
import { api, mediaUrl } from '../../lib/api';
import { notify } from '../../lib/dialogs';
import { colors, radius, shadow, spacing } from '../../lib/theme';
import { display, uiText } from '../../lib/fonts';
import { formatEventDate } from '../../components/EventCard';
import { withScreenBackground } from '../../components/ScreenBackground';

function AdminEventReviewScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<AdminEventSubmission[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.adminEventSubmissions();
      setEvents(res.events);
    } catch (e) {
      notify('Could not load reviews', e instanceof Error ? e.message : 'Try again');
      setEvents([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function decide(event: AdminEventSubmission, action: 'approve' | 'reject') {
    if (busy) return;
    setBusy(event.id);
    try {
      if (action === 'approve') await api.approveEvent(event.id);
      else await api.rejectEvent(event.id);
      setEvents((current) => current?.filter((item) => item.id !== event.id) ?? []);
    } catch (e) {
      notify('Review failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>ADMIN</Text>
          <Text style={styles.title}>Public event review</Text>
        </View>
      </View>

      {!events ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>✓</Text>
          <Text style={styles.emptyTitle}>Queue cleared</Text>
          <Text style={styles.emptyBody}>No public events are waiting for approval.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.queueCopy}>
            {events.length} {events.length === 1 ? 'submission' : 'submissions'} waiting
          </Text>
          {events.map((event) => {
            const photo = mediaUrl(event.coverImage);
            const loading = busy === event.id;
            return (
              <View key={event.id} style={styles.card}>
                {photo ? <Image source={{ uri: photo }} style={styles.cover} /> : null}
                <View style={styles.cardBody}>
                  <View style={styles.hostRow}>
                    <Text style={styles.host}>by {event.host.name}</Text>
                    <Text style={styles.city}>{event.city}</Text>
                  </View>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.meta}>
                    {formatEventDate(event.date)} · {event.location}
                  </Text>
                  {event.description ? (
                    <Text style={styles.description} numberOfLines={4}>
                      {event.description}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={() => router.push(`/event/${event.slug}`)}
                    style={styles.previewLink}
                  >
                    <Text style={styles.previewLinkText}>Preview event</Text>
                    <Ionicons name="open-outline" size={14} color={colors.muted} />
                  </Pressable>
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => decide(event, 'reject')}
                      disabled={loading}
                      style={styles.reject}
                    >
                      <Text style={styles.rejectText}>Reject</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => decide(event, 'approve')}
                      disabled={loading}
                      style={styles.approve}
                    >
                      {loading ? (
                        <ActivityIndicator color={colors.onInk} />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={18} color={colors.onInk} />
                          <Text style={styles.approveText}>Approve public</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export default withScreenBackground(AdminEventReviewScreen, { bloom: false });

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  eyebrow: { ...uiText(10, '700', { tracking: 0.12 }), color: colors.muted },
  title: { ...display(27), color: colors.text },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  queueCopy: { ...uiText(13, '600'), color: colors.muted },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyEmoji: { fontSize: 44, color: colors.success },
  emptyTitle: { ...display(24), color: colors.text },
  emptyBody: { ...uiText(14), color: colors.muted, textAlign: 'center' },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  cover: { width: '100%', height: 150 },
  cardBody: { padding: spacing.md },
  hostRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  host: { ...uiText(12, '600'), color: colors.muted },
  city: { ...uiText(12, '700'), color: colors.muted },
  eventTitle: { ...display(23), color: colors.text, marginTop: 5 },
  meta: { ...uiText(13, '600'), color: colors.muted, marginTop: 3 },
  description: { ...uiText(14), color: colors.text, marginTop: spacing.sm },
  previewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.md,
  },
  previewLinkText: { ...uiText(13, '600'), color: colors.muted },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  reject: {
    minHeight: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  rejectText: { ...uiText(14, '700'), color: colors.danger },
  approve: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.ink,
  },
  approveText: { ...uiText(14, '700'), color: colors.onInk },
});
