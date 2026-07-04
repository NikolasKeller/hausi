import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { LIMITS, type Mutual } from '../shared/types';
import { api } from '../lib/api';
import { colors, radius, spacing } from '../lib/theme';
import { Avatar } from '../components/Avatar';
import { Button, ErrorText, Field } from '../components/ui';

type Mode = 'browse' | 'manual';

// Opened after a guest says they're GOING (from the event screen). They pick a
// single +1: either someone they've partied with (a mutual) or a manual
// name + phone. The event screen refetches on focus, so we just router.back().
export default function AddPlusOneScreen() {
  const router = useRouter();
  const { eventId, exclude } = useLocalSearchParams<{
    eventId: string;
    slug?: string;
    exclude?: string;
  }>();
  // User ids already on the guest list (or already a +1) — not eligible.
  const excludeSet = useMemo(
    () => new Set((exclude ?? '').split(',').filter(Boolean)),
    [exclude]
  );
  const [mode, setMode] = useState<Mode>('browse');
  const [mutuals, setMutuals] = useState<Mutual[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api
        .myProfile()
        .then((res) => {
          if (!active) return;
          setMutuals(res.profile.mutuals);
          setLoadError(null);
        })
        .catch((e) => {
          if (!active) return;
          setLoadError(e instanceof Error ? e.message : 'Could not load your people');
        });
      return () => {
        active = false;
      };
    }, [])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (mutuals ?? []).filter((m) => !excludeSet.has(m.user.id));
    if (!q) return list;
    return list.filter((m) => m.user.name.toLowerCase().includes(q));
  }, [mutuals, query, excludeSet]);

  // Don't let a selection survive once it's filtered out of view (e.g. after
  // typing a search that hides it) — otherwise the button submits someone
  // the user can no longer see.
  useEffect(() => {
    if (selectedId && !filtered.some((m) => m.user.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  async function submit(guest: { userId: string } | { name: string; phone: string }) {
    if (!eventId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.addPlusOne(eventId, guest);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add your plus one');
    } finally {
      setBusy(false);
    }
  }

  function addSelected() {
    if (!selectedId) {
      setError('Pick someone to bring.');
      return;
    }
    submit({ userId: selectedId });
  }

  function addManual() {
    const n = name.trim();
    const p = phone.trim();
    if (!n) {
      setError('Enter their name.');
      return;
    }
    if (p.replace(/[^0-9]/g, '').length < 3) {
      setError('Enter their phone number.');
      return;
    }
    submit({ name: n, phone: p });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>You can bring one plus one 🎟️</Text>

        <View style={styles.segment}>
          {(['browse', 'manual'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                setMode(m);
                setError(null);
              }}
              style={[styles.segmentButton, mode === m && styles.segmentButtonActive]}
            >
              <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                {m === 'browse' ? 'People you know' : 'Add manually'}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'browse' ? (
          <View style={{ gap: spacing.sm }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search people you've partied with"
              placeholderTextColor={colors.muted}
              style={styles.search}
              autoCapitalize="none"
            />
            {mutuals == null && !loadError ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />
            ) : loadError ? (
              <Text style={styles.empty}>{loadError}</Text>
            ) : filtered.length === 0 ? (
              <Text style={styles.empty}>
                {query.trim()
                  ? 'No one by that name.'
                  : "You haven't partied with anyone yet — add your plus one manually."}
              </Text>
            ) : (
              filtered.map((m) => {
                const selected = m.user.id === selectedId;
                return (
                  <Pressable
                    key={m.user.id}
                    onPress={() => {
                      setSelectedId(m.user.id);
                      setError(null);
                    }}
                    style={[styles.personRow, selected && styles.personRowSelected]}
                  >
                    <Avatar emoji={m.user.avatarEmoji} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {m.user.name}
                      </Text>
                      {m.sharedEventTitle ? (
                        <Text style={styles.personMeta} numberOfLines={1}>
                          via {m.sharedEventTitle}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              })
            )}
            <ErrorText message={error} />
            <Button
              title={busy ? 'Adding…' : 'Add plus one'}
              onPress={addSelected}
              loading={busy}
              style={!selectedId ? styles.disabled : undefined}
            />
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <Field
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Their name"
              maxLength={LIMITS.name}
              autoCapitalize="words"
            />
            <Field
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 555 123 4567"
              keyboardType="phone-pad"
              maxLength={30}
            />
            <ErrorText message={error} />
            <Button title={busy ? 'Adding…' : 'Add plus one'} onPress={addManual} loading={busy} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    textAlign: 'center',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  segmentButtonActive: {
    backgroundColor: colors.accentDark,
  },
  segmentText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 14,
  },
  segmentTextActive: {
    color: '#fff',
  },
  search: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  empty: {
    color: colors.muted,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  personRowSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(255,122,224,0.12)',
  },
  personName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  personMeta: {
    color: colors.muted,
    fontSize: 13,
  },
  check: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.5,
  },
});
