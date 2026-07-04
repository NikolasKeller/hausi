import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { NotificationEntry } from '../shared/types';
import { api } from '../lib/api';
import { colors, radius, shadow, spacing } from '../lib/theme';
import { display, kicker, uiText } from '../lib/fonts';
import { Seal } from '../components/partiful';

const TYPE_ICONS: Record<string, string> = {
  RSVP: '🙋',
  COMMENT: '💬',
  EVENT_UPDATED: '📝',
  EVENT_CANCELED: '😢',
  WAITLIST_PROMOTED: '🎉',
  COHOST_ADDED: '🤝',
  CARD_RECEIVED: '💌',
  CRUSH_MATCH: '💘',
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const res = await api.notifications();
          if (!active) return;
          setItems(res.notifications);
          if (res.unread > 0) {
            // Mark only what was fetched as read (newest createdAt as cutoff),
            // so notifications arriving mid-visit stay unread.
            api.markNotificationsRead(res.notifications[0]?.createdAt).catch(() => {});
          }
        } catch {
          // Show whatever we have; pull-to-refresh isn't critical here.
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <FlatList
      style={styles.flex}
      data={items}
      keyExtractor={(n) => n.id}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      renderItem={({ item, index }) => {
        // Deterministic alternating tilt so rows read like scattered stickers.
        const tilt = index % 2 === 0 ? -1.5 : 1.5;
        return (
          <Pressable
            onPress={() => {
              if (item.eventSlug) router.push(`/event/${item.eventSlug}`);
            }}
            style={({ pressed }) => [
              styles.item,
              { transform: [{ rotate: `${tilt}deg` }] },
              !item.read && styles.itemUnread,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Seal size={48} color={item.read ? colors.cardBorder : colors.accent} rotate={tilt * 2}>
              <Text style={styles.icon}>{TYPE_ICONS[item.type] ?? '🔔'}</Text>
            </Seal>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.text, !item.read && styles.textUnread]}>{item.text}</Text>
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        loading ? null : (
          <View style={styles.empty}>
            <Seal size={112} color={colors.accent} rotate={-8}>
              <Text style={styles.emptyEmoji}>🔕</Text>
            </Seal>
            <Text style={styles.emptyKicker}>ALL QUIET</Text>
            <Text style={styles.emptyTitle}>Nothing yet</Text>
            <Text style={styles.emptyText}>Go throw a party!</Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    padding: spacing.md,
    paddingTop: spacing.lg,
    flexGrow: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.card,
  },
  itemUnread: {
    borderColor: colors.accent,
  },
  icon: {
    fontSize: 22,
  },
  text: {
    ...uiText(14),
    color: colors.muted,
  },
  textUnread: {
    ...uiText(15, '700'),
    color: colors.text,
  },
  time: {
    ...uiText(12, '600'),
    color: colors.muted,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 52,
  },
  emptyKicker: {
    ...kicker(colors.accent),
    marginTop: spacing.md,
  },
  emptyTitle: {
    ...display(40),
    color: colors.text,
    textAlign: 'center',
  },
  emptyText: {
    ...uiText(16),
    color: colors.muted,
    textAlign: 'center',
  },
});
