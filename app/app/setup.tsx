import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, radius, shadow, spacing } from '../lib/theme';
import { display, kicker, uiText } from '../lib/fonts';
import { Avatar } from '../components/Avatar';
import { Button, ErrorText } from '../components/ui';

// One face at a time: tapping the big face cycles through a short list
// instead of presenting a grid to scan.
const FACES = ['🎉', '😎', '🦄', '🔥', '🌈', '🪩'] as const;

export default function SetupScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();

  const [faceIndex, setFaceIndex] = useState(() =>
    Math.max(0, FACES.indexOf((user?.avatarEmoji ?? '') as (typeof FACES)[number]))
  );
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const face = FACES[faceIndex];

  // Onboarding is mandatory: no skip — a name is required to enter the app.
  async function finish() {
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Tell us your name first');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updateProfile({ name: trimmed, avatarEmoji: face });
      updateUser({ ...user!, name: trimmed, avatarEmoji: face });
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile');
      setBusy(false);
    }
  }

  return (
    <View style={styles.fill}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.kicker}>Welcome</Text>
            <Text style={styles.title}>
              Pick your look
            </Text>

            <View style={styles.faceWrap}>
              <Pressable
                onPress={() => setFaceIndex((i) => (i + 1) % FACES.length)}
                style={({ pressed }) => [pressed && styles.facePressed]}
              >
                <Avatar emoji={face} size={168} />
              </Pressable>
              <Text style={styles.hint}>Tap the face to change it</Text>
            </View>

            <TextInput
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (error) setError(null);
              }}
              placeholder="Your name"
              placeholderTextColor={colors.muted}
              maxLength={80}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={finish}
              style={styles.nameInput}
            />
            <ErrorText message={error} />

            <View style={{ flex: 1 }} />
            <Button title="Continue" onPress={finish} loading={busy} variant="primary" />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl * 2,
    gap: spacing.lg,
  },
  kicker: {
    ...kicker(colors.muted),
    textAlign: 'center',
  },
  title: {
    ...display(56),
    color: colors.text,
    textAlign: 'center',
  },
  faceWrap: {
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
  facePressed: {
    transform: [{ scale: 0.96 }],
  },
  hint: {
    ...uiText(14, '600'),
    color: colors.muted,
  },
  nameInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    ...uiText(18, '600'),
    textAlign: 'center',
    ...shadow.card,
  },
});
