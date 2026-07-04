import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, radius, spacing } from '../lib/theme';
import { AuroraBackground } from '../components/AuroraBackground';
import { Avatar } from '../components/Avatar';
import { Button, ErrorText, Field } from '../components/ui';

const EMOJI_CHOICES = [
  '🎉', '🦄', '🕺', '🌸', '🐙', '🪩',
  '🌈', '🍕', '👽', '🔥', '🐸', '💫',
  '😎', '🐯', '🍩', '🎧', '🧃', '🫶',
] as const;

export default function SetupScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();

  const [name, setName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState<string>(() => {
    const current = user?.avatarEmoji;
    return current && (EMOJI_CHOICES as readonly string[]).includes(current)
      ? current
      : EMOJI_CHOICES[0];
  });
  const [busy, setBusy] = useState<'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Tell us your name first');
      return;
    }
    setBusy('save');
    setError(null);
    try {
      await api.updateProfile({ name: trimmed, avatarEmoji });
      updateUser({ ...user!, name: trimmed, avatarEmoji });
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile');
      setBusy(null);
    }
  }

  return (
    <AuroraBackground confetti={false}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Pick your look</Text>
            <Text style={styles.subtitle}>So people spot you on the guest list</Text>

            <View style={styles.heroWrap}>
              <View style={styles.glowRing} />
              <Avatar emoji={avatarEmoji} size={140} />
            </View>

            <View style={styles.grid}>
              {EMOJI_CHOICES.map((emoji) => {
                const selected = emoji === avatarEmoji;
                return (
                  <Pressable
                    key={emoji}
                    onPress={() => setAvatarEmoji(emoji)}
                    style={({ pressed }) => [
                      styles.chip,
                      selected && styles.chipSelected,
                      pressed && styles.chipPressed,
                    ]}
                  >
                    <Text style={styles.chipEmoji}>{emoji}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Field
              label="Your name"
              placeholder="How friends know you"
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (error) setError(null);
              }}
              maxLength={80}
              autoCapitalize="words"
              returnKeyType="done"
              style={styles.nameInput}
            />

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>Pro tip 💡</Text>
              <Text style={styles.tipBody}>
                People with a face on the guest list get invited way more often 😉
              </Text>
            </View>

            <ErrorText message={error} />
            <View style={{ flex: 1 }} />

            <Button
              title="Let's party 🎉"
              onPress={() => finish()}
              loading={busy === 'save'}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    color: 'rgba(247,245,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
  },
  heroWrap: {
    alignSelf: 'center',
    width: 172,
    height: 172,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  glowRing: {
    position: 'absolute',
    width: 172,
    height: 172,
    borderRadius: 86,
    backgroundColor: 'rgba(180,140,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(180,140,255,0.35)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  chip: {
    width: '15%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: 'rgba(14,11,22,0.45)',
    borderWidth: 2,
    borderColor: 'rgba(247,245,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(180,140,255,0.25)',
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipEmoji: {
    fontSize: 26,
  },
  nameInput: {
    backgroundColor: 'rgba(14,11,22,0.55)',
    borderColor: 'rgba(247,245,255,0.25)',
    color: '#fff',
  },
  tipCard: {
    backgroundColor: 'rgba(14,11,22,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(247,245,255,0.15)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  tipTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  tipBody: {
    color: 'rgba(247,245,255,0.75)',
    fontSize: 14,
    lineHeight: 20,
  },
});
