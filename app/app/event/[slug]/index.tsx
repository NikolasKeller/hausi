import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { type EventDetail } from '../../../shared/types';
import { api, mediaUrl } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { confirmDialog, notify } from '../../../lib/dialogs';
import { recordRecentEvent, removeRecentEvent } from '../../../lib/recents';
import { shareText } from '../../../lib/share';
import { coverFor } from '../../../lib/covers';
import { colors, radius, spacing } from '../../../lib/theme';
import { thinDisplay, XLIGHT_ITALIC, kicker, uiText } from '../../../lib/fonts';
import { RichDescription } from '../../../components/RichDescription';
import { GlassSurface } from '../../../components/GlassSurface';
import { Avatar } from '../../../components/Avatar';
import { Button } from '../../../components/ui';
import { formatEventDate, formatEventTime } from '../../../components/EventCard';

// Scraped events carry their source/ticket link at the end of the description.
// Pull the LAST https URL out; when it sits at the very end of the text it's
// also stripped from the displayed copy (the Buy-ticket button replaces it).
function ticketInfo(description: string): { url: string | null; text: string } {
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

// ── Designshot primitives ─────────────────────────────────────────────────────
// Decorative dotted arc under the hero title (from designshot.tsx).
function DottedArc({ count = 18 }: { count?: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              opacity: 0.85 - i * 0.035,
              transform: [{ translateY: Math.pow(i - 3, 2) * 0.05 }],
            },
          ]}
        />
      ))}
    </View>
  );
}

// Thin tick progress ring for the going-count card.
function MiniRing({ size, progress = 0.65 }: { size: number; progress?: number }) {
  const ticks = 40;
  const r = size / 2;
  const items = [];
  for (let i = 0; i < ticks; i++) {
    const angle = (i * 360) / ticks;
    const on = i / ticks <= progress;
    items.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          left: r - 0.8,
          top: r - 1.75,
          width: 1.6,
          height: 3.5,
          borderRadius: 1,
          backgroundColor: on ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
          transform: [{ rotate: `${angle}deg` }, { translateY: -r + 2 }],
        }}
      />
    );
  }
  return <View style={{ width: size, height: size }}>{items}</View>;
}

// Full-bleed blurred cover — the foggy atmospheric canvas from designshot.
function AtmosphericBackground({
  theme,
  image,
  children,
}: {
  theme: string;
  image?: string | null;
  children?: React.ReactNode;
}) {
  const cover = coverFor(theme);
  const uri = mediaUrl(image);
  const webBlur =
    Platform.OS === 'web'
      ? ({
          filter: 'blur(42px) saturate(130%)',
          transform: [{ scale: 1.12 }],
        } as object)
      : null;
  return (
    <View style={styles.atmoFill}>
      {uri ? (
        <Image
          source={{ uri }}
          blurRadius={Platform.OS === 'ios' ? 42 : 0}
          style={[StyleSheet.absoluteFill, webBlur]}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={cover.colors}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[StyleSheet.absoluteFill, styles.atmoVeil]} pointerEvents="none" />
      <LinearGradient
        colors={['rgba(30,45,60,0.30)', 'rgba(11,12,16,0.15)', 'rgba(11,12,16,0.72)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
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

  // Designshot palette — fixed white-on-fog, independent of per-event theme.
  const ink = {
    text: '#FFFFFF',
    subtext: 'rgba(255,255,255,0.75)',
    faint: 'rgba(255,255,255,0.55)',
    hairline: 'rgba(255,255,255,0.18)',
    dark: true,
  };

  const spotsLeft =
    event.maxGuests != null ? Math.max(0, event.maxGuests - event.counts.going) : null;
  // Tickets are sold at the source: the last https URL in the description is
  // the ticket/source link, surfaced as the big Buy-ticket button below.
  const ticket = ticketInfo(event.description);
  // Buying once marks the event as GOING, so it shows up under Profile →
  // "My events" and on the calendar.
  const hasTicket = event.rsvps.some(
    (r) => r.user.id === user?.id && (r.status === 'GOING' || r.status === 'WAITLIST')
  );
  // Host "text blasts" surface in their own Announcements section (newest first).
  const blasts = event.comments.filter((c) => c.type === 'blast');

  const goingProgress = event.maxGuests
    ? Math.min(1, event.counts.going / event.maxGuests)
    : Math.min(1, event.counts.going / 50);

  return (
    <AtmosphericBackground theme={event.coverTheme} image={event.coverImage}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, { paddingTop: insets.top + 56 }]}>
            <GlassSurface
              radius={999}
              blur={18}
              fill="rgba(255,255,255,0.10)"
              borderColor="rgba(255,255,255,0.30)"
              shadow={false}
              style={styles.datePill}
            >
              <Text style={styles.datePillText}>
                {formatEventDate(event.date)} · {formatEventTime(event.date)}
              </Text>
            </GlassSurface>

            <Text style={styles.heroKicker}>Hosted by {event.host.name}</Text>
            <Text style={[styles.heroTitle, thinDisplay(56)]} numberOfLines={3}>
              {event.title}
            </Text>
            {event.location ? (
              <Text style={styles.heroCaption}>
                {event.location}
                {event.city ? `, ${event.city}` : ''}
              </Text>
            ) : null}
            <DottedArc />
          </View>

          <View style={styles.section}>
            {event.myCohostInvite ? (
              <GlassSurface radius={30} blur={26} style={styles.inviteBanner}>
                <Text style={[styles.inviteKicker, { color: ink.faint }]}>Co-host invite</Text>
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
                      variant="chrome"
                      onPress={acceptCohostInvite}
                      loading={inviteBusy}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Decline"
                      variant="ghost"
                      tone="paper"
                      onPress={declineCohostInvite}
                      disabled={inviteBusy}
                    />
                  </View>
                </View>
              </GlassSurface>
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
                <GlassSurface
                  radius={999}
                  blur={18}
                  fill="rgba(255,255,255,0.10)"
                  borderColor="rgba(255,255,255,0.30)"
                  style={styles.shareButton}
                >
                  <Ionicons name="share-outline" size={14} color={ink.text} />
                  <Text style={[styles.shareText, { color: ink.text }]}>Share</Text>
                </GlassSurface>
              </Pressable>
            </View>

            <View style={styles.cardRow}>
              <GlassSurface radius={30} blur={26} style={styles.metaCard}>
                <View style={styles.cardIconCircle}>
                  <Ionicons name="calendar-outline" size={18} color="#0B0C10" />
                </View>
                <Text style={styles.cardTitle}>Event details</Text>
                {event.location ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={14} color={ink.subtext} style={styles.metaIcon} />
                    <Text style={[styles.metaLine, { color: ink.text }]}>
                      {event.location}
                      {event.city ? `, ${event.city}` : ''}
                    </Text>
                  </View>
                ) : null}
                {event.costPerPerson ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="cash-outline" size={14} color={ink.subtext} style={styles.metaIcon} />
                    <Text style={[styles.metaLine, { color: ink.text }]}>{event.costPerPerson}</Text>
                  </View>
                ) : null}
                {event.dressCode ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="shirt-outline" size={14} color={ink.subtext} style={styles.metaIcon} />
                    <Text style={[styles.metaLine, { color: ink.text }]}>{event.dressCode}</Text>
                  </View>
                ) : null}
                {spotsLeft != null ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="ticket-outline" size={14} color={ink.subtext} style={styles.metaIcon} />
                    <Text style={[styles.metaLine, { color: ink.text }]}>
                      {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Event is full'}
                    </Text>
                  </View>
                ) : null}
              </GlassSurface>

              <GlassSurface radius={30} blur={26} style={styles.goingCard}>
                <Text style={styles.cardTitle}>Going</Text>
                <View style={styles.scoreRow}>
                  <Text style={[styles.scoreValue, thinDisplay(56)]}>{event.counts.going}</Text>
                  <MiniRing size={38} progress={goingProgress} />
                </View>
              </GlassSurface>
            </View>

            {ticket.text ? (
              <RichDescription
                text={ticket.text}
                scale={event.descriptionScale}
                color={ink.text}
              />
            ) : null}

            {blasts.length ? (
              <View style={styles.announceSection}>
                <Text style={[styles.kickerLabel, { color: ink.faint }]}>From your host</Text>
                <Text style={[styles.sectionTitle, thinDisplay(34)]}>Announcements</Text>
                {[...blasts].reverse().map((b) => (
                  <GlassSurface key={b.id} radius={30} blur={26} style={styles.announceCard}>
                    <View style={styles.announceHead}>
                      <Ionicons name="megaphone" size={15} color={ink.subtext} />
                      <Text style={[styles.announceAuthor, { color: ink.subtext }]}>{b.user.name}</Text>
                    </View>
                    <Text style={[styles.announceText, { color: ink.text }]}>{b.text}</Text>
                  </GlassSurface>
                ))}
              </View>
            ) : null}

            {ticket.url ? (
              <Pressable
                onPress={() => {
                  if (!hasTicket && !event.isHost) {
                    api
                      .rsvp(event.id, 'GOING')
                      .then((res) => setEvent(res.event))
                      .catch(() => {});
                  }
                  if (Platform.OS === 'web') {
                    (globalThis as any).window?.open(ticket.url!, '_blank');
                  } else {
                    Linking.openURL(ticket.url!).catch(() =>
                      notify('Could not open link', ticket.url!)
                    );
                  }
                }}
                style={({ pressed }) => [pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
              >
                <View style={styles.buyButtonWhite}>
                  <Ionicons
                    name={hasTicket ? 'checkmark-circle' : 'ticket-outline'}
                    size={22}
                    color="#0B0C10"
                  />
                  <Text style={styles.buyButtonWhiteText}>
                    {hasTicket ? 'Ticket purchased' : 'Buy ticket'}
                  </Text>
                </View>
              </Pressable>
            ) : null}

          </View>
        </ScrollView>

      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={10}
        style={[styles.backFab, { top: insets.top + spacing.sm }]}
      >
        <GlassSurface
          radius={999}
          blur={18}
          fill="rgba(255,255,255,0.10)"
          borderColor="rgba(255,255,255,0.30)"
          shadow={false}
          style={styles.fabInner}
        >
          <Ionicons name="chevron-back" size={24} color={ink.text} />
        </GlassSurface>
      </Pressable>

      <View
        pointerEvents="box-none"
        style={[styles.actionBarWrap, { paddingBottom: insets.bottom + spacing.sm }]}
      >
        <GlassSurface radius={999} blur={26} fill="rgba(255,255,255,0.12)" style={styles.actionBar}>
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

          <View style={styles.barGoing}>
            <Text style={[styles.barGoingCount, thinDisplay(18)]}>{event.counts.going}</Text>
            <Text style={[styles.barLabel, { color: ink.text }]}>Going</Text>
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
        </GlassSurface>
      </View>

      {menuOpen ? (
        <View style={styles.menuOverlay}>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.menuBackdrop]}
            onPress={() => setMenuOpen(false)}
          />
          <View style={[styles.menuSheetWrap, { paddingBottom: insets.bottom + spacing.lg }]}>
            <GlassSurface radius={30} blur={26} style={styles.menuSheet}>
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
            </GlassSurface>
          </View>
        </View>
      ) : null}
    </AtmosphericBackground>
  );
}

const styles = StyleSheet.create({
  atmoFill: {
    flex: 1,
    backgroundColor: '#0B0C10',
    overflow: 'hidden',
  },
  atmoVeil: {
    backgroundColor: 'rgba(11,12,16,0.50)',
  },
  center: {
    flex: 1,
    backgroundColor: '#0B0C10',
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
    gap: 3,
    minWidth: 50,
    paddingVertical: 6,
  },
  barGoingCount: {
    color: '#FFFFFF',
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    justifyContent: 'flex-end',
  },
  menuBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
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
  hero: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  datePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: spacing.sm,
  },
  datePillText: {
    color: 'rgba(255,255,255,0.95)',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(30,45,60,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.95)',
    fontFamily: XLIGHT_ITALIC,
    fontSize: 14,
    letterSpacing: 0.3,
    marginLeft: 6,
    textShadowColor: 'rgba(30,45,60,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  heroTitle: {
    color: '#FFFFFF',
    marginLeft: 4,
  },
  heroCaption: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    marginLeft: 6,
    textShadowColor: 'rgba(30,45,60,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 10,
    marginLeft: 6,
  },
  dot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  section: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  inviteBanner: {
    padding: spacing.lg,
    gap: spacing.xs,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  shareText: {
    ...uiText(14, '600'),
  },
  cardRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'stretch',
  },
  metaCard: {
    flex: 1.15,
    padding: 18,
    minHeight: 180,
  },
  goingCard: {
    flex: 0.85,
    padding: 18,
    minHeight: 180,
    justifyContent: 'space-between',
  },
  cardIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    color: 'rgba(255,255,255,0.92)',
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  scoreValue: {
    color: '#FFFFFF',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaIcon: {
    width: 20,
  },
  metaLine: {
    flex: 1,
    ...uiText(13, '500'),
  },
  announceSection: {
    gap: spacing.sm,
  },
  announceCard: {
    padding: spacing.lg,
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
  sectionTitle: {
    color: '#FFFFFF',
  },
  buyButtonWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  buyButtonWhiteText: {
    ...uiText(17, '700'),
    color: '#0B0C10',
  },
});
