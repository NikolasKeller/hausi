import React, { useCallback, useState } from 'react';
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
import * as WebBrowser from 'expo-web-browser';
import { type EventDetail } from '../../../shared/types';
import { api } from '../../../lib/api';
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
import { Button } from '../../../components/ui';
import { formatEventDate, formatEventTime } from '../../../components/EventCard';

// The buy-ticket link comes from the event's ticketUrl field (the organiser's
// real paid-ticket page — used by both the Buy button and the purchase agent).
// Older scraped events instead carried the link as the last URL in the
// description; for those we fall back to extracting it and stripping it from
// the displayed copy so the button still works and no raw URL shows.
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

// Hero title sizing: comfortable for short names, one step smaller for long
// scraped titles so they wrap in ~1–3 lines instead of towering. The generous
// lineHeight (1.4×) leaves room for tall ascenders/apostrophes — the decorative
// faces (Pacifico/Bungee/Playfair) clip at tighter values ("YE's …").
function titleSizeStyle(title: string) {
  const size = title.length > 60 ? 24 : 28;
  return {
    fontSize: size,
    lineHeight: Math.round(size * 1.4),
    letterSpacing: -0.5,
    includeFontPadding: true as const,
  };
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
  // Ids of my accepted friends — intersected with the guest list client-side
  // so the "friends going" strip survives RSVP mutations without a refetch.
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

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
    // Best-effort — the page renders fine without the friends strip.
    try {
      const res = await api.myFriends();
      setFriendIds(new Set(res.friends.map((f) => f.user.id)));
    } catch {
      // keep whatever we had
    }
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Buying a ticket is a simple redirect to the event's own ticket/checkout
  // page — no in-app purchase. Opened in the in-app browser (SFSafariView):
  // plain Linking.openURL lets iOS intercept ra.co/eventbrite links as
  // universal links and bounce users into the App Store when the partner app
  // isn't installed. (The agentic purchase flow still lives in the repo, just
  // decoupled from this screen.)
  function openTicket(url: string) {
    if (Platform.OS === 'web') {
      (globalThis as any).window?.open(url, '_blank');
    } else {
      WebBrowser.openBrowserAsync(url).catch(() => notify('Could not open link', url));
    }
  }

  async function share() {
    if (!event) return;
    const url = Linking.createURL(`e/${event.slug}`);
    const message = `You're invited: ${event.title} - ${formatEventDate(event.date)} at ${formatEventTime(event.date)}.\nOpen in iykyk: ${url}`;
    await shareText(message, url);
  }

  // Favoriting is decoupled from tickets: it reuses the "interested" (MAYBE)
  // RSVP so the event shows up under Profile → Favorites (via api.myEvents).
  async function toggleFavorite() {
    if (!event || !user || favBusy) return;
    const next = !event.rsvps.some((r) => r.user.id === user.id && r.status === 'MAYBE');
    setFavBusy(true);
    try {
      const res = next
        ? await api.rsvp(event.id, 'MAYBE')
        : await api.removeGuest(event.id, user.id);
      setEvent(res.event);
    } catch (e) {
      notify('Could not update favorite', e instanceof Error ? e.message : 'Try again');
    } finally {
      setFavBusy(false);
    }
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

  // The page sits on the nightlife bokeh backdrop (see ThemeBackground), so
  // all content uses silver ink on dark glass.
  const ink = {
    dark: true,
    text: colors.text,
    subtext: light.text2,
    faint: light.text3,
    glassTint: 'dark' as const,
    hairline: light.hairline,
  };

  const spotsLeft =
    event.maxGuests != null ? Math.max(0, event.maxGuests - event.counts.going) : null;
  const isFavorite = event.rsvps.some((r) => r.user.id === user?.id && r.status === 'MAYBE');
  // Tickets are sold at the source: the ticketUrl field (or the last https URL
  // in the description) is the organiser's checkout page. The Buy-ticket button
  // simply opens it.
  const ticket = ticketInfo(event.description, event.ticketUrl);
  // Host "text blasts" surface in their own Announcements section (newest first).
  const blasts = event.comments.filter((c) => c.type === 'blast');
  // My friends on the guest list — GOING first, then MAYBE/WAITLIST.
  const friendsAttending = event.rsvps
    .filter((r) => r.status !== 'CANT' && r.user.id !== user?.id && friendIds.has(r.user.id))
    .sort((a, b) => (a.status === 'GOING' ? 0 : 1) - (b.status === 'GOING' ? 0 : 1));

  return (
    <ThemeBackground theme={event.coverTheme}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 108 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* The cover starts BELOW the back-button strip (insets.top + button
              height), so the floating chip sits on plain paper and never
              overlaps the image. Long scraped titles step down a size so they
              wrap in ~1–3 lines instead of towering. */}
          {event.coverImage ? (
            <View style={[styles.posterWrap, { paddingTop: insets.top + 56 }]}>
              <CoverGradient
                theme={event.coverTheme}
                image={event.coverImage}
                style={styles.poster}
              />
              <Text
                style={[
                  styles.heroTitleBelow,
                  titleFontStyle(event.titleFont),
                  titleSizeStyle(event.title),
                  { color: ink.text },
                ]}
              >
                {event.title}
              </Text>
            </View>
          ) : (
            <View style={[styles.heroBlock, { paddingTop: insets.top + 64 }]}>
              <Text
                style={[
                  styles.heroTitlePlain,
                  titleFontStyle(event.titleFont),
                  titleSizeStyle(event.title),
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
              <Pressable
                onPress={() => router.push(`/user/${event.host.id}`)}
                hitSlop={6}
                style={({ pressed }) => pressed && { opacity: 0.7 }}
              >
                <Avatar name={event.host.name} image={event.host.avatarImage} size={44} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.hostedBy, { color: ink.faint }]}>Hosted by</Text>
                <Text style={[styles.hostName, { color: ink.text }]}>
                  {event.isHost ? `${event.host.name} (you)` : event.host.name}
                  {event.cohosts.length
                    ? ` + ${event.cohosts.map((ch) => ch.name).join(', ')}`
                    : ''}
                </Text>
              </View>
              {user && !event.isHost ? (
                <Pressable
                  onPress={toggleFavorite}
                  disabled={favBusy}
                  hitSlop={8}
                  style={({ pressed }) => pressed && { opacity: 0.6 }}
                >
                  <Glass tint={ink.glassTint} radius={999} style={styles.favButton}>
                    <Ionicons
                      name={isFavorite ? 'heart' : 'heart-outline'}
                      size={20}
                      color={isFavorite ? colors.danger : ink.text}
                    />
                  </Glass>
                </Pressable>
              ) : null}
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

            {/* Friends on the guest list — the "will my people be there?" signal. */}
            {friendsAttending.length ? (
              <Glass tint={ink.glassTint} radius={radius.md} style={styles.friendsCard}>
                <Text style={[styles.friendsKicker, { color: ink.subtext }]}>
                  {friendsAttending.length === 1
                    ? 'A friend will be there'
                    : `${friendsAttending.length} friends will be there`}{' '}
                  🎉
                </Text>
                {friendsAttending.map((r) => (
                  <Pressable
                    key={r.user.id}
                    onPress={() => router.push(`/user/${r.user.id}`)}
                    style={({ pressed }) => [styles.friendRow, pressed && { opacity: 0.7 }]}
                  >
                    <Avatar name={r.user.name} image={r.user.avatarImage} size={34} />
                    <Text style={[styles.friendName, { color: ink.text }]} numberOfLines={1}>
                      {r.user.name}
                    </Text>
                    <Text style={[styles.friendStatus, { color: ink.subtext }]}>
                      {r.status === 'GOING'
                        ? 'going'
                        : r.status === 'MAYBE'
                          ? 'interested'
                          : 'waitlist'}
                    </Text>
                  </Pressable>
                ))}
              </Glass>
            ) : null}

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

      {/* Floating bottom action bar. Buying a ticket is the page's primary —
          and, for guests, only — action: a full-width Buy-ticket button that
          opens the event's own ticket/checkout page in the browser. Hidden when
          the event has no ticket link. Host-only management sits in a compact
          pill beside it. */}
      {ticket.url || event.canManage ? (
        <View
          pointerEvents="box-none"
          style={[styles.actionBarWrap, { paddingBottom: insets.bottom + spacing.sm }]}
        >
          <View style={styles.actionBarRow}>
            {ticket.url ? (
              <Pressable
                onPress={() => openTicket(ticket.url!)}
                style={({ pressed }) => [
                  styles.buyButton,
                  styles.buyButtonBar,
                  pressed && styles.buyButtonPressed,
                ]}
              >
                <Ionicons name="ticket-outline" size={20} color={colors.onInk} />
                <Text style={[styles.buyButtonText, { color: colors.onInk }]}>Buy ticket</Text>
              </Pressable>
            ) : null}

            {event.canManage ? (
              <Glass tint={ink.dark ? 'dark' : 'light'} radius={radius.pill} style={styles.manageBar}>
                <BarItem
                  icon="pencil"
                  label="Edit"
                  color={ink.text}
                  onPress={() => router.push(`/event/${event.slug}/edit`)}
                />
                <BarItem
                  icon="megaphone"
                  label="Blast"
                  color={ink.text}
                  onPress={() => router.push(`/event/${event.slug}/blast`)}
                />
                <BarItem
                  icon="ellipsis-horizontal"
                  label="More"
                  color={ink.text}
                  onPress={() => setMenuOpen(true)}
                />
              </Glass>
            ) : null}
          </View>
        </View>
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
  actionBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Full-width Buy-ticket button in the bottom bar (the page's primary action).
  // Bright silver pill — the high-contrast action on the midnight canvas.
  buyButtonBar: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  buyButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  // Compact glass pill holding host-only management actions beside the button.
  manageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  // paddingTop is applied inline (insets.top + button strip height).
  posterWrap: {
    padding: spacing.lg,
  },
  poster: {
    aspectRatio: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  // Size/lineHeight come from titleSizeStyle(title) — length-adaptive.
  heroTitleBelow: {
    marginTop: spacing.lg,
  },
  heroBlock: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  heroTitlePlain: {},
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
  favButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
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
  friendsCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  friendsKicker: {
    ...kicker(),
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  friendName: {
    flex: 1,
    ...uiText(15, '600'),
  },
  friendStatus: {
    ...uiText(13, '500'),
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
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  sendText: {
    color: colors.onAccent,
    ...uiText(15, '600'),
  },
});
