import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { UserSearchResult } from '../shared/types';
import { api } from '../lib/api';
import { notify } from '../lib/dialogs';
import { colors, radius, spacing } from '../lib/theme';
import { display, uiText } from '../lib/fonts';
import { Avatar } from '../components/Avatar';
import { withScreenBackground } from '../components/ScreenBackground';

function PeopleSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.replace(/^@/, '').length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .searchUsers(trimmed)
        .then((res) => {
          if (active) setResults(res.users);
        })
        .catch(() => {
          if (active) setResults([]);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  async function addFriend(person: UserSearchResult) {
    if (busy || person.friendState !== 'none') return;
    setBusy(person.id);
    try {
      const res = await api.sendFriendRequest(person.id);
      setResults((current) =>
        current.map((item) =>
          item.id === person.id ? { ...item, friendState: res.state } : item
        )
      );
    } catch (e) {
      notify('Could not add friend', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Find your people</Text>
      </View>
      <View style={styles.search}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search @username or name"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          style={styles.searchInput}
        />
        {searching ? <ActivityIndicator size="small" color={colors.muted} /> : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {query.trim().length < 2 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👋</Text>
            <Text style={styles.emptyTitle}>Names now have handles</Text>
            <Text style={styles.emptyBody}>
              Search a unique @username, open their profile and send a friend request.
            </Text>
          </View>
        ) : !searching && results.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No one found</Text>
            <Text style={styles.emptyBody}>Try another name or exact @username.</Text>
          </View>
        ) : (
          results.map((person) => (
            <Pressable
              key={person.id}
              onPress={() => router.push(`/user/${person.id}`)}
              style={({ pressed }) => [styles.person, pressed && { opacity: 0.75 }]}
            >
              <Avatar name={person.name} image={person.avatarImage} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{person.name}</Text>
                <Text style={styles.handle}>
                  @{person.username}
                  {person.city ? ` · ${person.city}` : ''}
                </Text>
              </View>
              {person.friendState === 'none' ? (
                <Pressable
                  onPress={() => addFriend(person)}
                  disabled={busy === person.id}
                  style={styles.add}
                >
                  {busy === person.id ? (
                    <ActivityIndicator size="small" color={colors.onInk} />
                  ) : (
                    <Text style={styles.addText}>Add</Text>
                  )}
                </Pressable>
              ) : (
                <View style={styles.state}>
                  <Text style={styles.stateText}>
                    {person.friendState === 'friends'
                      ? 'Friends'
                      : person.friendState === 'incoming'
                        ? 'Requested you'
                        : 'Requested'}
                  </Text>
                </View>
              )}
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default withScreenBackground(PeopleSearchScreen, { bloom: false });

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  title: { ...display(28), color: colors.text },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  searchInput: { ...uiText(15), color: colors.text, flex: 1, paddingVertical: 13 },
  content: { padding: spacing.md, gap: spacing.sm },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  personName: { ...uiText(15, '700'), color: colors.text },
  handle: { ...uiText(12), color: colors.muted },
  add: {
    minWidth: 58,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignItems: 'center',
  },
  addText: { ...uiText(12, '700'), color: colors.onInk },
  state: { paddingHorizontal: 8 },
  stateText: { ...uiText(11, '600'), color: colors.muted },
  empty: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: spacing.lg },
  emptyEmoji: { fontSize: 42, marginBottom: spacing.sm },
  emptyTitle: { ...display(21), color: colors.text, textAlign: 'center' },
  emptyBody: { ...uiText(14), color: colors.muted, textAlign: 'center', marginTop: 5 },
});
