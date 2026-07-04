import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { NotificationEntry } from '../shared/types';
import { api } from '../lib/api';
import { colors, radius, spacing } from '../lib/theme';

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
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => {
            if (item.eventSlug) router.push(`/event/${item.eventSlug}`);
          }}
          style={({ pressed }) => [
            styles.item,
            !item.read && styles.itemUnread,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.icon}>{TYPE_ICONS[item.type] ?? '🔔'}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.text, !item.read && styles.textUnread]}>{item.text}</Text>
            <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        loading ? null : (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔕</Text>
            <Text style={styles.emptyText}>Nothing yet — go throw a party!</Text>
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
    flexGrow: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  itemUnread: {
    borderColor: colors.accent,
  },
  icon: {
    fontSize: 22,
  },
  text: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  textUnread: {
    color: colors.text,
    fontWeight: '600',
  },
  time: {
    color: colors.muted,
    fontSize: 12,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyEmoji: {
    fontSize: 44,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
  },
});
