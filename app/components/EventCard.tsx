import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { EventSummary } from '../shared/types';
import { glass, radius, spacing } from '../lib/theme';
import { thinLabel, titleFontStyle } from '../lib/fonts';
import { CoverGradient } from './CoverGradient';
import { Avatar } from './Avatar';
import { MilkyCard } from './MilkyCard';

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
  WAITLIST: 'Waitlist',
};

export function EventCard({ event }: { event: EventSummary }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.slug}`)}
      style={({ pressed }) => [pressed && { opacity: 0.88 }]}
    >
      <MilkyCard radius={radius.milkySm} contentStyle={styles.cardInner}>
        <CoverGradient
          theme={event.coverTheme}
          image={event.coverImage}
          style={styles.cover}
          emojiOpacity={0.3}
        >
          {event.canceledAt ? (
            <View style={styles.canceledBadge}>
              <Text style={styles.canceledText}>CANCELED</Text>
            </View>
          ) : null}
          <Text style={[styles.title, titleFontStyle(event.titleFont)]} numberOfLines={2}>
            {event.title}
          </Text>
        </CoverGradient>
        <View style={styles.body}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={styles.date}>
              {formatEventDate(event.date)} · {formatEventTime(event.date)}
            </Text>
            <View style={styles.hostRow}>
              <Avatar name={event.host.name} image={event.host.avatarImage} size={24} />
              <Text style={styles.hostName} numberOfLines={1}>
                {event.isHost ? 'You are hosting' : `Hosted by ${event.host.name}`}
              </Text>
            </View>
          </View>
          <View style={styles.badges}>
            <View style={styles.goingRow}>
              <Avatar name={event.host.name} image={event.host.avatarImage} size={18} />
              <Text style={styles.going}>+{event.counts.going}</Text>
            </View>
            {event.myRsvp && !event.isHost ? (
              <Text style={styles.myStatus}>{STATUS_LABEL[event.myRsvp]}</Text>
            ) : null}
          </View>
        </View>
      </MilkyCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardInner: { padding: 0, overflow: 'hidden' },
  cover: {
    minHeight: 130,
    padding: spacing.md,
    justifyContent: 'flex-end',
  },
  canceledBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  canceledText: {
    ...thinLabel(10),
    color: '#FFFFFF',
    fontStyle: 'normal',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
  },
  date: {
    ...thinLabel(12),
    color: glass.textMuted,
    fontStyle: 'normal',
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hostName: {
    ...thinLabel(13),
    color: glass.text,
    fontStyle: 'normal',
    flex: 1,
  },
  badges: {
    alignItems: 'flex-end',
    gap: 4,
  },
  goingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  going: {
    ...thinLabel(11),
    color: glass.textFaint,
    fontStyle: 'normal',
  },
  myStatus: {
    ...thinLabel(10),
    color: glass.text,
    fontStyle: 'italic',
  },
});
