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
import { light, radius, spacing } from '../lib/theme';
import { display, kicker, titleFontStyle, uiText } from '../lib/fonts';
import { CoverGradient } from '../components/CoverGradient';
import { Avatar } from '../components/Avatar';
import { Button, ErrorText, Field } from '../components/ui';
import { Burst, PaperBackground, PaperCard, Seal, TiltCard } from '../components/partiful';

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
      <PaperBackground>
        <View style={styles.center}>
          <Seal size={92} color={light.sand} rotate={-8}>
            <Text style={styles.errorEmoji}>🫠</Text>
          </Seal>
          <Text style={styles.centerText}>{loadError}</Text>
          <Button title="Close" variant="ghost" onPress={() => router.back()} />
        </View>
      </PaperBackground>
    );
  }

  if (!profile) {
    return (
      <PaperBackground>
        <View style={styles.center}>
          <ActivityIndicator color={light.ink} size="large" />
        </View>
      </PaperBackground>
    );
  }

  const meta = CARD_META[theme];
  const recipient = profile.mutuals.find((m) => m.user.id === toUserId)?.user ?? null;

  return (
    <PaperBackground>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={[styles.kicker, kicker(light.text3)]}>Send a card</Text>
            <Text style={[styles.headline, display(48)]}>Make it special</Text>
          </View>

          <Text style={[styles.sectionLabel, kicker(light.text3)]}>Card</Text>
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
            tone="light"
            value={message}
            onChangeText={setMessage}
            placeholder="Say something nice…"
            multiline
            maxLength={MESSAGE_LIMIT}
            style={styles.messageInput}
          />

          <Text style={[styles.sectionLabel, kicker(light.text3)]}>Preview</Text>
          <TiltCard rotate={-2} float style={styles.previewWrap}>
            <PaperCard style={styles.previewPaper}>
              <Burst size={44} color={light.sand} rotate={14} style={styles.previewBurst} />
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
            </PaperCard>
          </TiltCard>

          {profile.mutuals.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, kicker(light.text3)]}>Also send in-app (optional)</Text>
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
            variant="primary"
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
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  errorEmoji: {
    fontSize: 40,
  },
  centerText: {
    color: light.text2,
    textAlign: 'center',
    ...uiText(17, '500'),
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  kicker: {
    color: light.text3,
  },
  headline: {
    color: light.ink,
  },
  sectionLabel: {
    color: light.text3,
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
    borderColor: light.ink,
  },
  mutualName: {
    color: light.text3,
    maxWidth: 72,
    ...uiText(12, '600'),
  },
  mutualNameSelected: {
    color: light.ink,
    fontWeight: '700',
  },
  recipientNote: {
    color: light.text3,
    ...uiText(13, '500'),
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
    borderColor: light.ink,
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
    color: light.text3,
    ...uiText(12, '600'),
  },
  themeLabelSelected: {
    color: light.ink,
    fontWeight: '700',
  },
  messageInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  previewWrap: {
    alignSelf: 'stretch',
  },
  previewPaper: {
    padding: spacing.sm,
    overflow: 'visible',
  },
  previewBurst: {
    position: 'absolute',
    top: -18,
    right: -12,
    zIndex: 2,
  },
  preview: {
    minHeight: 160,
    borderRadius: radius.md,
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
