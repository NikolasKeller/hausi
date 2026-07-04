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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { LIMITS, type EventDetail, type RsvpStatus } from '../../../shared/types';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { confirmDialog, notify } from '../../../lib/dialogs';
import { recordRecentEvent, removeRecentEvent } from '../../../lib/recents';
import { shareText } from '../../../lib/share';
import { colors, radius, rsvp, spacing } from '../../../lib/theme';
import { titleFontStyle, display, kicker, uiText } from '../../../lib/fonts';
import { CoverGradient } from '../../../components/CoverGradient';
import { ThemeBackground, themeInk } from '../../../components/themes';
import { Glass } from '../../../components/glass';
import { Avatar } from '../../../components/Avatar';
import { Button } from '../../../components/ui';
import { Burst, PillBadge } from '../../../components/partiful';
import { formatEventDate, formatEventTime } from '../../../components/EventCard';

const RSVP_OPTIONS: { status: RsvpStatus; label: string; emoji: string }[] = [
  { status: 'GOING', label: 'Going', emoji: '👍' },
  { status: 'MAYBE', label: 'Maybe', emoji: '🤔' },
  { status: 'CANT', label: "Can't Go", emoji: '😢' },
];

const STATUS_SECTIONS: { status: RsvpStatus; title: string }[] = [
  { status: 'GOING', title: 'Going' },
  { status: 'WAITLIST', title: 'Waitlist' },
  { status: 'MAYBE', title: 'Maybe' },
  { status: 'CANT', title: "Can't go" },
];

// One item in the floating bottom action bar (icon over a small label).
function BarItem({
  icon,
  label,
  color,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.barItem, pressed && { opacity: 0.55 }]}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.barLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// One tappable row in the host "More" menu.
function ActionRow({
  icon,
  label,
  color,
  divider,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  divider?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: divider } : null,
        pressed && { opacity: 0.55 },
      ]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.menuRowText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export default function EventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [showAllGuests, setShowAllGuests] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // "Text Blast": open the OS share/compose sheet with an update the host can
  // fire off to the group. (A true per-guest SMS blast needs a server endpoint.)
  async function textBlast() {
    if (!event) return;
    const url = Linking.createURL(`e/${event.slug}`);
    const msg = `📣 ${event.title} — ${formatEventDate(event.date)} at ${formatEventTime(event.date)}.\nDetails & RSVP: ${url}`;
    await shareText(msg, url);
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
      removeRecentEvent(event.slug);
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

  const ink = themeInk(event.coverTheme);

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
  // Guest-list summary preview: going + maybe, in that order.
  const previewGuests = event.rsvps.filter(
    (r) => r.status === 'GOING' || r.status === 'MAYBE'
  );
  const previewShown = previewGuests.slice(0, 7);
  const previewExtra = event.counts.going + event.counts.maybe - previewShown.length;

  return (
    <ThemeBackground theme={event.coverTheme} effect={event.effect}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 108 }]}
          keyboardShouldPersistTaps="handled"
        >
          {event.coverImage ? (
            <View style={styles.posterWrap}>
              <CoverGradient
                theme={event.coverTheme}
                image={event.coverImage}
                style={styles.poster}
              >
                <Burst size={60} rays={8} color={colors.helio} rotate={-14} style={styles.heroBurst} />
                <Burst size={38} rays={6} color={colors.accent} rotate={12} style={styles.heroBurst2} />
                <Text style={styles.heroKicker}>You're invited</Text>
                <Text style={[styles.heroTitle, titleFontStyle(event.titleFont)]}>{event.title}</Text>
              </CoverGradient>
            </View>
          ) : (
            <View style={styles.heroBlock}>
              <Text style={[styles.heroKickerPlain, { color: ink.subtext }]}>You're invited</Text>
              <Text
                style={[
                  styles.heroTitlePlain,
                  titleFontStyle(event.titleFont),
                  { color: ink.text },
                ]}
              >
                {event.title}
              </Text>
            </View>
          )}

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
                <Text style={[styles.hostedBy, { color: ink.faint }]}>Hosted by</Text>
                <Text style={[styles.hostName, { color: ink.text }]}>
                  {event.isHost ? `${event.host.name} (you)` : event.host.name}
                  {event.cohosts.length
                    ? ` + ${event.cohosts.map((ch) => ch.name).join(', ')}`
                    : ''}
                </Text>
              </View>
              <Pressable onPress={share}>
                <Glass tint={ink.glassTint} radius={radius.pill} style={styles.shareButton}>
                  <Text style={[styles.shareText, { color: ink.text }]}>Share link</Text>
                </Glass>
              </Pressable>
            </View>

            <Glass tint={ink.glassTint} radius={radius.md} style={styles.metaCard}>
              <Text style={[styles.metaLine, { color: ink.text }]}>
                🗓️ {formatEventDate(event.date)} · {formatEventTime(event.date)}
              </Text>
              {event.location ? (
                <Text style={[styles.metaLine, { color: ink.text }]}>
                  📍 {event.location}
                  {event.city ? `, ${event.city}` : ''}
                </Text>
              ) : null}
              {event.costPerPerson ? (
                <Text style={[styles.metaLine, { color: ink.text }]}>💸 {event.costPerPerson}</Text>
              ) : null}
              {event.dressCode ? (
                <Text style={[styles.metaLine, { color: ink.text }]}>👗 {event.dressCode}</Text>
              ) : null}
              {spotsLeft != null ? (
                <Text style={[styles.metaLine, { color: ink.text }]}>
                  🎟️ {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Event is full'}
                </Text>
              ) : null}
            </Glass>

            {event.description ? (
              <Text style={[styles.description, { color: ink.text }]}>{event.description}</Text>
            ) : null}

            {/* Guest list summary — same order as the reference: heading, counts,
                a row of avatars, then a "View all" toggle for the full list. */}
            <Glass tint={ink.glassTint} radius={radius.md} style={styles.guestSummary}>
              <View style={styles.guestSummaryHead}>
                <View>
                  <Text style={[styles.kickerLabel, { color: ink.subtext }]}>Who's coming</Text>
                  <Text style={[styles.sectionTitle, { color: ink.text }]}>Guest List</Text>
                </View>
                <Pressable onPress={() => setShowAllGuests((v) => !v)}>
                  <Glass tint={ink.glassTint} radius={radius.pill} style={styles.viewAllPill}>
                    <Text style={[styles.viewAllText, { color: ink.text }]}>
                      {showAllGuests ? 'Hide' : 'View all'}
                    </Text>
                  </Glass>
                </Pressable>
              </View>
              <Text style={[styles.guestCountsLine, { color: ink.subtext }]}>
                {event.counts.going} Going · {event.counts.maybe} Maybe
                {event.counts.waitlist > 0 ? ` · ${event.counts.waitlist} Waitlist` : ''}
              </Text>
              {previewShown.length ? (
                <View style={styles.avatarStack}>
                  {previewShown.map((r, i) => (
                    <View key={r.user.id} style={i > 0 ? { marginLeft: -10 } : undefined}>
                      <Avatar emoji={r.user.avatarEmoji} size={40} />
                    </View>
                  ))}
                  {previewExtra > 0 ? (
                    <Glass tint={ink.glassTint} radius={999} style={[styles.avatarMore, { marginLeft: -10 }]}>
                      <Text style={[styles.avatarMoreText, { color: ink.text }]}>+{previewExtra}</Text>
                    </Glass>
                  ) : null}
                </View>
              ) : (
                <Text style={[styles.guestEmpty, { color: ink.faint }]}>Be the first to RSVP 👀</Text>
              )}
            </Glass>

            {rsvpLocked ? (
              !isCanceled ? (
                <View style={{ gap: spacing.sm }}>
                  <Glass tint={ink.glassTint} radius={radius.md} style={styles.lockedNote}>
                    <Text style={[styles.lockedNoteText, { color: ink.subtext }]}>
                      🔒 RSVPs are closed for this event
                    </Text>
                  </Glass>
                  {myRsvp && myRsvp.status !== 'CANT' ? (
                    <Button
                      title="I can't make it anymore"
                      variant="ghost"
                      tone={ink.dark ? 'paper' : 'ink'}
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
                      style={({ pressed }) => [styles.rsvpButtonWrap, pressed && { opacity: 0.8 }]}
                    >
                      <Glass
                        tint={ink.glassTint}
                        radius={999}
                        fill={active ? (ink.dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.42)') : undefined}
                        style={[styles.rsvpCircle, active && { borderColor: ink.text, borderWidth: 2 }]}
                      >
                        <Text style={styles.rsvpEmoji}>{opt.emoji}</Text>
                      </Glass>
                      <Text
                        style={[
                          styles.rsvpLabel,
                          { color: active ? ink.text : ink.subtext, fontWeight: active ? '800' : '600' },
                        ]}
                      >
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
              <Glass tint={ink.glassTint} radius={radius.md} style={styles.lockedNote}>
                <Text style={[styles.lockedNoteText, { color: ink.subtext }]}>
                  ⏳ The event is full — you're #
                  {event.rsvps.filter((r) => r.status === 'WAITLIST').findIndex(
                    (r) => r.user.id === user?.id
                  ) + 1}{' '}
                  on the waitlist
                </Text>
              </Glass>
            ) : null}

            {myRsvp?.status === 'GOING' && event.plusOneLimit > 0 && (myPlusOne != null || !rsvpLocked) ? (
              <Glass tint={ink.glassTint} radius={radius.md} style={styles.plusOnesRow}>
                <Text style={[styles.plusOnesLabel, { color: ink.text }]}>Your plus one</Text>
                {myPlusOne ? (
                  <View style={styles.plusOneChip}>
                    <Avatar emoji={myPlusOne.avatarEmoji} size={24} />
                    <Text style={[styles.plusOneChipName, { color: ink.text }]} numberOfLines={1}>
                      {myPlusOne.name}
                    </Text>
                    {myPlusOne.userId == null ? (
                      // Not on Hausi yet — resurface the invite link to text them.
                      <Pressable onPress={sharePlusOneInvite} hitSlop={8}>
                        <Text style={[styles.plusOneShareText, { color: ink.text }]}>Share invite</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => dropPlusOne(myPlusOne.id)}
                      hitSlop={8}
                      style={[styles.removeGuest, { borderColor: ink.hairline }]}
                    >
                      <Text style={[styles.removeGuestText, { color: ink.subtext }]}>✕</Text>
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
                  >
                    <Glass tint={ink.glassTint} radius={radius.pill} style={styles.addPlusOneButton}>
                      <Text style={[styles.addPlusOneText, { color: ink.text }]}>＋ Bring a +1</Text>
                    </Glass>
                  </Pressable>
                ) : (
                  <Text style={[styles.plusOnesFull, { color: ink.faint }]}>Event is full</Text>
                )}
              </Glass>
            ) : null}

            {showAllGuests ? (
            <>
            <View style={[styles.divider, { backgroundColor: ink.hairline }]} />

            <View style={styles.sectionHead}>
              <Text style={[styles.kickerLabel, { color: ink.subtext }]}>Who's coming</Text>
              <Text style={[styles.sectionTitle, { color: ink.text }]}>Guest list</Text>
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
                  <Text style={[styles.guestGroupTitle, { color: ink.subtext }]}>{title}</Text>
                  {guests.map((r) => {
                    const isCohost = event.cohosts.some((ch) => ch.id === r.user.id);
                    const isMe = r.user.id === user?.id;
                    return (
                      <View key={r.user.id} style={{ gap: spacing.sm }}>
                        <Glass tint={ink.glassTint} radius={radius.md} style={styles.guestRow}>
                          <Avatar emoji={r.user.avatarEmoji} size={32} />
                          <Text style={[styles.guestName, { flex: 1, color: ink.text }]}>
                            {r.user.name}
                            {r.user.id === event.host.id ? '  👑' : isCohost ? '  🤝' : ''}
                          </Text>
                          {event.canManage && r.user.id !== event.host.id && !isCohost ? (
                            <Pressable
                              onPress={() => confirmRemoveGuest(r.user.id, r.user.name)}
                              style={[styles.removeGuest, { borderColor: ink.hairline }]}
                              hitSlop={8}
                            >
                              <Text style={[styles.removeGuestText, { color: ink.subtext }]}>✕</Text>
                            </Pressable>
                          ) : null}
                        </Glass>
                        {/* Your own +1 is managed via the chip above, so only list others' here. */}
                        {!isMe
                          ? r.guests.map((g) => (
                              <Glass
                                key={g.id}
                                tint={ink.glassTint}
                                radius={radius.md}
                                style={[styles.guestRow, styles.plusOneGuestRow]}
                              >
                                <Avatar emoji={g.avatarEmoji} size={26} />
                                <Text
                                  style={[styles.plusOneGuestName, { flex: 1, color: ink.text }]}
                                  numberOfLines={1}
                                >
                                  {g.name}
                                  <Text style={[styles.plusOneTag, { color: ink.faint }]}>{`  +1 of ${r.user.name}`}</Text>
                                </Text>
                                {event.canManage ? (
                                  <Pressable
                                    onPress={() => dropPlusOne(g.id)}
                                    style={[styles.removeGuest, { borderColor: ink.hairline }]}
                                    hitSlop={8}
                                  >
                                    <Text style={[styles.removeGuestText, { color: ink.subtext }]}>✕</Text>
                                  </Pressable>
                                ) : null}
                              </Glass>
                            ))
                          : null}
                      </View>
                    );
                  })}
                </View>
              );
            })}
            </>
            ) : null}

            <View style={[styles.divider, { backgroundColor: ink.hairline }]} />

            <View style={styles.sectionHead}>
              <Text style={[styles.kickerLabel, { color: ink.subtext }]}>Say hi</Text>
              <Text style={[styles.sectionTitle, { color: ink.text }]}>Party Wall 💬</Text>
            </View>
            {event.comments.length === 0 ? (
              <Text style={[styles.noComments, { color: ink.faint }]}>No comments yet — break the ice!</Text>
            ) : (
              event.comments.map((c) =>
                c.type === 'system' ? (
                  <Text key={c.id} style={[styles.systemEntry, { color: ink.faint }]}>
                    {c.user.avatarEmoji} {c.user.name} {c.text}
                  </Text>
                ) : (
                  <View key={c.id} style={styles.commentRow}>
                    <Avatar emoji={c.user.avatarEmoji} size={32} />
                    <Glass tint={ink.glassTint} radius={radius.md} style={styles.commentBubble}>
                      <Text style={[styles.commentAuthor, { color: ink.text }]}>{c.user.name}</Text>
                      <Text style={[styles.commentText, { color: ink.text }]}>{c.text}</Text>
                    </Glass>
                  </View>
                )
              )
            )}
            <View style={styles.commentInputRow}>
              <Glass tint={ink.glassTint} radius={radius.md} style={styles.commentInputWrap}>
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Write something…"
                  placeholderTextColor={ink.faint}
                  style={[styles.commentInput, { color: ink.text }]}
                  multiline
                  maxLength={LIMITS.comment}
                />
              </Glass>
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

      {/* Floating back button — the screen has no nav header (so no opaque bar
          over the full-bleed theme); this glass chip sits over the cover. */}
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={10}
        style={[styles.backFab, { top: insets.top + spacing.sm }]}
      >
        <Glass tint={ink.glassTint} radius={999} style={styles.fabInner}>
          <Ionicons name="chevron-back" size={24} color={ink.text} />
        </Glass>
      </Pressable>

      {/* Floating bottom action bar — Edit · Text Blast · Going · Invite · More.
          Host-only items are hidden for guests; the body stays uncluttered. */}
      <View
        pointerEvents="box-none"
        style={[styles.actionBarWrap, { paddingBottom: insets.bottom + spacing.sm }]}
      >
        <Glass tint={ink.dark ? 'dark' : 'light'} radius={radius.pill} style={styles.actionBar}>
          {event.canManage ? (
            <BarItem
              icon="pencil"
              label="Edit"
              color={ink.text}
              onPress={() => router.push(`/event/${event.slug}/edit`)}
            />
          ) : null}
          {event.canManage ? (
            <BarItem icon="megaphone" label="Text Blast" color={ink.text} onPress={textBlast} />
          ) : null}

          <Pressable
            onPress={() => {
              if (!rsvpLocked) setRsvp('GOING');
            }}
            disabled={rsvpBusy}
            style={({ pressed }) => [styles.barGoing, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.barGoingCount}>{event.counts.going}</Text>
            <Text style={styles.barGoingLabel}>Going</Text>
          </Pressable>

          <BarItem icon="person-add" label="Invite" color={ink.text} onPress={share} />
          {event.canManage ? (
            <BarItem
              icon="ellipsis-horizontal"
              label="More"
              color={ink.text}
              onPress={() => setMenuOpen(true)}
            />
          ) : null}
        </Glass>
      </View>

      {menuOpen ? (
        <View style={styles.menuOverlay}>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.menuBackdrop]}
            onPress={() => setMenuOpen(false)}
          />
          <View style={[styles.menuSheetWrap, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Glass tint={ink.dark ? 'dark' : 'light'} radius={radius.lg} style={styles.menuSheet}>
              <Text style={[styles.menuTitle, { color: ink.subtext }]}>Manage event</Text>
              <ActionRow
                icon="create-outline"
                label="Event settings"
                color={ink.text}
                onPress={() => {
                  setMenuOpen(false);
                  router.push(`/event/${event.slug}/edit`);
                }}
              />
              {!isCanceled ? (
                <ActionRow
                  icon={event.rsvpsOpen ? 'lock-closed-outline' : 'lock-open-outline'}
                  label={event.rsvpsOpen ? 'Close RSVPs' : 'Open RSVPs'}
                  color={ink.text}
                  divider={ink.hairline}
                  onPress={() => {
                    setMenuOpen(false);
                    toggleRsvpsOpen();
                  }}
                />
              ) : null}
              {event.isHost && !isCanceled ? (
                <ActionRow
                  icon="close-circle-outline"
                  label="Cancel event"
                  color={colors.danger}
                  divider={ink.hairline}
                  onPress={() => {
                    setMenuOpen(false);
                    confirmCancel();
                  }}
                />
              ) : null}
              {event.isHost ? (
                <ActionRow
                  icon="trash-outline"
                  label="Delete event"
                  color={colors.danger}
                  divider={ink.hairline}
                  onPress={() => {
                    setMenuOpen(false);
                    confirmDelete();
                  }}
                />
              ) : null}
            </Glass>
          </View>
        </View>
      ) : null}
    </ThemeBackground>
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
  backFab: {
    position: 'absolute',
    left: spacing.lg,
    zIndex: 20,
  },
  fabInner: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBarWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
    zIndex: 20,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  barItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minWidth: 50,
    paddingVertical: 6,
  },
  barLabel: {
    ...uiText(11, '600'),
  },
  barGoing: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    width: 58,
    height: 58,
    borderRadius: 29,
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  barGoingCount: {
    ...uiText(18, '800'),
    color: '#111',
  },
  barGoingLabel: {
    ...uiText(10, '700'),
    color: '#555',
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    justifyContent: 'flex-end',
  },
  menuBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  menuSheetWrap: {
    paddingHorizontal: spacing.lg,
  },
  menuSheet: {
    padding: spacing.xs,
    overflow: 'hidden',
  },
  menuTitle: {
    ...kicker(),
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  menuRowText: {
    ...uiText(16, '600'),
  },
  errorEmoji: { fontSize: 48 },
  errorText: { color: colors.text, ...uiText(17, '500'), textAlign: 'center' },
  content: {
    paddingBottom: spacing.section,
  },
  posterWrap: {
    padding: spacing.lg,
    paddingTop: 80,
  },
  poster: {
    minHeight: 300,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  heroBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: 100,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  heroBurst: {
    position: 'absolute',
    top: 24,
    right: 24,
  },
  heroBurst2: {
    position: 'absolute',
    top: 84,
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
  heroKickerPlain: {
    ...kicker(),
  },
  heroTitlePlain: {
    fontSize: 56,
    letterSpacing: -1,
    lineHeight: 56,
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
    padding: spacing.md,
  },
  lockedNoteText: {
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
    ...kicker(),
  },
  hostName: {
    ...uiText(16, '700'),
  },
  shareButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  shareText: {
    ...uiText(14, '700'),
  },
  metaCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  metaLine: {
    ...uiText(16, '500'),
  },
  description: {
    ...uiText(16, '400', { lineHeight: 1.45 }),
  },
  sectionHead: {
    gap: spacing.xs,
  },
  kickerLabel: {
    ...kicker(),
  },
  countPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  rsvpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.sm,
  },
  rsvpButtonWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  rsvpCircle: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rsvpEmoji: {
    fontSize: 32,
  },
  rsvpLabel: {
    ...uiText(14, '700'),
  },
  guestSummary: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  guestSummaryHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  viewAllPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  viewAllText: {
    ...uiText(13, '700'),
  },
  guestCountsLine: {
    ...uiText(14, '600'),
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  avatarMore: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMoreText: {
    ...uiText(13, '800'),
  },
  guestEmpty: {
    ...uiText(14, '500'),
  },
  plusOnesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  plusOnesLabel: {
    ...uiText(15, '600'),
  },
  plusOneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '60%',
  },
  plusOneChipName: {
    ...uiText(15, '700'),
    flexShrink: 1,
  },
  plusOneShareText: {
    ...uiText(13, '700'),
  },
  addPlusOneButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  addPlusOneText: {
    ...uiText(14, '700'),
  },
  plusOnesFull: {
    ...uiText(14, '600'),
  },
  plusOneGuestRow: {
    marginLeft: spacing.lg,
  },
  plusOneGuestName: {
    ...uiText(15, '400'),
  },
  plusOneTag: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  divider: {
    height: 2,
    marginVertical: spacing.sm,
  },
  sectionTitle: {
    ...display(34),
  },
  guestGroupTitle: {
    ...kicker(),
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  guestName: {
    ...uiText(16, '500'),
  },
  noComments: {
    ...uiText(15, '400'),
  },
  systemEntry: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  removeGuest: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeGuestText: {
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
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  commentAuthor: {
    ...uiText(13, '700'),
  },
  commentText: {
    ...uiText(15, '400', { lineHeight: 1.4 }),
  },
  commentInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  commentInputWrap: {
    flex: 1,
    maxHeight: 120,
  },
  commentInput: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
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
