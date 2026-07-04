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
import { radius, spacing } from '../lib/theme';
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
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Pick your look</Text>

            <View style={styles.faceWrap}>
              <Pressable
                onPress={() => setFaceIndex((i) => (i + 1) % FACES.length)}
                style={({ pressed }) => [styles.face, pressed && styles.facePressed]}
              >
                <Text style={styles.faceEmoji}>{face}</Text>
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
            <Button title="Let's party 🎉" onPress={finish} loading={busy} />
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
  safe: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl * 2,
    gap: spacing.lg,
  },
  title: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -1,
  },
  faceWrap: {
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  face: {
    width: 208,
    height: 208,
    borderRadius: 104,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  facePressed: {
    transform: [{ scale: 0.96 }],
  },
  faceEmoji: {
    fontSize: 112,
  },
  hint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  nameInput: {
    backgroundColor: 'rgba(14,11,22,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.md,
    color: '#fff',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 18,
    textAlign: 'center',
  },
});
