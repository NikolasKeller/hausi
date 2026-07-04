import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '../../lib/theme';
import { display, kicker, uiText } from '../../lib/fonts';
import { CoverGradient } from '../../components/CoverGradient';
import { Burst, Seal } from '../../components/partiful';
import { withScreenBackground } from '../../components/ScreenBackground';

export default withScreenBackground(CreateScreen);

function CreateScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text style={[styles.kicker, kicker(colors.accent)]}>Start something</Text>
          <Text style={styles.title}>
            Make something{'\n'}happen
          </Text>
          <Burst size={40} color={colors.helio} rotate={12} style={styles.headingBurst} />
        </View>

        <View style={styles.rows}>
          <Pressable
            onPress={() => router.push('/new-event')}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Seal size={52} color={colors.accent} rotate={-8}>
              <Text style={styles.plus}>＋</Text>
            </Seal>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>New event</Text>
              <Text style={styles.rowSubtitle}>Collect RSVPs</Text>
            </View>
            <CoverGradient theme="sunset" style={styles.art} emojiOpacity={0.25}>
              <Text style={styles.artEmoji}>🎉</Text>
            </CoverGradient>
          </Pressable>

          <Pressable
            onPress={() => router.push('/send-card')}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Seal size={52} color={colors.violet} rotate={7}>
              <Text style={styles.plus}>＋</Text>
            </Seal>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Send a card</Text>
              <Text style={styles.rowSubtitle}>Brighten someone's day</Text>
            </View>
            <CoverGradient theme="candy" style={styles.art} emojiOpacity={0.25}>
              <Text style={styles.artEmoji}>💌</Text>
            </CoverGradient>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          Events can be private (invite-only) or public on Explore.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  heading: {
    gap: spacing.sm,
  },
  kicker: {
    color: colors.accent,
  },
  title: {
    ...display(52),
    color: colors.text,
  },
  headingBurst: {
    position: 'absolute',
    top: -8,
    right: spacing.xs,
  },
  rows: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
  plus: {
    color: colors.onAccent,
    fontSize: 26,
    fontWeight: '400',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...display(22, { weight: 'heavy' }),
    color: colors.text,
  },
  rowSubtitle: {
    ...uiText(14),
    color: colors.muted,
  },
  art: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artEmoji: {
    fontSize: 30,
  },
  hint: {
    ...uiText(13),
    color: colors.muted,
    textAlign: 'center',
  },
});
