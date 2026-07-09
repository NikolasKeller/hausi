import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { EventSummary } from '../shared/types';
import { colors, radius, shadow, spacing } from '../lib/theme';
import { titleFontStyle, uiText, kicker } from '../lib/fonts';
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
  // Photo covers get white type over a scrim; the plain paper cover needs dark
  // graphite type to stay legible.
  const hasPhoto = Boolean(event.coverImage);
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.slug}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <CoverGradient theme={event.coverTheme} image={event.coverImage} style={styles.cover}>
        {event.canceledAt ? (
          <View style={styles.canceledBadge}>
            <Text style={styles.canceledText}>CANCELED</Text>
          </View>
        ) : null}
        <Text
          style={[styles.title, hasPhoto ? styles.titleOnPhoto : styles.titleOnPaper, titleFontStyle(event.titleFont)]}
          numberOfLines={2}
        >
          {event.title}
        </Text>
      </CoverGradient>
      {/* No attendee counters / RSVP status labels — tickets are bought at the
          source, so the card only carries the event's own facts. */}
      <View style={styles.body}>
        <View style={{ flex: 1, gap: spacing.xs }}>
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
  title: {
    fontSize: 38,
    letterSpacing: -1,
  },
  // On a photo cover: white type with a shadow for legibility over imagery.
  titleOnPhoto: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  // On the plain paper cover: graphite ink, no shadow. Hardcoded — the cover
  // stays a light paper "flyer" even on the midnight canvas, so it must not
  // follow the (now light) theme ink.
  titleOnPaper: {
    color: '#2B2E33',
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
