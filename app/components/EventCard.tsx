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
        style={styles.cover}
      >
        {event.canceledAt ? (
          <View style={styles.canceledBadge}>
            <Text style={styles.canceledText}>CANCELED</Text>
          </View>
        ) : null}
      </CoverGradient>
      {/* No attendee counters / RSVP status labels — tickets are bought at the
          source, so the card only carries the event's own facts. The title
          lives below the cover, never on the image itself. */}
      <View style={styles.body}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={styles.bodyTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.date}>
            {formatEventDate(event.date)} · {formatEventTime(event.date)}
          </Text>
          <View style={styles.hostRow}>
            <Avatar name={event.host.name} image={event.host.avatarImage} size={26} />
            <Text style={styles.hostName} numberOfLines={1}>
              {event.isHost ? 'You are hosting' : `Hosted by ${event.host.name}`}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadow.card,
  },
  cover: {
    minHeight: 150,
    padding: spacing.lg,
    justifyContent: 'flex-end',
  },
  // Small, quiet title line above the date — plain UI face, not the event's
  // decorative title font, so calendar rows stay compact and uniform.
  bodyTitle: {
    ...uiText(14, '700'),
    color: colors.text,
  },
  // CANCELED badge also sits on the cover hero — keep it legible on dark imagery.
  canceledBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  canceledText: {
    ...kicker(colors.danger),
    fontSize: 12,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  date: {
    ...uiText(14, '600'),
    color: colors.muted,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hostName: {
    ...uiText(13, '500'),
    color: colors.muted,
    flexShrink: 1,
  },
});
