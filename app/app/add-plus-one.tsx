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
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LIMITS, type Mutual } from '../shared/types';
import { api } from '../lib/api';
import { textInvite } from '../lib/share';
import { brandGradient, colors, radius, spacing } from '../lib/theme';
import { displayTitle } from '../lib/fonts';
import { Avatar } from '../components/Avatar';
import { Button, ErrorText, Field } from '../components/ui';
import { ScreenBackground } from '../components/ScreenBackground';

type Mode = 'browse' | 'manual';

// Opened after a guest says they're GOING (from the event screen). They pick a
// single +1: either someone they've partied with (a mutual) or a manual
// name + phone. The event screen refetches on focus, so we just router.back().
export default function AddPlusOneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId, slug, title, exclude } = useLocalSearchParams<{
    eventId: string;
    slug?: string;
    title?: string;
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
      // A manual invitee isn't on Hausi yet — jump straight into Messages with
      // their number and the invite pre-filled so the host can text them in one
      // tap. Signing up with that number links the spot to their account. Fired
      // after navigating back and not awaited: a blocked composer must never
      // strand the screen.
      if ('phone' in guest && slug) {
        const url = Linking.createURL(`e/${slug}`);
        const eventName = title?.trim() ? title.trim() : 'this event';
        textInvite(
          guest.phone,
          `Hey! I'd love to bring you to ${eventName} 🎟️ RSVP here: ${url}`,
          url
        ).catch(() => {});
      }
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

  const selectedName = mutuals?.find((m) => m.user.id === selectedId)?.user.name;

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 52 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.kicker}>YOUR PLUS ONE 🎟️</Text>
          <Text style={styles.title}>Who are you bringing?</Text>
          <Text style={styles.subtitle}>
            One guest — someone you've partied with, or a brand-new face.
          </Text>

          <View style={styles.segment}>
            {(['browse', 'manual'] as Mode[]).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    setMode(m);
                    setError(null);
                  }}
                  style={styles.segmentButton}
                >
                  {active ? (
                    <LinearGradient
                      colors={[...brandGradient]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.segmentFill}
                    />
                  ) : null}
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {m === 'browse' ? 'People you know' : 'Someone new'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {mode === 'browse' ? (
            <View style={styles.block}>
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
                    : 'No one to show yet — add your plus one under “Someone new.”'}
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
                      <Avatar emoji={m.user.avatarEmoji} size={44} />
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
                    </Pressable>
                  );
                })
              )}
              <ErrorText message={error} />
              <Button
                title={busy ? 'Adding…' : selectedName ? `Bring ${selectedName}` : 'Bring them'}
                onPress={addSelected}
                loading={busy}
                variant={selectedId ? 'primary' : 'ghost'}
              />
            </View>
          ) : (
            <View style={styles.block}>
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
              <Text style={styles.hint}>We only use this so the host can reach your guest.</Text>
              <ErrorText message={error} />
              <Button title={busy ? 'Adding…' : 'Add plus one'} onPress={addManual} loading={busy} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  title: {
    ...displayTitle,
    color: colors.text,
    fontSize: 48,
    lineHeight: 48,
    letterSpacing: -1.5,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 21,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  segmentFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
  },
  segmentText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 14,
  },
  segmentTextActive: {
    color: colors.onAccent,
  },
  block: {
    gap: spacing.sm,
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
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  personRowSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(255,122,224,0.12)',
  },
  personName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  personMeta: {
    color: colors.muted,
    fontSize: 13,
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
