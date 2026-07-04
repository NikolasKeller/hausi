import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, radius, spacing } from '../../lib/theme';
import { CoverGradient } from '../../components/CoverGradient';
import { withScreenBackground } from '../../components/ScreenBackground';

export default withScreenBackground(CreateScreen);

function CreateScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Make something happen ✨</Text>

        <Pressable
          onPress={() => router.push('/new-event')}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.plus}>＋</Text>
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
          <Text style={styles.plus}>＋</Text>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Send a card</Text>
            <Text style={styles.rowSubtitle}>Brighten someone's day</Text>
          </View>
          <CoverGradient theme="candy" style={styles.art} emojiOpacity={0.25}>
            <Text style={styles.artEmoji}>💌</Text>
          </CoverGradient>
        </Pressable>

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
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.75,
  },
  plus: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '300',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  rowSubtitle: {
    color: colors.muted,
    fontSize: 14,
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
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
