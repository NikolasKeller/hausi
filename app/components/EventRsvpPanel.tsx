import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  APPLICATION_DEFAULT_QUESTION,
  APPLICATION_LIMITS,
  type EventDetail,
  type MyProfile,
  type PublicUser,
  type RsvpStatus,
} from '../shared/types';
import { api } from '../lib/api';
import { confirmDialog, notify } from '../lib/dialogs';
import { colors, radius, rsvp, spacing } from '../lib/theme';
import { display, uiText } from '../lib/fonts';
import { Avatar } from './Avatar';

const CHOICES: {
  status: 'GOING' | 'MAYBE' | 'CANT';
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { status: 'GOING', label: "I'm in", icon: 'checkmark-circle-outline' },
  { status: 'MAYBE', label: 'Maybe', icon: 'help-circle-outline' },
  { status: 'CANT', label: "Can't", icon: 'close-circle-outline' },
];

const STATUS_LABEL: Record<RsvpStatus, string> = {
  GOING: 'Going',
  MAYBE: 'Maybe',
  CANT: "Can't",
  WAITLIST: 'Waitlist',
};

function statusColor(status: RsvpStatus) {
  if (status === 'GOING') return rsvp.going;
  if (status === 'MAYBE') return rsvp.maybe;
  if (status === 'CANT') return rsvp.no;
  return rsvp.waitlist;
}

export function EventRsvpPanel({
  event,
  userId,
  onChange,
}: {
  event: EventDetail;
  userId: string;
  onChange: (event: EventDetail) => void;
}) {
  const [busy, setBusy] = useState<RsvpStatus | null>(null);
  const [plusOneOpen, setPlusOneOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [plusOneBusy, setPlusOneBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState<string | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [linkedBusy, setLinkedBusy] = useState<string | null>(null);
  // "Apply to join" flow: answers line up with the event's questions.
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyAnswers, setApplyAnswers] = useState<string[]>([]);
  const [applyBusy, setApplyBusy] = useState(false);
  const [decideBusy, setDecideBusy] = useState<string | null>(null);

  const mine = event.rsvps.find((entry) => entry.user.id === userId);
  const spotsLeft =
    event.maxGuests == null ? null : Math.max(0, event.maxGuests - event.counts.going);
  const groups = useMemo(
    () => ({
      going: event.rsvps.filter((entry) => entry.status === 'GOING'),
      maybe: event.rsvps.filter((entry) => entry.status === 'MAYBE'),
      waitlist: event.rsvps.filter((entry) => entry.status === 'WAITLIST'),
      cant: event.rsvps.filter((entry) => entry.status === 'CANT'),
    }),
    [event.rsvps]
  );
  const socialCandidates = useMemo(() => {
    const byId = new Map<string, PublicUser>();
    for (const friend of profile?.friends ?? []) byId.set(friend.user.id, friend.user);
    for (const mutual of profile?.mutuals ?? []) byId.set(mutual.user.id, mutual.user);
    const used = new Set(mine?.guests.map((guest) => guest.userId).filter(Boolean) ?? []);
    return [...byId.values()].filter(
      (person) =>
        person.id !== userId &&
        !used.has(person.id) &&
        !event.rsvps.some(
          (entry) => entry.user.id === person.id && entry.status !== 'CANT'
        )
    );
  }, [profile, mine?.guests, userId, event.rsvps]);

  useEffect(() => {
    if (!plusOneOpen || profile) return;
    api
      .myProfile()
      .then((res) => setProfile(res.profile))
      .catch(() => setProfile(null));
  }, [plusOneOpen, profile]);

  async function respond(status: 'GOING' | 'MAYBE' | 'CANT') {
    if (busy || !event.rsvpsOpen) return;
    setBusy(status);
    try {
      const res = await api.rsvp(event.id, status);
      onChange(res.event);
    } catch (e) {
      notify('Could not RSVP', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  }

  async function addGuest() {
    if (plusOneBusy || guestName.trim().length < 2 || guestPhone.trim().length < 5) return;
    setPlusOneBusy(true);
    try {
      const res = await api.addPlusOne(event.id, {
        name: guestName.trim(),
        phone: guestPhone.trim(),
      });
      onChange(res.event);
      setGuestName('');
      setGuestPhone('');
      setPlusOneOpen(false);
    } catch (e) {
      notify('Could not add guest', e instanceof Error ? e.message : 'Try again');
    } finally {
      setPlusOneBusy(false);
    }
  }

  async function addLinkedGuest(person: PublicUser) {
    if (linkedBusy || plusOneBusy) return;
    setLinkedBusy(person.id);
    try {
      const res = await api.addPlusOne(event.id, { userId: person.id });
      onChange(res.event);
      setPlusOneOpen(false);
    } catch (e) {
      notify('Could not add guest', e instanceof Error ? e.message : 'Try again');
    } finally {
      setLinkedBusy(null);
    }
  }

  const applicationQuestions = event.applicationQuestions.length
    ? event.applicationQuestions
    : [APPLICATION_DEFAULT_QUESTION];

  function openApplyForm() {
    setApplyAnswers(applicationQuestions.map(() => ''));
    setApplyOpen(true);
  }

  async function submitApplication() {
    if (applyBusy) return;
    const answers = applyAnswers.map((answer) => answer.trim());
    if (answers.some((answer) => !answer)) {
      notify('Almost there', 'Please answer every question so the host can decide.');
      return;
    }
    setApplyBusy(true);
    try {
      const res = await api.applyToEvent(event.id, answers);
      onChange(res.event);
      setApplyOpen(false);
    } catch (e) {
      notify('Could not send application', e instanceof Error ? e.message : 'Try again');
    } finally {
      setApplyBusy(false);
    }
  }

  async function decideApplication(applicationId: string, decision: 'approve' | 'decline') {
    if (decideBusy) return;
    setDecideBusy(applicationId);
    try {
      const res =
        decision === 'approve'
          ? await api.approveApplication(event.id, applicationId)
          : await api.declineApplication(event.id, applicationId);
      onChange(res.event);
    } catch (e) {
      notify('Could not update application', e instanceof Error ? e.message : 'Try again');
    } finally {
      setDecideBusy(null);
    }
  }

  async function removeAttendee(targetUserId: string, name: string) {
    if (removeBusy) return;
    const ok = await confirmDialog(
      'Remove from guest list?',
      `${name} and their plus-ones will lose their spots.`,
      'Remove'
    );
    if (!ok) return;
    setRemoveBusy(targetUserId);
    try {
      const res = await api.removeGuest(event.id, targetUserId);
      onChange(res.event);
    } catch (e) {
      notify('Could not remove guest', e instanceof Error ? e.message : 'Try again');
    } finally {
      setRemoveBusy(null);
    }
  }

  if (event.canManage) {
    const pendingApplications = event.applications.filter(
      (application) => application.status === 'PENDING'
    );
    return (
      <View style={styles.panel}>
        <View style={styles.headingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>HOST VIEW</Text>
            <Text style={styles.title}>Guest list</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countStrong}>{event.counts.going}</Text>
            <Text style={styles.countSoft}>
              {event.maxGuests == null ? ' going' : ` / ${event.maxGuests}`}
            </Text>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{event.counts.going}</Text>
            <Text style={styles.statLabel}>Going</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{event.counts.maybe}</Text>
            <Text style={styles.statLabel}>Maybe</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{event.counts.waitlist}</Text>
            <Text style={styles.statLabel}>Waitlist</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{spotsLeft == null ? '∞' : spotsLeft}</Text>
            <Text style={styles.statLabel}>Left</Text>
          </View>
        </View>

        {event.applicationRequired ? (
          <View style={styles.applicationsArea}>
            <Text style={styles.pickerLabel}>
              {pendingApplications.length
                ? `APPLICATIONS · ${pendingApplications.length} WAITING`
                : 'APPLICATIONS'}
            </Text>
            {pendingApplications.length === 0 ? (
              <Text style={styles.body}>
                No open applications right now. New requests show up here for you to approve.
              </Text>
            ) : (
              pendingApplications.map((application) => (
                <View key={application.id} style={styles.applicationCard}>
                  <View style={styles.applicationHeader}>
                    <Avatar
                      name={application.user.name}
                      image={application.user.avatarImage}
                      size={34}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.guestName}>{application.user.name}</Text>
                      <Text style={styles.guestMeta}>wants to join</Text>
                    </View>
                  </View>
                  {application.answers.map((entry) => (
                    <View key={entry.question} style={styles.applicationAnswer}>
                      <Text style={styles.applicationQuestion}>{entry.question}</Text>
                      <Text style={styles.applicationAnswerText}>{entry.answer}</Text>
                    </View>
                  ))}
                  <View style={styles.applicationActions}>
                    <Pressable
                      onPress={() => decideApplication(application.id, 'approve')}
                      disabled={Boolean(decideBusy)}
                      style={[styles.approveButton, decideBusy && styles.disabled]}
                    >
                      {decideBusy === application.id ? (
                        <ActivityIndicator size="small" color={colors.onInk} />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={16} color={colors.onInk} />
                          <Text style={styles.approveText}>Approve</Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => decideApplication(application.id, 'decline')}
                      disabled={Boolean(decideBusy)}
                      style={[styles.declineButton, decideBusy && styles.disabled]}
                    >
                      <Ionicons name="close" size={16} color={colors.text} />
                      <Text style={styles.declineText}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {event.rsvps.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={28} color={colors.muted} />
            <Text style={styles.emptyText}>No replies yet. Share the invite to start the list.</Text>
          </View>
        ) : (
          <View style={styles.guestList}>
            {[...groups.going, ...groups.waitlist, ...groups.maybe, ...groups.cant].map(
              (entry) => {
                const palette = statusColor(entry.status);
                return (
                  <View key={entry.user.id} style={styles.guestRow}>
                    <Avatar
                      name={entry.user.name}
                      image={entry.user.avatarImage}
                      size={38}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.guestName}>{entry.user.name}</Text>
                      <Text style={styles.guestMeta}>
                        {entry.guests.length
                          ? `+ ${entry.guests.map((guest) => guest.name).join(', ')}`
                          : 'No plus-one'}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: palette.bg }]}>
                      <Text style={[styles.statusText, { color: palette.text }]}>
                        {STATUS_LABEL[entry.status]}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => removeAttendee(entry.user.id, entry.user.name)}
                      disabled={removeBusy === entry.user.id}
                      hitSlop={8}
                      style={styles.removeButton}
                    >
                      {removeBusy === entry.user.id ? (
                        <ActivityIndicator size="small" color={colors.muted} />
                      ) : (
                        <Ionicons name="close" size={16} color={colors.muted} />
                      )}
                    </Pressable>
                  </View>
                );
              }
            )}
          </View>
        )}
      </View>
    );
  }

  // External ticket listings keep their checkout-first flow. Event Studio
  // invites (no provider ticket URL) use the full social RSVP experience.
  if (event.ticketUrl) return null;

  const canAddPlusOne =
    mine?.status === 'GOING' &&
    mine.guests.length < event.plusOneLimit &&
    (spotsLeft == null || spotsLeft > 0);

  // Application-gated events replace the direct "I'm in" with an apply flow
  // until the viewer holds a spot (approval writes the GOING/WAITLIST rsvp).
  const needsApplication =
    event.applicationRequired && mine?.status !== 'GOING' && mine?.status !== 'WAITLIST';
  const myApplication = event.myApplication;
  const visibleChoices = needsApplication
    ? CHOICES.filter((choice) => choice.status !== 'GOING')
    : CHOICES;

  return (
    <View style={styles.panel}>
      <Text style={styles.kicker}>YOUR RSVP</Text>
      <Text style={styles.title}>
        {needsApplication
          ? myApplication?.status === 'PENDING'
            ? 'Application sent'
            : 'Apply for a spot'
          : mine?.status === 'WAITLIST'
            ? "You're on the waitlist"
            : mine?.status === 'GOING'
              ? "You're on the list"
              : 'Are you in?'}
      </Text>
      <Text style={styles.body}>
        {needsApplication
          ? !event.rsvpsOpen
            ? 'RSVPs are closed.'
            : myApplication?.status === 'PENDING'
              ? 'The host reviews every request. You are on the list the moment they approve.'
              : myApplication?.status === 'DECLINED'
                ? 'The host passed this time. You can send a new application whenever you like.'
                : 'The host picks who comes. Answer a quick question or two and you are in the running.'
          : !event.rsvpsOpen
            ? 'RSVPs are closed.'
            : mine?.status === 'WAITLIST'
              ? "It's full right now. We'll move you in automatically if a spot opens."
              : spotsLeft === 0 && mine?.status !== 'GOING'
                ? 'The event is full. Join the waitlist anyway.'
                : spotsLeft == null
                  ? 'Let the host know. Your response updates the guest list instantly.'
                  : `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left.`}
      </Text>

      {needsApplication && myApplication?.status !== 'PENDING' ? (
        applyOpen ? (
          <View style={styles.applyForm}>
            {applicationQuestions.map((question, index) => (
              <View key={question} style={styles.applyField}>
                <Text style={styles.applyQuestionLabel}>{question}</Text>
                <TextInput
                  value={applyAnswers[index] ?? ''}
                  onChangeText={(next) =>
                    setApplyAnswers((current) =>
                      current.map((answer, i) => (i === index ? next : answer))
                    )
                  }
                  placeholder="Your answer…"
                  placeholderTextColor={colors.muted}
                  multiline
                  maxLength={APPLICATION_LIMITS.answer}
                  style={styles.applyInput}
                />
              </View>
            ))}
            <Pressable
              onPress={submitApplication}
              disabled={applyBusy}
              style={[styles.saveGuest, applyBusy && styles.disabled]}
            >
              {applyBusy ? (
                <ActivityIndicator color={colors.onInk} />
              ) : (
                <Text style={styles.saveGuestText}>Send application</Text>
              )}
            </Pressable>
            <Pressable onPress={() => setApplyOpen(false)} style={styles.applyCancel}>
              <Text style={styles.applyCancelText}>Not now</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={openApplyForm}
            disabled={!event.rsvpsOpen}
            style={[styles.saveGuest, !event.rsvpsOpen && styles.disabled]}
          >
            <Ionicons name="clipboard-outline" size={17} color={colors.onInk} />
            <Text style={styles.saveGuestText}>
              {myApplication?.status === 'DECLINED' ? 'Apply again' : 'Apply to join'}
            </Text>
          </Pressable>
        )
      ) : null}

      <View style={styles.choices}>
        {visibleChoices.map((choice) => {
          const selected = mine?.status === choice.status;
          return (
            <Pressable
              key={choice.status}
              onPress={() => respond(choice.status)}
              disabled={Boolean(busy) || !event.rsvpsOpen}
              style={[styles.choice, selected && styles.choiceSelected]}
            >
              {busy === choice.status ? (
                <ActivityIndicator size="small" color={selected ? colors.onInk : colors.text} />
              ) : (
                <Ionicons
                  name={choice.icon}
                  size={19}
                  color={selected ? colors.onInk : colors.text}
                />
              )}
              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                {choice.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mine?.status === 'GOING' && event.plusOneLimit > 0 ? (
        <View style={styles.plusOneArea}>
          <View style={styles.plusOneHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.controlTitle}>Your people</Text>
              <Text style={styles.controlHint}>
                {mine.guests.length} of {event.plusOneLimit} plus-one spots used
              </Text>
            </View>
            {canAddPlusOne ? (
              <Pressable
                onPress={() => setPlusOneOpen((open) => !open)}
                style={styles.addGuestButton}
              >
                <Ionicons name={plusOneOpen ? 'close' : 'add'} size={17} color={colors.onInk} />
                <Text style={styles.addGuestText}>{plusOneOpen ? 'Cancel' : 'Add guest'}</Text>
              </Pressable>
            ) : null}
          </View>
          {mine.guests.map((guest) => (
            <View key={guest.id} style={styles.myGuest}>
              <Avatar name={guest.name} image={guest.avatarImage} size={32} />
              <Text style={styles.guestName}>{guest.name}</Text>
            </View>
          ))}
          {plusOneOpen ? (
            <View style={styles.plusOneForm}>
              {profile == null ? (
                <ActivityIndicator color={colors.accent} />
              ) : socialCandidates.length ? (
                <View style={styles.socialPicker}>
                  <Text style={styles.pickerLabel}>ADD A FRIEND OR MUTUAL</Text>
                  {socialCandidates.slice(0, 8).map((person) => (
                    <Pressable
                      key={person.id}
                      onPress={() => addLinkedGuest(person)}
                      disabled={Boolean(linkedBusy)}
                      style={styles.socialPerson}
                    >
                      <Avatar name={person.name} image={person.avatarImage} size={34} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.guestName}>{person.name}</Text>
                        <Text style={styles.handle}>@{person.username}</Text>
                      </View>
                      {linkedBusy === person.id ? (
                        <ActivityIndicator size="small" color={colors.text} />
                      ) : (
                        <Ionicons name="add-circle-outline" size={22} color={colors.text} />
                      )}
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Text style={styles.pickerLabel}>
                {socialCandidates.length ? 'OR INVITE BY PHONE' : 'INVITE BY PHONE'}
              </Text>
              <TextInput
                value={guestName}
                onChangeText={setGuestName}
                placeholder="Guest's name"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <TextInput
                value={guestPhone}
                onChangeText={setGuestPhone}
                placeholder="Phone number"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                style={styles.input}
              />
              <Pressable
                onPress={addGuest}
                disabled={
                  plusOneBusy || guestName.trim().length < 2 || guestPhone.trim().length < 5
                }
                style={[
                  styles.saveGuest,
                  (guestName.trim().length < 2 || guestPhone.trim().length < 5) &&
                    styles.disabled,
                ]}
              >
                {plusOneBusy ? (
                  <ActivityIndicator color={colors.onInk} />
                ) : (
                  <Text style={styles.saveGuestText}>Save plus-one</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  kicker: { ...uiText(10, '700', { tracking: 0.12 }), color: colors.muted },
  title: { ...display(24), color: colors.text },
  body: { ...uiText(13), color: colors.muted },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.inputBg,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  countStrong: { ...uiText(16, '800'), color: colors.text },
  countSoft: { ...uiText(12, '600'), color: colors.muted },
  stats: { flexDirection: 'row', gap: 6 },
  stat: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingVertical: 9,
    alignItems: 'center',
  },
  statValue: { ...uiText(17, '800'), color: colors.text },
  statLabel: { ...uiText(10, '600'), color: colors.muted },
  empty: { alignItems: 'center', gap: 6, paddingVertical: spacing.lg },
  emptyText: { ...uiText(13), color: colors.muted, textAlign: 'center' },
  guestList: { gap: 5 },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    paddingTop: 6,
  },
  guestName: { ...uiText(14, '700'), color: colors.text, flex: 1 },
  guestMeta: { ...uiText(11), color: colors.muted },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { ...uiText(10, '700') },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choices: { flexDirection: 'row', gap: 6, marginTop: 4 },
  choice: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  choiceSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  choiceText: { ...uiText(12, '700'), color: colors.text },
  choiceTextSelected: { color: colors.onInk },
  plusOneArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    paddingTop: spacing.md,
    marginTop: 4,
    gap: spacing.sm,
  },
  plusOneHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  controlTitle: { ...uiText(14, '700'), color: colors.text },
  controlHint: { ...uiText(11), color: colors.muted },
  addGuestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  addGuestText: { ...uiText(11, '700'), color: colors.onInk },
  myGuest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  plusOneForm: { gap: spacing.sm },
  socialPicker: { gap: 5 },
  pickerLabel: {
    ...uiText(10, '700', { tracking: 0.1 }),
    color: colors.muted,
  },
  socialPerson: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  handle: { ...uiText(11), color: colors.muted },
  input: {
    ...uiText(14),
    color: colors.text,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  saveGuest: {
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    flexDirection: 'row',
    gap: 6,
  },
  saveGuestText: { ...uiText(13, '700'), color: colors.onInk },
  disabled: { opacity: 0.4 },
  // ── Applications (host review + guest apply form) ──
  applicationsArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  applicationCard: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  applicationHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  applicationAnswer: { gap: 2 },
  applicationQuestion: { ...uiText(11, '700'), color: colors.muted },
  applicationAnswerText: { ...uiText(13, '500', { lineHeight: 1.4 }), color: colors.text },
  applicationActions: { flexDirection: 'row', gap: spacing.sm },
  approveButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  approveText: { ...uiText(12, '700'), color: colors.onInk },
  declineButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  declineText: { ...uiText(12, '700'), color: colors.text },
  applyForm: { gap: spacing.sm },
  applyField: { gap: 5 },
  applyQuestionLabel: { ...uiText(12, '700'), color: colors.text },
  applyInput: {
    ...uiText(14, '400', { lineHeight: 1.4 }),
    color: colors.text,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 74,
    textAlignVertical: 'top',
  },
  applyCancel: { alignSelf: 'center', paddingVertical: 2 },
  applyCancelText: { ...uiText(12, '600'), color: colors.muted },
});
