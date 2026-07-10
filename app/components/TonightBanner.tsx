import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { EventSummary } from '../shared/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, radius, shadow, spacing } from '../lib/theme';
import { uiText, kicker } from '../lib/fonts';
import { Glass } from './glass';
import { formatEventTime } from './EventCard';

// Same grace window as the calendar: an event still counts as "happening"
// until 6 hours after its start time.
const PAST_GRACE_MS = 6 * 60 * 60 * 1000;

// Dismissals live for the app session only (module scope, not storage) — the
// banner is a same-day reminder, so it may reappear on the next app launch.
const dismissedEventIds = new Set<string>();

// The soonest event today that the user actually attends: holds a ticket
// (GOING) or hosts, not canceled, and not past the grace window.
function pickTonightEvent(events: EventSummary[], now: Date): EventSummary | null {
  const todayKey = now.toDateString();
  const candidates = events
    .filter((ev) => {
      if (ev.canceledAt) return false;
      if (!(ev.isHost || ev.myRsvp === 'GOING')) return false;
      const start = new Date(ev.date);
      if (start.toDateString() !== todayKey) return false;
      return start.getTime() + PAST_GRACE_MS > now.getTime();
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return candidates[0] ?? null;
}

function countdownLabel(startIso: string, now: Date): string {
  const ms = new Date(startIso).getTime() - now.getTime();
  if (ms <= 0) return 'Happening now';
  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `Starts in ${minutes}m`;
  if (minutes === 0) return `Starts in ${hours}h`;
  return `Starts in ${hours}h ${minutes}m`;
}

// A small dismissible banner for the home screen: shown when the user has a
// ticket for (or hosts) an event happening today, with a live countdown until
// it starts. Tapping opens the event page.
export function TonightBanner() {
  const router = useRouter();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventSummary | null>(null);
  // Ticks every minute so the countdown (and the banner's own visibility
  // window) stays current while the screen is open.
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setEvent(null);
        return;
      }
      let active = true;
      setNow(new Date());
      api
        .myEvents()
        .then((res) => {
          if (active) setEvent(pickTonightEvent(res.events, new Date()));
        })
        .catch(() => {
          // Quiet failure — the banner is a bonus, never an error surface.
        });
      return () => {
        active = false;
      };
    }, [user])
  );

  useEffect(() => {
    if (!event) return;
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [event]);

  if (!event || dismissedEventIds.has(event.id)) return null;
  // The minute tick can carry the event past its grace window mid-session.
  if (new Date(event.date).getTime() + PAST_GRACE_MS <= now.getTime()) return null;

  const live = new Date(event.date).getTime() <= now.getTime();

  return (
    <Glass tint="dark" radius={radius.md} style={styles.banner}>
      <Pressable
        onPress={() => router.push(`/event/${event.slug}`)}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.emoji}>{live ? '🔥' : '🎟️'}</Text>
        <View style={styles.textWrap}>
          <Text style={styles.kickerLine}>
            {event.isHost && event.myRsvp !== 'GOING'
              ? "You're hosting tonight"
              : "You're going tonight"}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {countdownLabel(event.date, now)} · {formatEventTime(event.date)}
            {event.location ? ` · ${event.location}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>
      <Pressable
        onPress={() => {
          dismissedEventIds.add(event.id);
          setEvent(null);
        }}
        hitSlop={8}
        style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="close" size={14} color={colors.muted} />
      </Pressable>
    </Glass>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    // Keeps the text clear of the close button in the top-right corner.
    paddingRight: spacing.xl,
  },
  emoji: {
    fontSize: 26,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  kickerLine: {
    ...kicker(colors.muted),
    fontSize: 12,
  },
  title: {
    ...uiText(15, '700'),
    color: colors.text,
  },
  meta: {
    ...uiText(13, '600'),
    color: colors.muted,
  },
  close: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
