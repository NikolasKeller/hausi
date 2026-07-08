import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import {
  type EventDetail,
  type TicketJobInfo,
  type TicketProvider,
  type WalletIdentity,
  type WalletPayment,
} from '../../../shared/types';
import { api, mediaUrl } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { confirmDialog, notify } from '../../../lib/dialogs';
import { recordRecentEvent, removeRecentEvent } from '../../../lib/recents';
import { shareText } from '../../../lib/share';
import { colors, light, radius, spacing } from '../../../lib/theme';
import { titleFontStyle, display, kicker, uiText } from '../../../lib/fonts';
import { CoverGradient } from '../../../components/CoverGradient';
import { RichDescription } from '../../../components/RichDescription';
import { ThemeBackground } from '../../../components/themes';
import { Glass } from '../../../components/glass';
import { Avatar } from '../../../components/Avatar';
import { AgentWalletSheet } from '../../../components/AgentWalletSheet';
import { Button } from '../../../components/ui';
import { formatEventDate, formatEventTime } from '../../../components/EventCard';

// The buy-ticket link comes from the event's ticketUrl field (the organiser's
// real paid-ticket page). Older scraped events instead carried the link as the
// last URL in the description; for those we fall back to extracting it and
// stripping it from the displayed copy so the button still works and no raw URL
// shows.
function ticketInfo(description: string, ticketUrl?: string): { url: string | null; text: string } {
  if (ticketUrl) return { url: ticketUrl, text: description };
  const matches = description.match(/https:\/\/[^\s]+/g);
  if (!matches || matches.length === 0) return { url: null, text: description };
  const url = matches[matches.length - 1];
  const idx = description.lastIndexOf(url);
  let text = description;
  if (description.slice(idx + url.length).trim() === '') {
    text = description.slice(0, idx).replace(/[\s:·\-–—]+$/, '');
  }
  return { url, text };
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  // Agentic ticket purchase: the wallet sheet collects the user's details,
  // then a server-side agent buys the ticket; `job` tracks its progress.
  const [walletOpen, setWalletOpen] = useState(false);
  const [job, setJob] = useState<TicketJobInfo | null>(null);

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

  // My latest purchase job for this event (agent status survives leaving the
  // page — the newest job wins, done or not).
  useEffect(() => {
    if (!event) return;
    let active = true;
    api
      .myTickets()
      .then((res) => {
        if (!active) return;
        const mine = res.jobs.find((j) => j.eventId === event.id);
        if (mine) setJob(mine);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  // While a phase is running server-side (availability check or purchase),
  // poll the job until it settles into a state that needs the user again.
  useEffect(() => {
    if (!job || (job.status !== 'checking' && job.status !== 'purchasing')) return;
    const timer = setInterval(() => {
      api
        .ticketJob(job.id)
        .then((res) => setJob(res.job))
        .catch(() => {});
    }, 2500);
    return () => clearInterval(timer);
  }, [job?.id, job?.status]);

  // Step 1+2: submit identity → server checks availability. The poll above
  // then advances the job to available / soldout / failed.
  async function startCheck(identity: WalletIdentity, provider: TicketProvider) {
    if (!event) return;
    const res = await api.checkTicketAvailability(event.id, identity, provider);
    setJob(res.job);
  }

  // Step 3+4: confirm payment on the available job → agent completes the buy.
  async function startPurchase(identity: WalletIdentity, payment: WalletPayment) {
    if (!job) return;
    const res = await api.purchaseTicket(job.id, identity, payment);
    setJob(res.job);
    // Buying files the event under Profile → "My events" (server sets the
    // GOING rsvp); refresh so the page reflects it right away. Best-effort.
    load().catch(() => {});
  }

  function openTicketPdf(pdfPath: string) {
    const url = mediaUrl(pdfPath);
    if (!url) return;
    if (Platform.OS === 'web') {
      (globalThis as any).window?.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => notify('Could not open ticket', url));
    }
  }

  async function share() {
    if (!event) return;
    const url = Linking.createURL(`e/${event.slug}`);
    const message = `You're invited: ${event.title} - ${formatEventDate(event.date)} at ${formatEventTime(event.date)}.\nOpen in iykyk: ${url}`;
    await shareText(message, url);
  }

  async function acceptCohostInvite() {
    if (!event?.myCohostInvite || inviteBusy) return;
    setInviteBusy(true);
    try {
      const res = await api.acceptCohostInvite(event.myCohostInvite.id);
      setEvent(res.event);
      notify("You're a co-host! 🤝", 'You can now edit the event and manage the guest list.');
    } catch (e) {
      notify('Could not accept', e instanceof Error ? e.message : 'Try again');
    } finally {
      setInviteBusy(false);
    }
  }

  async function declineCohostInvite() {
    if (!event?.myCohostInvite || inviteBusy) return;
    setInviteBusy(true);
    try {
      await api.declineCohostInvite(event.myCohostInvite.id);
      await load();
    } catch (e) {
      notify('Could not decline', e instanceof Error ? e.message : 'Try again');
    } finally {
      setInviteBusy(false);
    }
  }

  async function confirmCancel() {
    if (!event) return;
    const ok = await confirmDialog(
      'Cancel event?',
      'All guests will be notified and the event will be removed.',
      'Cancel event',
      'Keep event'
    );
    if (!ok) return;
    try {
      await api.cancelEvent(event.id);
      // Canceling hides the event everywhere, so leave the (now-gone) page and
      // prune the local "recently viewed" cache before the home screen refetches.
      await removeRecentEvent(event.slug);
      router.replace('/');
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

  // The page sits on the paper design background (see ThemeBackground), so all
  // content uses graphite ink on light glass.
  const ink = {
    dark: false,
    text: colors.text,
    subtext: light.text2,
    faint: light.text3,
    glassTint: 'light' as const,
    hairline: light.hairline,
  };

  const spotsLeft =
    event.maxGuests != null ? Math.max(0, event.maxGuests - event.counts.going) : null;
  // Tickets are sold at the source: the last https URL in the description is
  // the ticket/source link, surfaced as the big Buy-ticket button below.
  const ticket = ticketInfo(event.description, event.ticketUrl);
  // Buying once marks the event as GOING, so it shows up under Profile →
  // "My events" and on the calendar.
  const hasTicket = event.rsvps.some(
    (r) => r.user.id === user?.id && (r.status === 'GOING' || r.status === 'WAITLIST')
  );
  // Host "text blasts" surface in their own Announcements section (newest first).
  const blasts = event.comments.filter((c) => c.type === 'blast');

  return (
    <ThemeBackground theme={event.coverTheme} effect={event.effect}>
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
              />
              <Text
                style={[styles.heroTitleBelow, titleFontStyle(event.titleFont), { color: ink.text }]}
              >
                {event.title}
              </Text>
            </View>
          ) : (
            <View style={styles.heroBlock}>
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

          <View style={styles.section}>
            {event.myCohostInvite ? (
              <Glass tint={ink.glassTint} radius={radius.md} style={styles.inviteBanner}>
                <Text style={[styles.inviteKicker, { color: ink.subtext }]}>Co-host invite 🤝</Text>
                <Text style={[styles.inviteTitle, { color: ink.text }]}>
                  {event.myCohostInvite.invitedBy.name} invited you to co-host
                </Text>
                <Text style={[styles.inviteBody, { color: ink.subtext }]}>
                  Accept to help edit this event and manage the guest list.
                </Text>
                <View style={styles.inviteButtons}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Accept"
                      variant="primary"
                      onPress={acceptCohostInvite}
                      loading={inviteBusy}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Decline"
                      variant="ghost"
                      tone={ink.dark ? 'paper' : 'ink'}
                      onPress={declineCohostInvite}
                      disabled={inviteBusy}
                    />
                  </View>
                </View>
              </Glass>
            ) : null}

            <View style={styles.hostRow}>
              <Avatar name={event.host.name} image={event.host.avatarImage} size={44} />
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

            {ticket.text ? (
              <RichDescription
                text={ticket.text}
                scale={event.descriptionScale}
                color={ink.text}
              />
            ) : null}

            {/* Host announcements (text blasts) — prominent, above the guest list. */}
            {blasts.length ? (
              <View style={styles.announceSection}>
                <View style={styles.sectionHead}>
                  <Text style={[styles.kickerLabel, { color: ink.subtext }]}>From your host</Text>
                  <Text style={[styles.sectionTitle, { color: ink.text }]}>Announcements 📣</Text>
                </View>
                {[...blasts].reverse().map((b) => (
                  <Glass key={b.id} tint={ink.glassTint} radius={radius.md} style={styles.announceCard}>
                    <View style={styles.announceHead}>
                      <Ionicons name="megaphone" size={15} color={ink.subtext} />
                      <Text style={[styles.announceAuthor, { color: ink.subtext }]}>{b.user.name}</Text>
                    </View>
                    <Text style={[styles.announceText, { color: ink.text }]}>{b.text}</Text>
                  </Glass>
                ))}
              </View>
            ) : null}

            {/* Agentic ticket purchase — the button opens the Agent Wallet
                wizard (details → availability → payment → buy). The status here
                mirrors the real phase and never says "purchased" before the
                agent has a confirmed ticket. Hidden when the event has no
                ticket link (never a dead button). */}
            {ticket.url ? (
              <View style={styles.buySection}>
                {job?.status === 'done' ? (
                  <Pressable
                    onPress={() => openTicketPdf(job.pdfPath)}
                    style={({ pressed }) => [
                      styles.buyButton,
                      { backgroundColor: ink.dark ? '#FFFFFF' : '#171717' },
                      pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Ionicons
                      name="qr-code-outline"
                      size={20}
                      color={ink.dark ? '#171717' : '#FFFFFF'}
                    />
                    <Text
                      style={[styles.buyButtonText, { color: ink.dark ? '#171717' : '#FFFFFF' }]}
                    >
                      View ticket
                    </Text>
                  </Pressable>
                ) : job && (job.status === 'checking' || job.status === 'purchasing') ? (
                  <Pressable onPress={() => setWalletOpen(true)}>
                    <Glass tint={ink.glassTint} radius={radius.md} style={styles.agentStatus}>
                      <ActivityIndicator color={ink.text} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.agentStatusTitle, { color: ink.text }]}>
                          {job.status === 'checking'
                            ? 'Checking ticket availability…'
                            : 'Your agent is buying the ticket…'}
                        </Text>
                        <Text style={[styles.agentStatusBody, { color: ink.subtext }]}>
                          {job.status === 'checking'
                            ? 'Verifying tickets are still available. No payment yet.'
                            : 'Completing the checkout and confirming the order.'}
                        </Text>
                      </View>
                    </Glass>
                  </Pressable>
                ) : job?.status === 'available' ? (
                  <Pressable
                    onPress={() => setWalletOpen(true)}
                    style={({ pressed }) => [
                      styles.buyButton,
                      { backgroundColor: ink.dark ? '#FFFFFF' : '#171717' },
                      pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Ionicons
                      name="card-outline"
                      size={20}
                      color={ink.dark ? '#171717' : '#FFFFFF'}
                    />
                    <Text
                      style={[styles.buyButtonText, { color: ink.dark ? '#171717' : '#FFFFFF' }]}
                    >
                      Tickets available — continue
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setWalletOpen(true)}
                    style={({ pressed }) => [
                      styles.buyButton,
                      { backgroundColor: ink.dark ? '#FFFFFF' : '#171717' },
                      pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Ionicons
                      name={hasTicket ? 'checkmark-circle' : 'ticket-outline'}
                      size={20}
                      color={ink.dark ? '#171717' : '#FFFFFF'}
                    />
                    <Text
                      style={[styles.buyButtonText, { color: ink.dark ? '#171717' : '#FFFFFF' }]}
                    >
                      {job?.status === 'failed' || job?.status === 'soldout'
                        ? 'Try again'
                        : 'Buy ticket'}
                    </Text>
                  </Pressable>
                )}

                {job?.status === 'soldout' ? (
                  <Glass tint={ink.glassTint} radius={radius.md} style={styles.agentStatus}>
                    <Ionicons name="sad-outline" size={20} color={ink.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.agentStatusTitle, { color: ink.text }]}>Sold out</Text>
                      <Text style={[styles.agentStatusBody, { color: ink.subtext }]}>
                        {job.error || 'No tickets available for this event.'}
                      </Text>
                    </View>
                  </Glass>
                ) : null}

                {job?.status === 'failed' ? (
                  <Glass tint={ink.glassTint} radius={radius.md} style={styles.agentStatus}>
                    <Ionicons name="alert-circle-outline" size={20} color={ink.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.agentStatusTitle, { color: ink.text }]}>
                        The agent couldn't finish
                      </Text>
                      <Text style={[styles.agentStatusBody, { color: ink.subtext }]}>
                        {job.error || 'Unknown reason.'}
                      </Text>
                    </View>
                  </Glass>
                ) : null}

                {/* The source stays one tap away — buy manually if you prefer. */}
                <Pressable
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      (globalThis as any).window?.open(ticket.url!, '_blank');
                    } else {
                      Linking.openURL(ticket.url!).catch(() =>
                        notify('Could not open link', ticket.url!)
                      );
                    }
                  }}
                  hitSlop={6}
                >
                  <Text style={[styles.sourceLink, { color: ink.subtext }]}>
                    Open ticket page ↗
                  </Text>
                </Pressable>
              </View>
            ) : null}

          </View>
        </ScrollView>

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
            <BarItem
              icon="megaphone"
              label="Text Blast"
              color={ink.text}
              onPress={() => router.push(`/event/${event.slug}/blast`)}
            />
          ) : null}

          {/* Pure guest-count display — RSVPs are gone, tickets are bought at
              the source. */}
          <View style={styles.barGoing}>
            <Text style={styles.barGoingCount}>{event.counts.going}</Text>
            <Text style={styles.barGoingLabel}>Going</Text>
          </View>

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

      {walletOpen ? (
        <AgentWalletSheet
          mode="purchase"
          eventTitle={event.title}
          job={job}
          onClose={() => setWalletOpen(false)}
          onCheckAvailability={startCheck}
          onPurchase={startPurchase}
        />
      ) : null}

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
              {event.isHost ? (
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
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  barGoingCount: {
    ...uiText(18, '700'),
    color: '#111',
  },
  barGoingLabel: {
    ...uiText(10, '600'),
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
    aspectRatio: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  heroTitleBelow: {
    fontSize: 56,
    letterSpacing: -1,
    lineHeight: 56,
    marginTop: spacing.lg,
  },
  heroBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: 100,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  heroTitlePlain: {
    fontSize: 56,
    letterSpacing: -1,
    lineHeight: 56,
  },
  section: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  inviteBanner: {
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  inviteKicker: {
    ...kicker(),
  },
  inviteTitle: {
    ...uiText(18, '800'),
  },
  inviteBody: {
    ...uiText(14, '500'),
    marginBottom: spacing.xs,
  },
  inviteButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
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
    ...uiText(14, '600'),
  },
  metaCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  metaLine: {
    ...uiText(16, '500'),
  },
  sectionHead: {
    gap: spacing.xs,
  },
  announceSection: {
    gap: spacing.sm,
  },
  announceCard: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  announceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  announceAuthor: {
    ...uiText(13, '700'),
  },
  announceText: {
    ...uiText(16, '500', { lineHeight: 1.45 }),
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
  buySection: {
    gap: spacing.sm,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  buyButtonText: {
    ...uiText(17, '700'),
  },
  agentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  agentStatusTitle: {
    ...uiText(15, '700'),
  },
  agentStatusBody: {
    ...uiText(13, '500'),
    marginTop: 2,
  },
  sourceLink: {
    ...uiText(13, '600'),
    textAlign: 'center',
    textDecorationLine: 'underline',
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
    ...uiText(13, '600'),
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeGuestText: {
    fontSize: 12,
    fontWeight: '600',
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
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  sendText: {
    color: '#fff',
    ...uiText(15, '600'),
  },
});
