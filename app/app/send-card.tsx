import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { CARD_THEMES, type CardEntry, type CardTheme, type MyProfile } from '../shared/types';
import { api } from '../lib/api';
import { CARD_META } from '../lib/cards';
import { copyLink, shareText } from '../lib/share';
import { colors, radius, spacing } from '../lib/theme';
import { titleFontStyle } from '../lib/fonts';
import { CoverGradient } from '../components/CoverGradient';
import { Avatar } from '../components/Avatar';
import { Button, ErrorText, Field } from '../components/ui';

const MESSAGE_LIMIT = 500;

function cardLink(id: string): string {
  return Linking.createURL(`c/${id}`);
}

export default function SendCardScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toUserId, setToUserId] = useState<string | null>(null);
  const [theme, setTheme] = useState<CardTheme>('confetti');
  const [message, setMessage] = useState('');
  // The last card created for the current design; reused across share/copy so
  // tapping both buttons doesn't create duplicates. Cleared whenever the design
  // changes so a shared link always matches what's on screen.
  const [card, setCard] = useState<CardEntry | null>(null);
  const [busy, setBusy] = useState<'share' | 'copy' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCard(null);
  }, [theme, message, toUserId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api
        .myProfile()
        .then((res) => {
          if (!active) return;
          setProfile(res.profile);
          setLoadError(null);
        })
        .catch((e) => {
          if (!active) return;
          setLoadError(e instanceof Error ? e.message : 'Could not load your card');
        });
      return () => {
        active = false;
      };
    }, [])
  );

  // Create the card once for the current design (or reuse the last one), then
  // return its shareable link.
  async function ensureLink(): Promise<string | null> {
    if (card) return cardLink(card.id);
    const text = message.trim();
    if (!text) {
      setError('Write a little message first.');
      return null;
    }
    setError(null);
    const res = await api.sendCard(theme, text, toUserId ?? undefined);
    setCard(res.card);
    return cardLink(res.card.id);
  }

  async function onShare() {
    if (busy) return;
    setBusy('share');
    try {
      const link = await ensureLink();
      if (!link) return;
      const meta = CARD_META[theme];
      await shareText(`${meta.emoji} ${message.trim()}\n\nOpen your card in Hausi: ${link}`, link);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the card');
    } finally {
      setBusy(null);
    }
  }

  async function onCopy() {
    if (busy) return;
    setBusy('copy');
    try {
      const link = await ensureLink();
      if (!link) return;
      await copyLink(link);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the card');
    } finally {
      setBusy(null);
    }
  }

  if (loadError && !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>🫠</Text>
        <Text style={styles.centerText}>{loadError}</Text>
        <Button title="Close" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const meta = CARD_META[theme];
  const recipient = profile.mutuals.find((m) => m.user.id === toUserId)?.user ?? null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Card</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.themesRow}
        >
          {CARD_THEMES.map((t) => {
            const selected = t === theme;
            const tMeta = CARD_META[t];
            return (
              <Pressable
                key={t}
                onPress={() => setTheme(t)}
                style={[styles.themeCard, selected && styles.themeCardSelected]}
              >
                <CoverGradient theme={tMeta.cover} style={styles.themeArt} emojiOpacity={0.2}>
                  <Text style={styles.themeEmoji}>{tMeta.emoji}</Text>
                </CoverGradient>
                <Text style={[styles.themeLabel, selected && styles.themeLabelSelected]}>
                  {tMeta.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Field
          label="Message"
          value={message}
          onChangeText={setMessage}
          placeholder="Say something nice…"
          multiline
          maxLength={MESSAGE_LIMIT}
          style={styles.messageInput}
        />

        <Text style={styles.sectionLabel}>Preview</Text>
        <CoverGradient theme={meta.cover} style={styles.preview} emojiOpacity={0.2}>
          <Text style={styles.previewEmoji}>{meta.emoji}</Text>
          <Text
            style={[
              styles.previewMessage,
              titleFontStyle('fancy'),
              !message.trim() && styles.previewPlaceholder,
            ]}
          >
            {message.trim() || 'Your message here…'}
          </Text>
        </CoverGradient>

        {profile.mutuals.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Also send in-app (optional)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mutualsRow}
            >
              {profile.mutuals.map((m) => {
                const selected = m.user.id === toUserId;
                return (
                  <Pressable
                    key={m.user.id}
                    onPress={() => setToUserId(selected ? null : m.user.id)}
                    style={styles.mutual}
                  >
                    <View style={[styles.avatarRing, selected && styles.avatarRingSelected]}>
                      <Avatar emoji={m.user.avatarEmoji} size={52} />
                    </View>
                    <Text
                      style={[styles.mutualName, selected && styles.mutualNameSelected]}
                      numberOfLines={1}
                    >
                      {m.user.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {recipient ? (
          <Text style={styles.recipientNote}>
            💌 {recipient.name} also gets this card in Hausi.
          </Text>
        ) : null}

        <ErrorText message={error} />
        <Button
          title="Send on Messages 💌"
          onPress={onShare}
          loading={busy === 'share'}
        />
        <Button
          title="Copy link"
          variant="ghost"
          onPress={onCopy}
          loading={busy === 'copy'}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  errorEmoji: {
    fontSize: 48,
  },
  centerText: {
    color: colors.text,
    fontSize: 17,
    textAlign: 'center',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  mutualsRow: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  mutual: {
    alignItems: 'center',
    gap: spacing.xs,
    width: 72,
  },
  avatarRing: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 30,
    padding: 2,
  },
  avatarRingSelected: {
    borderColor: colors.accent,
  },
  mutualName: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 72,
  },
  mutualNameSelected: {
    color: colors.text,
  },
  recipientNote: {
    color: colors.muted,
    fontSize: 13,
  },
  themesRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  themeCard: {
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  themeCardSelected: {
    borderColor: colors.accent,
  },
  themeArt: {
    width: 76,
    height: 96,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeEmoji: {
    fontSize: 32,
  },
  themeLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  themeLabelSelected: {
    color: colors.text,
  },
  messageInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  preview: {
    minHeight: 160,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  previewEmoji: {
    fontSize: 52,
  },
  previewMessage: {
    color: '#fff',
    fontSize: 24,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  previewPlaceholder: {
    opacity: 0.6,
  },
});
