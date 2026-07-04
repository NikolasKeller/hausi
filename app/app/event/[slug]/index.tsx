import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { LIMITS, type EventDetail, type RsvpStatus } from '../../../shared/types';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { confirmDialog, notify } from '../../../lib/dialogs';
import { recordRecentEvent } from '../../../lib/recents';
import { shareText } from '../../../lib/share';
import { colors, radius, rsvp, spacing } from '../../../lib/theme';
import { titleFontStyle, display, kicker, uiText } from '../../../lib/fonts';
import { CoverGradient } from '../../../components/CoverGradient';
import { EffectOverlay } from '../../../components/EffectOverlay';
import { Avatar } from '../../../components/Avatar';
import { Button } from '../../../components/ui';
import { Burst, PillBadge } from '../../../components/partiful';
import { formatEventDate, formatEventTime } from '../../../components/EventCard';

const RSVP_OPTIONS: { status: RsvpStatus; label: string; emoji: string }[] = [
  { status: 'GOING', label: 'Going', emoji: '🎉' },
  { status: 'MAYBE', label: 'Maybe', emoji: '🤔' },
  { status: 'CANT', label: "Can't", emoji: '😢' },
];

const STATUS_SECTIONS: { status: RsvpStatus; title: string }[] = [
  { status: 'GOING', title: 'Going' },
  { status: 'WAITLIST', title: 'Waitlist' },
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
      recordRecentEvent({
        slug: res.event.slug,
        title: res.event.title,
        coverTheme: res.event.coverTheme,
        coverImage: res.event.coverImage,
        titleFont: res.event.titleFont,
        date: res.event.date,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load event');
    }
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function setRsvp(status: RsvpStatus) {
    if (!event || rsvpBusy) return;
    setRsvpBusy(true);
    try {
      const res = await api.rsvp(event.id, status);
      setEvent(res.event);
    } catch (e) {
      notify('RSVP failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setRsvpBusy(false);
    }
  }

  async function dropPlusOne(plusOneId: string) {
    if (!event) return;
    try {
      const res = await api.removePlusOne(event.id, plusOneId);
      setEvent(res.event);
    } catch (e) {
      notify('Remove failed', e instanceof Error ? e.message : 'Try again');
    }
  }

  async function share() {
    if (!event) return;
    const url = Linking.createURL(`e/${event.slug}`);
    const message = `You're invited: ${event.title} — ${formatEventDate(event.date)} at ${formatEventTime(event.date)}.\nOpen in Hausi: ${url}`;
    await shareText(message, url);
  }

  async function sharePlusOneInvite() {
    if (!event) return;
    const url = Linking.createURL(`e/${event.slug}`);
    await shareText(`You're my +1 for "${event.title}"! 🎟️ RSVP here: ${url}`, url);
  }

  async function confirmRemoveGuest(guestId: string, guestName: string) {
    if (!event) return;
    const ok = await confirmDialog(
      'Remove guest?',
      `${guestName} will be removed from the guest list.`,
      'Remove'
    );
    if (!ok) return;
    try {
      const res = await api.removeGuest(event.id, guestId);
      setEvent(res.event);
    } catch (e) {
      notify('Remove failed', e instanceof Error ? e.message : 'Try again');
    }
  }

  async function confirmDelete() {
    if (!event) return;
    const ok = await confirmDialog('Delete event?', 'This removes the event for all guests.', 'Delete');
    if (!ok) return;
    try {
      await api.deleteEvent(event.id);
      router.replace('/');
    } catch (e) {
      notify('Delete failed', e instanceof Error ? e.message : 'Try again');
    }
  }

  async function confirmCancel() {
    if (!event) return;
    const ok = await confirmDialog(
      'Cancel event?',
      'All guests will be notified. The page stays visible.',
      'Cancel event',
      'Keep event'
    );
    if (!ok) return;
    try {
      const res = await api.cancelEvent(event.id);
      setEvent(res.event);
    } catch (e) {
      notify('Cancel failed', e instanceof Error ? e.message : 'Try again');
    }
  }

  async function toggleRsvpsOpen() {
    if (!event) return;
    try {
      const res = await api.updateEvent(event.id, { rsvpsOpen: !event.rsvpsOpen });
      setEvent(res.event);
    } catch (e) {
      notify('Update failed', e instanceof Error ? e.message : 'Try again');
    }
  }

  async function sendComment() {
    if (!event || !commentText.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      await api.addComment(event.id, commentText.trim());
      setCommentText('');
      await load();
    } catch (e) {
      notify('Comment failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSendingComment(false);
    }
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>🫠</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Back home" variant="ghost" tone="paper" onPress={() => router.replace('/')} />
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
  const myPlusOne = myRsvp?.guests?.[0] ?? null;
  const spotsLeft =
    event.maxGuests != null ? Math.max(0, event.maxGuests - event.counts.going) : null;
  const canAddPlusOne = spotsLeft == null || spotsLeft > 0;
  // People who can't be a +1 because they're already on the list (as a guest or
  // someone else's +1) — handed to the picker so they don't show up there.
  const plusOneExclude = event.rsvps
    .flatMap((r) => [
      r.status !== 'CANT' ? r.user.id : null,
      ...r.guests.map((g) => g.userId),
    ])
    .filter((id): id is string => !!id)
    .join(',');
  const isCanceled = event.canceledAt != null;
  const rsvpLocked = isCanceled || (!event.rsvpsOpen && !event.canManage);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <CoverGradient theme={event.coverTheme} image={event.coverImage} style={styles.hero}>
          <EffectOverlay effect={event.effect} height={360} />
          <Burst size={60} rays={8} color={colors.helio} rotate={-14} style={styles.heroBurst} />
          <Burst size={38} rays={6} color={colors.accent} rotate={12} style={styles.heroBurst2} />
          <Text style={styles.heroKicker}>You're invited</Text>
          <Text style={[styles.heroTitle, titleFontStyle(event.titleFont)]}>{event.title}</Text>
        </CoverGradient>

        {isCanceled ? (
          <View style={styles.canceledBanner}>
            <Text style={styles.canceledBannerText}>
              😢 This event was canceled by the host
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.hostRow}>
            <Avatar emoji={event.host.avatarEmoji} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.hostedBy}>Hosted by</Text>
              <Text style={styles.hostName}>
                {event.isHost ? `${event.host.name} (you)` : event.host.name}
                {event.cohosts.length
                  ? ` + ${event.cohosts.map((ch) => ch.name).join(', ')}`
                  : ''}
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
            {event.location ? (
              <Text style={styles.metaLine}>
                📍 {event.location}
                {event.city ? `, ${event.city}` : ''}
              </Text>
            ) : null}
            {event.costPerPerson ? (
              <Text style={styles.metaLine}>💸 {event.costPerPerson}</Text>
            ) : null}
            {event.dressCode ? <Text style={styles.metaLine}>👗 {event.dressCode}</Text> : null}
            {spotsLeft != null ? (
              <Text style={styles.metaLine}>
                🎟️ {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Event is full'}
              </Text>
            ) : null}
          </View>

          {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

          {rsvpLocked ? (
            !isCanceled ? (
              <View style={{ gap: spacing.sm }}>
                <View style={styles.lockedNote}>
                  <Text style={styles.lockedNoteText}>🔒 RSVPs are closed for this event</Text>
                </View>
                {myRsvp && myRsvp.status !== 'CANT' ? (
                  <Button
                    title="I can't make it anymore"
                    variant="ghost"
                    tone="paper"
                    onPress={() => setRsvp('CANT')}
                  />
                ) : null}
              </View>
            ) : null
          ) : (
            <View style={styles.rsvpRow}>
              {RSVP_OPTIONS.map((opt) => {
                const active =
                  myRsvp?.status === opt.status ||
                  (opt.status === 'GOING' && myRsvp?.status === 'WAITLIST');
                return (
                  <Pressable
                    key={opt.status}
                    onPress={() => setRsvp(opt.status)}
                    disabled={rsvpBusy}
                    style={[styles.rsvpButton, active && styles.rsvpButtonActive]}
                  >
                    <Text style={styles.rsvpEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.rsvpLabel, active && styles.rsvpLabelActive]}>
                      {opt.status === 'GOING' && myRsvp?.status === 'WAITLIST'
                        ? 'Waitlist'
                        : opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {myRsvp?.status === 'WAITLIST' ? (
            <View style={styles.lockedNote}>
              <Text style={styles.lockedNoteText}>
                ⏳ The event is full — you're #
                {event.rsvps.filter((r) => r.status === 'WAITLIST').findIndex(
                  (r) => r.user.id === user?.id
                ) + 1}{' '}
                on the waitlist
              </Text>
            </View>
          ) : null}

          {myRsvp?.status === 'GOING' && event.plusOneLimit > 0 && (myPlusOne != null || !rsvpLocked) ? (
            <View style={styles.plusOnesRow}>
              <Text style={styles.plusOnesLabel}>Your plus one</Text>
              {myPlusOne ? (
                <View style={styles.plusOneChip}>
                  <Avatar emoji={myPlusOne.avatarEmoji} size={24} />
                  <Text style={styles.plusOneChipName} numberOfLines={1}>
                    {myPlusOne.name}
                  </Text>
                  {myPlusOne.userId == null ? (
                    // Not on Hausi yet — resurface the invite link to text them.
                    <Pressable onPress={sharePlusOneInvite} hitSlop={8}>
                      <Text style={styles.plusOneShareText}>Share invite</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => dropPlusOne(myPlusOne.id)}
                    hitSlop={8}
                    style={styles.removeGuest}
                  >
                    <Text style={styles.removeGuestText}>✕</Text>
                  </Pressable>
                </View>
              ) : canAddPlusOne ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/add-plus-one',
                      params: {
                        eventId: event.id,
                        slug: event.slug,
                        title: event.title,
                        exclude: plusOneExclude,
                      },
                    })
                  }
                  style={styles.addPlusOneButton}
                >
                  <Text style={styles.addPlusOneText}>＋ Bring a +1</Text>
                </Pressable>
              ) : (
                <Text style={styles.plusOnesFull}>Event is full</Text>
              )}
            </View>
          ) : null}

          {event.canManage ? (
            <View style={{ gap: spacing.sm }}>
              {!isCanceled ? (
                <View style={styles.hostActions}>
                  <Button
                    title="Edit event"
                    variant="ghost"
                    tone="paper"
                    onPress={() => router.push(`/event/${event.slug}/edit`)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title={event.rsvpsOpen ? 'Close RSVPs' : 'Open RSVPs'}
                    variant="ghost"
                    tone="paper"
                    onPress={toggleRsvpsOpen}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : null}
              {event.isHost ? (
                <View style={styles.hostActions}>
                  {!isCanceled ? (
                    <Button
                      title="Cancel event"
                      variant="danger"
                      onPress={confirmCancel}
                      style={{ flex: 1 }}
                    />
                  ) : null}
                  <Button
                    title="Delete"
                    variant="danger"
                    onPress={confirmDelete}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.divider} />

          <View style={styles.sectionHead}>
            <Text style={styles.kickerLabel}>Who's coming</Text>
            <Text style={styles.sectionTitle}>Guest list</Text>
            <View style={styles.countPills}>
              <PillBadge label={`${event.counts.going} going`} bg={rsvp.going.bg} color={rsvp.going.text} />
              <PillBadge label={`${event.counts.maybe} maybe`} bg={rsvp.maybe.bg} color={rsvp.maybe.text} />
              {event.counts.waitlist > 0 ? (
                <PillBadge
                  label={`${event.counts.waitlist} waitlist`}
                  bg={rsvp.waitlist.bg}
                  color={rsvp.waitlist.text}
                />
              ) : null}
            </View>
          </View>
          {STATUS_SECTIONS.map(({ status, title }) => {
            const guests = event.rsvps.filter((r) => r.status === status);
            if (!guests.length) return null;
            return (
              <View key={status} style={{ gap: spacing.sm }}>
                <Text style={styles.guestGroupTitle}>{title}</Text>
                {guests.map((r) => {
                  const isCohost = event.cohosts.some((ch) => ch.id === r.user.id);
                  const isMe = r.user.id === user?.id;
                  return (
                    <View key={r.user.id} style={{ gap: spacing.sm }}>
                      <View style={styles.guestRow}>
                        <Avatar emoji={r.user.avatarEmoji} size={32} />
                        <Text style={[styles.guestName, { flex: 1 }]}>
                          {r.user.name}
                          {r.user.id === event.host.id ? '  👑' : isCohost ? '  🤝' : ''}
                        </Text>
                        {event.canManage && r.user.id !== event.host.id && !isCohost ? (
                          <Pressable
                            onPress={() => confirmRemoveGuest(r.user.id, r.user.name)}
                            style={styles.removeGuest}
                            hitSlop={8}
                          >
                            <Text style={styles.removeGuestText}>✕</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {/* Your own +1 is managed via the chip above, so only list others' here. */}
                      {!isMe
                        ? r.guests.map((g) => (
                            <View key={g.id} style={[styles.guestRow, styles.plusOneGuestRow]}>
                              <Avatar emoji={g.avatarEmoji} size={26} />
                              <Text
                                style={[styles.plusOneGuestName, { flex: 1 }]}
                                numberOfLines={1}
                              >
                                {g.name}
                                <Text style={styles.plusOneTag}>{`  +1 of ${r.user.name}`}</Text>
                              </Text>
                              {event.canManage ? (
                                <Pressable
                                  onPress={() => dropPlusOne(g.id)}
                                  style={styles.removeGuest}
                                  hitSlop={8}
                                >
                                  <Text style={styles.removeGuestText}>✕</Text>
                                </Pressable>
                              ) : null}
                            </View>
                          ))
                        : null}
                    </View>
                  );
                })}
              </View>
            );
          })}

          <View style={styles.divider} />

          <View style={styles.sectionHead}>
            <Text style={styles.kickerLabel}>Say hi</Text>
            <Text style={styles.sectionTitle}>Party Wall 💬</Text>
          </View>
          {event.comments.length === 0 ? (
            <Text style={styles.noComments}>No comments yet — break the ice!</Text>
          ) : (
            event.comments.map((c) =>
              c.type === 'system' ? (
                <Text key={c.id} style={styles.systemEntry}>
                  {c.user.avatarEmoji} {c.user.name} {c.text}
                </Text>
              ) : (
                <View key={c.id} style={styles.commentRow}>
                  <Avatar emoji={c.user.avatarEmoji} size={32} />
                  <View style={styles.commentBubble}>
                    <Text style={styles.commentAuthor}>{c.user.name}</Text>
                    <Text style={styles.commentText}>{c.text}</Text>
                  </View>
                </View>
              )
            )
          )}
          <View style={styles.commentInputRow}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Write something…"
              placeholderTextColor={colors.muted}
              style={styles.commentInput}
              multiline
              maxLength={LIMITS.comment}
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
  errorText: { color: colors.text, ...uiText(17, '500'), textAlign: 'center' },
  content: {
    paddingBottom: spacing.section,
  },
  hero: {
    minHeight: 380,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    paddingTop: 100,
    overflow: 'hidden',
  },
  heroBurst: {
    position: 'absolute',
    top: 108,
    right: 24,
  },
  heroBurst2: {
    position: 'absolute',
    top: 168,
    right: 84,
  },
  heroKicker: {
    ...kicker(),
    color: 'rgba(255,255,255,0.92)',
    marginBottom: spacing.sm,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 56,
    letterSpacing: -1,
    lineHeight: 56,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  canceledBanner: {
    backgroundColor: 'rgba(255,107,129,0.12)',
    borderBottomWidth: 2,
    borderColor: colors.danger,
    padding: spacing.md,
  },
  canceledBannerText: {
    color: colors.danger,
    ...uiText(15, '700'),
    textAlign: 'center',
  },
  lockedNote: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  lockedNoteText: {
    color: colors.muted,
    ...uiText(14, '500'),
    textAlign: 'center',
  },
  section: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hostedBy: {
    color: colors.muted,
    ...kicker(),
  },
  hostName: {
    color: colors.text,
    ...uiText(16, '700'),
  },
  shareButton: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  shareText: {
    color: colors.accent,
    ...uiText(14, '700'),
  },
  metaCard: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  metaLine: {
    color: colors.text,
    ...uiText(16, '500'),
  },
  description: {
    color: colors.text,
    ...uiText(16, '400', { lineHeight: 1.45 }),
  },
  sectionHead: {
    gap: spacing.xs,
  },
  kickerLabel: {
    ...kicker(colors.accent),
  },
  countPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
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
    paddingVertical: spacing.md,
  },
  rsvpButtonActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(255,122,224,0.12)',
  },
  rsvpEmoji: {
    fontSize: 28,
  },
  rsvpLabel: {
    color: colors.muted,
    ...uiText(14, '700'),
  },
  rsvpLabelActive: {
    color: colors.text,
  },
  plusOnesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  plusOnesLabel: {
    color: colors.text,
    ...uiText(15, '600'),
  },
  plusOneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '60%',
  },
  plusOneChipName: {
    color: colors.text,
    ...uiText(15, '700'),
    flexShrink: 1,
  },
  plusOneShareText: {
    color: colors.accent,
    ...uiText(13, '700'),
  },
  addPlusOneButton: {
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  addPlusOneText: {
    color: colors.accent,
    ...uiText(14, '700'),
  },
  plusOnesFull: {
    color: colors.muted,
    ...uiText(14, '600'),
  },
  plusOneGuestRow: {
    paddingLeft: spacing.lg,
  },
  plusOneGuestName: {
    color: colors.text,
    ...uiText(15, '400'),
  },
  plusOneTag: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  hostActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  divider: {
    height: 2,
    backgroundColor: colors.cardBorder,
    marginVertical: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    ...display(34),
  },
  guestGroupTitle: {
    ...kicker(colors.accent),
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  guestName: {
    color: colors.text,
    ...uiText(16, '500'),
  },
  noComments: {
    color: colors.muted,
    ...uiText(15, '400'),
  },
  systemEntry: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  removeGuest: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.inputBg,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeGuestText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  commentAuthor: {
    color: colors.accent,
    ...uiText(13, '700'),
  },
  commentText: {
    color: colors.text,
    ...uiText(15, '400', { lineHeight: 1.4 }),
  },
  commentInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 2,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  sendText: {
    color: '#fff',
    ...uiText(15, '700'),
  },
});
