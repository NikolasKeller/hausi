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
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, radius, spacing } from '../lib/theme';
import { display, kicker, uiText } from '../lib/fonts';
import { Burst, Seal } from '../components/partiful';
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
      <LinearGradient
        colors={['#12102A', '#3E2273', '#B23A8F', '#FF9A6C']}
        locations={[0, 0.42, 0.78, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Scattered poster stickers, decorative only. */}
      <Burst
        size={92}
        rays={8}
        color={colors.helio}
        rotate={12}
        style={styles.decorTopRight}
      />
      <Burst
        size={58}
        rays={6}
        color={colors.accent}
        rotate={-14}
        style={styles.decorLeft}
      />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.kicker}>WELCOME TO THE PARTY</Text>
            <Text style={styles.title}>Pick your look</Text>

            <View style={styles.faceWrap}>
              <Pressable
                onPress={() => setFaceIndex((i) => (i + 1) % FACES.length)}
                style={({ pressed }) => [pressed && styles.facePressed]}
              >
                <Seal size={220} color="rgba(255,255,255,0.14)" rotate={-6}>
                  <View style={styles.faceInner}>
                    <Text style={styles.faceEmoji}>{face}</Text>
                  </View>
                </Seal>
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
              placeholderTextColor="rgba(255,255,255,0.55)"
              maxLength={80}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={finish}
              style={styles.nameInput}
            />
            <ErrorText message={error} />

            <View style={{ flex: 1 }} />
            <Button title="Let's party 🎉" onPress={finish} loading={busy} variant="vibrant" />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#12102A',
  },
  decorTopRight: {
    position: 'absolute',
    top: 40,
    right: -18,
    opacity: 0.9,
  },
  decorLeft: {
    position: 'absolute',
    top: 220,
    left: -20,
    opacity: 0.85,
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
    ...kicker('rgba(255,255,255,0.75)'),
    textAlign: 'center',
  },
  title: {
    ...display(64),
    color: '#fff',
    textAlign: 'center',
  },
  faceWrap: {
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  faceInner: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '6deg' }],
  },
  facePressed: {
    transform: [{ scale: 0.96 }],
  },
  faceEmoji: {
    fontSize: 112,
  },
  hint: {
    ...uiText(14, '600'),
    color: 'rgba(255,255,255,0.7)',
  },
  nameInput: {
    backgroundColor: 'rgba(14,11,22,0.4)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: radius.md,
    color: '#fff',
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    ...uiText(18, '600'),
    textAlign: 'center',
  },
});
