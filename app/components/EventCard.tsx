import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { EventSummary } from '../shared/types';
import { colors, radius, spacing } from '../lib/theme';
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

const STATUS_LABEL: Record<string, string> = {
  GOING: 'Going',
  MAYBE: 'Maybe',
  CANT: "Can't go",
};

export function EventCard({ event }: { event: EventSummary }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.slug}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <CoverGradient theme={event.coverTheme} style={styles.cover} emojiOpacity={0.3}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
      </CoverGradient>
      <View style={styles.body}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.date}>
            {formatEventDate(event.date)} · {formatEventTime(event.date)}
          </Text>
          <View style={styles.hostRow}>
            <Avatar emoji={event.host.avatarEmoji} size={22} />
            <Text style={styles.hostName} numberOfLines={1}>
              {event.isHost ? 'You are hosting' : `Hosted by ${event.host.name}`}
            </Text>
          </View>
        </View>
        <View style={styles.badges}>
          <Text style={styles.going}>{event.counts.going} going</Text>
          {event.myRsvp && !event.isHost ? (
            <Text style={styles.myStatus}>{STATUS_LABEL[event.myRsvp]}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  cover: {
    minHeight: 110,
    padding: spacing.md,
    justifyContent: 'flex-end',
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  date: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hostName: {
    color: colors.muted,
    fontSize: 13,
    flexShrink: 1,
  },
  badges: {
    alignItems: 'flex-end',
    gap: 2,
  },
  going: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 13,
  },
  myStatus: {
    color: colors.muted,
    fontSize: 12,
  },
});
