import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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
import { pickAvatarImage } from '../lib/imageUpload';
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
  const [photo, setPhoto] = useState(user?.avatarImage ?? '');
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const face = FACES[faceIndex];

  async function addPhoto(source: 'library' | 'camera') {
    if (uploading) return;
    setUploading(true);
    try {
      const url = await pickAvatarImage(source);
      if (url) setPhoto(url);
    } finally {
      setUploading(false);
    }
  }

  const photoPillStyle = ({ pressed }: { pressed: boolean }) => [
    styles.photoPill,
    pressed && styles.photoPillPressed,
    uploading && styles.photoPillDisabled,
  ];

  // Onboarding is mandatory: no skip — a name is required to enter the app.
  async function finish() {
    // Don't submit while a photo is still uploading — we'd save without it.
    if (busy || uploading) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Tell us your name first');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updateProfile({ name: trimmed, avatarEmoji: face, avatarImage: photo });
      updateUser({ ...user!, name: trimmed, avatarEmoji: face, avatarImage: photo });
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
                onPress={() =>
                  photo ? addPhoto('library') : setFaceIndex((i) => (i + 1) % FACES.length)
                }
                style={({ pressed }) => [pressed && styles.facePressed]}
              >
                <Avatar emoji={face} image={photo} size={168} />
              </Pressable>
              <Text style={styles.hint}>
                {uploading
                  ? 'Uploading your fabulous face…'
                  : photo
                    ? 'Lookin’ ready to party ✨'
                    : 'Tap the face to change it'}
              </Text>
              <View style={styles.photoActions}>
                {/* Native only: web's "camera" is the same file dialog as the
                    library, so it'd just be a confusing duplicate button. */}
                {Platform.OS !== 'web' && (
                  <Pressable
                    onPress={() => addPhoto('camera')}
                    disabled={uploading}
                    style={photoPillStyle}
                  >
                    <Text style={styles.photoPillText}>📸 Snap a pic</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => addPhoto('library')}
                  disabled={uploading}
                  style={photoPillStyle}
                >
                  <Text style={styles.photoPillText}>
                    {photo ? '🖼️ Swap photo' : '🖼️ Add a photo'}
                  </Text>
                </Pressable>
                {!!photo && (
                  <Pressable
                    onPress={() => setPhoto('')}
                    disabled={uploading}
                    style={photoPillStyle}
                  >
                    <Text style={styles.photoPillText}>✕ Use an emoji</Text>
                  </Pressable>
                )}
              </View>
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
            <Button
              title="Continue"
              onPress={finish}
              loading={busy}
              disabled={uploading}
              variant="primary"
            />
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
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  photoPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  photoPillPressed: {
    opacity: 0.6,
  },
  photoPillDisabled: {
    opacity: 0.5,
  },
  photoPillText: {
    ...uiText(14, '600'),
    color: colors.text,
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
