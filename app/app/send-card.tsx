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
import { light, radius, shadow, spacing } from '../lib/theme';
import { display, kicker, titleFontStyle, uiText } from '../lib/fonts';
import { CoverGradient } from '../components/CoverGradient';
import { Avatar } from '../components/Avatar';
import { Button, ErrorText } from '../components/ui';
import { Burst, Seal, TiltCard } from '../components/partiful';
import { AmbientBackground, Glass, GlassField, GlassPill } from '../components/glass';

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
      <AmbientBackground variant="iridescent">
        <View style={styles.center}>
          <Seal size={92} color={light.sand} rotate={-8}>
            <Text style={styles.errorEmoji}>🫠</Text>
          </Seal>
          <Text style={styles.centerText}>{loadError}</Text>
          <Button title="Close" variant="ghost" onPress={() => router.back()} />
        </View>
      </AmbientBackground>
    );
  }

  if (!profile) {
    return (
      <AmbientBackground variant="iridescent">
        <View style={styles.center}>
          <ActivityIndicator color={light.ink} size="large" />
        </View>
      </AmbientBackground>
    );
  }

  const meta = CARD_META[theme];
  const recipient = profile.mutuals.find((m) => m.user.id === toUserId)?.user ?? null;

  return (
    <AmbientBackground variant="iridescent">
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={[styles.kicker, kicker('rgba(0,0,0,0.5)')]}>Send a card</Text>
            <Text style={[styles.headline, display(48)]}>Make it special</Text>
          </View>

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
                <Pressable key={t} onPress={() => setTheme(t)}>
                  <GlassPill active={selected} style={styles.themeChip}>
                    <View style={styles.themeChipInner}>
                      <CoverGradient theme={tMeta.cover} style={styles.themeArt} emojiOpacity={0.2}>
                        <Text style={styles.themeEmoji}>{tMeta.emoji}</Text>
                      </CoverGradient>
                      <Text style={[styles.themeLabel, selected && styles.themeLabelSelected]}>
                        {tMeta.label}
                      </Text>
                    </View>
                  </GlassPill>
                </Pressable>
              );
            })}
          </ScrollView>

          <GlassField
            label="Message"
            value={message}
            onChangeText={setMessage}
            placeholder="Say something nice…"
            multiline
            maxLength={MESSAGE_LIMIT}
            containerStyle={styles.messageWrap}
            style={styles.messageInput}
          />

          <Text style={styles.sectionLabel}>Preview</Text>
          <View style={styles.previewStage}>
            {/* Decorative envelope peeking out behind the card — the "card in an
                envelope" metaphor. Purely cosmetic; never intercepts touches. */}
            <View pointerEvents="none" style={styles.envelope}>
              <View style={styles.envelopeFlap} />
            </View>
            <TiltCard rotate={-2} float style={styles.previewWrap}>
              <Glass intensity={30} tint="light" radius={radius.lg} style={styles.previewPaper}>
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
              </Glass>
            </TiltCard>
          </View>

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
    </AmbientBackground>
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
    color: 'rgba(0,0,0,0.5)',
  },
  headline: {
    color: light.ink,
  },
  sectionLabel: {
    color: 'rgba(0,0,0,0.5)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
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
    color: light.text2,
    maxWidth: 72,
    ...uiText(12, '600'),
  },
  mutualNameSelected: {
    color: light.ink,
    fontWeight: '700',
  },
  recipientNote: {
    color: light.text2,
    ...uiText(13, '500'),
  },
  themesRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  themeChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  themeChipInner: {
    alignItems: 'center',
    gap: spacing.xs,
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
    color: light.text2,
    ...uiText(12, '600'),
  },
  themeLabelSelected: {
    color: light.ink,
    fontWeight: '700',
  },
  messageWrap: {
    alignItems: 'flex-start',
  },
  messageInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  previewStage: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  previewWrap: {
    alignSelf: 'stretch',
  },
  previewPaper: {
    padding: spacing.sm,
  },
  envelope: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: 14,
    bottom: -14,
    backgroundColor: '#F2E9D6',
    borderRadius: radius.md,
    transform: [{ rotate: '3deg' }],
    ...shadow.card,
  },
  envelopeFlap: {
    position: 'absolute',
    top: 0,
    left: '18%',
    right: '18%',
    height: 46,
    backgroundColor: '#E8DCC2',
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
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
