import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { EventSummary } from '../shared/types';
import { colors, radius, shadow, spacing } from '../lib/theme';
import { uiText, kicker } from '../lib/fonts';
import { CoverGradient } from './CoverGradient';
import { Avatar } from './Avatar';

export function formatEventDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// Luma-format list row: square cover thumbnail on the left, the event's facts
// stacked on the right. No attendee counters / RSVP status labels — tickets
// are bought at the source, so the row only carries the event's own facts.
export function EventCard({ event }: { event: EventSummary }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.slug}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <CoverGradient
        theme={event.coverTheme}
        image={event.coverImage}
        fallback={{ title: event.title, category: event.category }}
        compact
        style={styles.thumb}
      />
      <View style={styles.body}>
        {event.canceledAt ? (
          <View style={styles.canceledBadge}>
            <Text style={styles.canceledText}>CANCELED</Text>
          </View>
        ) : null}
        <Text style={styles.date} numberOfLines={1}>
          {formatEventDate(event.date)} · {formatEventTime(event.date)}
        </Text>
        <Text style={styles.bodyTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <View style={styles.hostRow}>
          <Avatar name={event.host.name} image={event.host.avatarImage} size={18} />
          <Text style={styles.hostName} numberOfLines={1}>
            {event.isHost ? 'You are hosting' : `Hosted by ${event.host.name}`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.sm,
    ...shadow.card,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
    paddingRight: spacing.xs,
  },
  // Small, quiet title line under the date — plain UI face, not the event's
  // decorative title font, so calendar rows stay compact and uniform.
  bodyTitle: {
    ...uiText(15, '700'),
    color: colors.text,
  },
  canceledBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: 2,
  },
  canceledText: {
    ...kicker(colors.danger),
    fontSize: 11,
  },
  date: {
    ...uiText(13, '600'),
    color: colors.muted,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  hostName: {
    ...uiText(13, '500'),
    color: colors.muted,
    flexShrink: 1,
  },
});
