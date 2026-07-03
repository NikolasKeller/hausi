import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import type { EventDetail, RsvpStatus } from '../../../../shared/types';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { colors, radius, spacing } from '../../../lib/theme';
import { CoverGradient } from '../../../components/CoverGradient';
import { Avatar } from '../../../components/Avatar';
import { Button } from '../../../components/ui';
import { formatEventDate, formatEventTime } from '../../../components/EventCard';

const RSVP_OPTIONS: { status: RsvpStatus; label: string; emoji: string }[] = [
  { status: 'GOING', label: 'Going', emoji: '🎉' },
  { status: 'MAYBE', label: 'Maybe', emoji: '🤔' },
  { status: 'CANT', label: "Can't", emoji: '😢' },
];

const STATUS_SECTIONS: { status: RsvpStatus; title: string }[] = [
  { status: 'GOING', title: 'Going' },
  { status: 'MAYBE', title: 'Maybe' },
  { status: 'CANT', title: "Can't go" },
];

export default function EventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await api.eventBySlug(slug);
      setEvent(res.event);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load event');
    }
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function setRsvp(status: RsvpStatus, plusOnes = 0) {
    if (!event || rsvpBusy) return;
    setRsvpBusy(true);
    try {
      const res = await api.rsvp(event.id, status, plusOnes);
      setEvent(res.event);
    } catch (e) {
      Alert.alert('RSVP failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setRsvpBusy(false);
    }
  }

  async function share() {
    if (!event) return;
    const url = Linking.createURL(`e/${event.slug}`);
    await Share.share({
      message: `You're invited: ${event.title} — ${formatEventDate(event.date)} at ${formatEventTime(event.date)}.\nOpen in Hausi: ${url}`,
    });
  }

  function confirmDelete() {
    if (!event) return;
    Alert.alert('Delete event?', 'This removes the event for all guests.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteEvent(event.id);
            router.replace('/');
          } catch (e) {
            Alert.alert('Delete failed', e instanceof Error ? e.message : 'Try again');
          }
        },
      },
    ]);
  }

  async function sendComment() {
    if (!event || !commentText.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      await api.addComment(event.id, commentText.trim());
      setCommentText('');
      await load();
    } catch (e) {
      Alert.alert('Comment failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSendingComment(false);
    }
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>🫠</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Back home" variant="ghost" onPress={() => router.replace('/')} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const myRsvp = event.rsvps.find((r) => r.user.id === user?.id);
  const spotsLeft =
    event.maxGuests != null ? Math.max(0, event.maxGuests - event.counts.going) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <CoverGradient theme={event.coverTheme} style={styles.hero}>
          <Text style={styles.heroTitle}>{event.title}</Text>
        </CoverGradient>

        <View style={styles.section}>
          <View style={styles.hostRow}>
            <Avatar emoji={event.host.avatarEmoji} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.hostedBy}>Hosted by</Text>
              <Text style={styles.hostName}>
                {event.isHost ? `${event.host.name} (you)` : event.host.name}
              </Text>
            </View>
            <Pressable onPress={share} style={styles.shareButton}>
              <Text style={styles.shareText}>Share link</Text>
            </Pressable>
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.metaLine}>
              🗓️ {formatEventDate(event.date)} · {formatEventTime(event.date)}
            </Text>
            {event.location ? <Text style={styles.metaLine}>📍 {event.location}</Text> : null}
            {spotsLeft != null ? (
              <Text style={styles.metaLine}>
                🎟️ {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Event is full'}
              </Text>
            ) : null}
          </View>

          {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

          <View style={styles.rsvpRow}>
            {RSVP_OPTIONS.map((opt) => {
              const active = myRsvp?.status === opt.status;
              return (
                <Pressable
                  key={opt.status}
                  onPress={() => setRsvp(opt.status, active ? (myRsvp?.plusOnes ?? 0) : 0)}
                  disabled={rsvpBusy}
                  style={[styles.rsvpButton, active && styles.rsvpButtonActive]}
                >
                  <Text style={styles.rsvpEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.rsvpLabel, active && styles.rsvpLabelActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {myRsvp?.status === 'GOING' ? (
            <View style={styles.plusOnesRow}>
              <Text style={styles.plusOnesLabel}>Plus ones</Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setRsvp('GOING', Math.max(0, (myRsvp.plusOnes ?? 0) - 1))}
                  style={styles.stepButton}
                  disabled={rsvpBusy}
                >
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <Text style={styles.plusOnesValue}>+{myRsvp.plusOnes}</Text>
                <Pressable
                  onPress={() => setRsvp('GOING', (myRsvp.plusOnes ?? 0) + 1)}
                  style={styles.stepButton}
                  disabled={rsvpBusy}
                >
                  <Text style={styles.stepText}>＋</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {event.isHost ? (
            <View style={styles.hostActions}>
              <Button
                title="Edit event"
                variant="ghost"
                onPress={() => router.push(`/event/${event.slug}/edit`)}
                style={{ flex: 1 }}
              />
              <Button title="Delete" variant="danger" onPress={confirmDelete} style={{ flex: 1 }} />
            </View>
          ) : null}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>
            Guest list{' '}
            <Text style={styles.sectionCount}>
              {event.counts.going} going · {event.counts.maybe} maybe
            </Text>
          </Text>
          {STATUS_SECTIONS.map(({ status, title }) => {
            const guests = event.rsvps.filter((r) => r.status === status);
            if (!guests.length) return null;
            return (
              <View key={status} style={{ gap: spacing.sm }}>
                <Text style={styles.guestGroupTitle}>{title}</Text>
                {guests.map((r) => (
                  <View key={r.user.id} style={styles.guestRow}>
                    <Avatar emoji={r.user.avatarEmoji} size={32} />
                    <Text style={styles.guestName}>
                      {r.user.name}
                      {r.plusOnes > 0 ? ` +${r.plusOnes}` : ''}
                      {r.user.id === event.host.id ? '  👑' : ''}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Party Wall 💬</Text>
          {event.comments.length === 0 ? (
            <Text style={styles.noComments}>No comments yet — break the ice!</Text>
          ) : (
            event.comments.map((c) => (
              <View key={c.id} style={styles.commentRow}>
                <Avatar emoji={c.user.avatarEmoji} size={32} />
                <View style={styles.commentBubble}>
                  <Text style={styles.commentAuthor}>{c.user.name}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              </View>
            ))
          )}
          <View style={styles.commentInputRow}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Write something…"
              placeholderTextColor={colors.muted}
              style={styles.commentInput}
              multiline
            />
            <Pressable
              onPress={sendComment}
              disabled={sendingComment || !commentText.trim()}
              style={[styles.sendButton, !commentText.trim() && { opacity: 0.4 }]}
            >
              {sendingComment ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendText}>Send</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  errorEmoji: { fontSize: 48 },
  errorText: { color: colors.text, fontSize: 17, textAlign: 'center' },
  content: {
    paddingBottom: spacing.xl * 2,
  },
  hero: {
    minHeight: 260,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    paddingTop: 100,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  section: {
    padding: spacing.md,
    gap: spacing.md,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hostedBy: {
    color: colors.muted,
    fontSize: 12,
  },
  hostName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  shareButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  shareText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  metaCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  metaLine: {
    color: colors.text,
    fontSize: 16,
  },
  description: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
  },
  rsvpRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rsvpButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  rsvpButtonActive: {
    borderColor: colors.accent,
    backgroundColor: '#241C3B',
  },
  rsvpEmoji: {
    fontSize: 26,
  },
  rsvpLabel: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 14,
  },
  rsvpLabelActive: {
    color: colors.text,
  },
  plusOnesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  plusOnesLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  plusOnesValue: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
    minWidth: 32,
    textAlign: 'center',
  },
  hostActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sectionCount: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  guestGroupTitle: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  guestName: {
    color: colors.text,
    fontSize: 16,
  },
  noComments: {
    color: colors.muted,
    fontSize: 15,
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  commentAuthor: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  commentText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  commentInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: colors.accentDark,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  sendText: {
    color: '#fff',
    fontWeight: '700',
  },
});
