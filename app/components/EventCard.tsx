import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { EventSummary } from '../shared/types';
import { colors, radius, shadow, spacing } from '../lib/theme';
import { titleFontStyle, uiText, kicker } from '../lib/fonts';
import { CoverGradient } from './CoverGradient';
import { Avatar } from './Avatar';
import { ChromeCard } from './glass';

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

export function EventCard({ event, strong }: { event: EventSummary; strong?: boolean }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/event/${event.slug}`)}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      <ChromeCard radius={radius.md} strong={strong} style={shadow.card}>
        <CoverGradient theme={event.coverTheme} image={event.coverImage} style={styles.cover} emojiOpacity={0.45}>
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
              <Avatar name={event.host.name} image={event.host.avatarImage} size={26} />
              <Text style={styles.hostName} numberOfLines={1}>
                {event.isHost ? 'You are hosting' : `Hosted by ${event.host.name}`}
              </Text>
            </View>
          </View>
          <View style={styles.badges}>
            <View style={styles.goingRow}>
              <Avatar name={event.host.name} image={event.host.avatarImage} size={20} />
              <Text style={styles.going}>+{event.counts.going} going</Text>
            </View>
            {event.myRsvp && !event.isHost ? (
              <Text style={styles.myStatus}>{STATUS_LABEL[event.myRsvp]}</Text>
            ) : null}
          </View>
        </View>
      </ChromeCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: {
    minHeight: 150,
    padding: spacing.lg,
    justifyContent: 'flex-end',
  },
  // The title sits on the colorful/dark CoverGradient hero, so white stays here.
  title: {
    color: '#fff',
    fontSize: 38,
    letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
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
    color: colors.onGlassMuted,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hostName: {
    ...uiText(13, '500'),
    color: colors.onGlass,
    flexShrink: 1,
  },
  badges: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  // The approved "going" treatment: tiny avatar + "+N going" in dim ink,
  // no loud pill.
  goingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  going: {
    ...uiText(13, '600'),
    color: colors.onGlassMuted,
  },
  myStatus: {
    ...uiText(12, '600'),
    color: colors.onGlass,
  },
});
