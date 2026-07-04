import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { NotificationEntry } from '../shared/types';
import { api } from '../lib/api';
import { colors, radius, shadow, spacing } from '../lib/theme';
import { display, kicker, uiText } from '../lib/fonts';

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
      renderItem={({ item }) => {
        return (
          <Pressable
            onPress={() => {
              if (item.eventSlug) router.push(`/event/${item.eventSlug}`);
            }}
            style={({ pressed }) => [
              styles.item,
              !item.read && styles.itemUnread,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={styles.iconChip}>
              <Text style={styles.icon}>{TYPE_ICONS[item.type] ?? '🔔'}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.text, !item.read && styles.textUnread]}>{item.text}</Text>
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
            {!item.read ? <View style={styles.unreadDot} /> : null}
          </Pressable>
        );
      }}
      ListEmptyComponent={
        loading ? null : (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔕</Text>
            <Text style={styles.emptyKicker}>All quiet</Text>
            <Text style={styles.emptyTitle}>
              Nothing <Text style={styles.emptyTitleItalic}>yet</Text>
            </Text>
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
    padding: spacing.lg,
    paddingTop: spacing.xl,
    flexGrow: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  itemUnread: {
    borderColor: colors.accent,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  icon: {
    fontSize: 20,
  },
  text: {
    ...uiText(14),
    color: colors.muted,
  },
  textUnread: {
    ...uiText(15, '600'),
    color: colors.text,
  },
  time: {
    ...uiText(12, '600'),
    color: colors.muted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: spacing.sm,
  },
  emptyKicker: {
    ...kicker(colors.muted),
  },
  emptyTitle: {
    ...display(44),
    color: colors.text,
    textAlign: 'center',
  },
  emptyTitleItalic: {
    fontStyle: 'italic',
  },
  emptyText: {
    ...uiText(16),
    color: colors.muted,
    textAlign: 'center',
  },
});
