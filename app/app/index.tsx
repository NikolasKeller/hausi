import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { EventSummary } from '../shared/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, radius, spacing } from '../lib/theme';
import { EventCard } from '../components/EventCard';
import { Avatar } from '../components/Avatar';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.myEvents();
      setEvents(res.events);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load events');
    } finally {
      setLoading(false);
    }
    api
      .notifications()
      .then((res) => setUnread(res.unread))
      .catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (user) load();
    }, [user, load])
  );

  const sections = useMemo(() => {
    // An event stays "upcoming" until a few hours after it starts.
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    const upcoming = events.filter((e) => new Date(e.date).getTime() >= cutoff);
    const past = events
      .filter((e) => new Date(e.date).getTime() < cutoff)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return [
      ...(upcoming.length ? [{ title: 'Upcoming', data: upcoming }] : []),
      ...(past.length ? [{ title: 'Past', data: past }] : []),
    ];
  }, [events]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.headerTitle}>Your Events</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/notifications')} style={styles.bell} hitSlop={8}>
            <Text style={styles.bellIcon}>🔔</Text>
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable onPress={logout} style={styles.profile}>
            <Avatar emoji={user?.avatarEmoji ?? '🙂'} size={40} />
            <Text style={styles.logoutHint}>Log out</Text>
          </Pressable>
        </View>
      </View>

      {error && events.length > 0 ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>⚠️ {error}</Text>
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <EventCard event={item} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          loading ? (
            // RefreshControl's spinner never shows on web, so the first load
            // needs its own indicator.
            <View style={styles.empty}>
              <ActivityIndicator color={colors.accent} size="large" />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎈</Text>
              <Text style={styles.emptyTitle}>
                {error ?? 'No events yet'}
              </Text>
              {!error && (
                <Text style={styles.emptyText}>
                  Create your first party or open an invite link from a friend.
                </Text>
              )}
            </View>
          )
        }
      />

      <Pressable onPress={() => router.push('/create')} style={styles.fabWrap}>
        <LinearGradient
          colors={[colors.accentDark, '#C13FFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Text style={styles.fabText}>＋ Event</Text>
        </LinearGradient>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  greeting: {
    color: colors.muted,
    fontSize: 14,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bell: {
    padding: 4,
  },
  bellIcon: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: -2,
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  profile: {
    alignItems: 'center',
    gap: 2,
  },
  logoutHint: {
    color: colors.muted,
    fontSize: 10,
  },
  list: {
    padding: spacing.md,
    paddingBottom: 120,
    flexGrow: 1,
  },
  sectionHeader: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  errorBanner: {
    marginHorizontal: spacing.md,
    backgroundColor: '#3A1B2A',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 13,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 52,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 280,
  },
  fabWrap: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
  },
  fab: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
});
