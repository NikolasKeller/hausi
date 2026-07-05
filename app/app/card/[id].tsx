import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { CardEntry } from '../../shared/types';
import { api } from '../../lib/api';
import { CARD_META } from '../../lib/cards';
import { colors, radius, shadow, spacing } from '../../lib/theme';
import { display, kicker, titleFontStyle, uiText } from '../../lib/fonts';
import { CoverGradient } from '../../components/CoverGradient';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/ui';
import { PaperBackground } from '../../components/partiful';

export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<CardEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let active = true;
      api
        .cardById(id)
        .then((res) => {
          if (active) {
            setCard(res.card);
            setError(null);
          }
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : 'Could not open this card');
        });
      return () => {
        active = false;
      };
    }, [id])
  );

  if (error) {
    return (
      <PaperBackground>
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>🫠</Text>
          <Text style={styles.centerText}>{error}</Text>
          <Button title="Back home" variant="ghost" onPress={() => router.replace('/')} />
        </View>
      </PaperBackground>
    );
  }

  if (!card) {
    return (
      <PaperBackground>
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} size="large" />
        </View>
      </PaperBackground>
    );
  }

  const meta = CARD_META[card.theme];

  return (
    <PaperBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.kicker}>A card for you</Text>
            <Text style={styles.headline}>
              You{'’'}ve got mail
            </Text>
          </View>

          <View style={styles.cardWrap}>
            <CoverGradient theme={meta.cover} style={styles.card} emojiOpacity={0.18}>
              <Text style={styles.emoji}>{meta.emoji}</Text>
              <Text style={[styles.message, titleFontStyle('fancy')]}>{card.message}</Text>
              <View style={styles.fromRow}>
                <Avatar emoji={card.from.avatarEmoji} size={28} />
                <Text style={styles.fromText}>from {card.from.name}</Text>
              </View>
            </CoverGradient>
          </View>

          <View style={styles.actions}>
            <Button title="Send your own card" variant="primary" onPress={() => router.replace('/send-card')} />
            <Button title="Go to Hausi" variant="ghost" onPress={() => router.replace('/')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
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
    fontSize: 48,
  },
  centerText: {
    color: colors.muted,
    textAlign: 'center',
    ...uiText(17, '400'),
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  kicker: {
    ...kicker(colors.muted),
  },
  headline: {
    color: colors.text,
    ...display(52),
  },
  cardWrap: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.sm,
    ...shadow.card,
  },
  card: {
    minHeight: 340,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emoji: {
    fontSize: 72,
  },
  // White is intentional here: this text sits on the colorful CoverGradient art.
  message: {
    color: '#fff',
    fontSize: 30,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  fromRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  // White is intentional here: this text sits on the colorful CoverGradient art.
  fromText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  actions: {
    gap: spacing.md,
  },
});
