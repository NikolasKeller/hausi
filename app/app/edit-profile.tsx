import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LIMITS } from '../shared/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { pickAvatarImage } from '../lib/imageUpload';
import { colors, radius, spacing } from '../lib/theme';
import { display, kicker, uiText } from '../lib/fonts';
import { Avatar } from '../components/Avatar';
import { Button, ErrorText, Field } from '../components/ui';
import { CityPicker } from '../components/CityPicker';

const AVATARS = ['🎉', '🦄', '🕺', '🌸', '🐙', '🪩', '🌈', '🍕', '👽', '🔥', '🐸', '💫'];

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('🎉');
  const [avatarImage, setAvatarImage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [city, setCity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.myProfile();
        if (!active) return;
        setName(res.profile.name);
        setAvatarEmoji(res.profile.avatarEmoji);
        setAvatarImage(res.profile.avatarImage);
        setCity(res.profile.city);
        setLoaded(true);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Could not load profile');
        setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function pickPhoto(source: 'library' | 'camera') {
    return async () => {
      if (uploading) return;
      setUploading(true);
      try {
        const url = await pickAvatarImage(source);
        if (url) setAvatarImage(url);
      } finally {
        setUploading(false);
      }
    };
  }

  async function save() {
    // Don't save mid-upload — we'd persist the profile without the photo still
    // in flight and orphan the file.
    if (uploading) return;
    if (!name.trim()) {
      setError('Name cannot be empty');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await api.updateProfile({
        name: name.trim(),
        avatarEmoji,
        avatarImage,
        city: city.trim(),
      });
      if (user) {
        updateUser({
          ...user,
          name: res.user.name,
          avatarEmoji: res.user.avatarEmoji,
          avatarImage: res.user.avatarImage,
        });
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile');
      setSaving(false);
    }
  }

  const photoPillStyle = ({ pressed }: { pressed: boolean }) => [
    styles.photoPill,
    pressed && styles.photoPillPressed,
    uploading && styles.photoPillDisabled,
  ];

  if (!loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.kicker}>Your profile</Text>
          <Text style={styles.title}>
            Edit profile
          </Text>
        </View>

        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          maxLength={LIMITS.name}
        />

        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label}>Profile pic</Text>
          <View style={styles.photoRow}>
            <View>
              <Avatar emoji={avatarEmoji} image={avatarImage} size={72} />
              {uploading && (
                <View style={styles.photoSpinner}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              )}
            </View>
            <View style={styles.photoActions}>
              {/* Native only: on desktop web the camera opens the same plain
                  file dialog as the library, so it'd be a confusing duplicate. */}
              {Platform.OS !== 'web' && (
                <Pressable
                  onPress={pickPhoto('camera')}
                  disabled={uploading}
                  style={photoPillStyle}
                >
                  <Text style={styles.photoPillText}>📸 Take a pic</Text>
                </Pressable>
              )}
              <Pressable
                onPress={pickPhoto('library')}
                disabled={uploading}
                style={photoPillStyle}
              >
                <Text style={styles.photoPillText}>🖼️ Pick a photo</Text>
              </Pressable>
              {!!avatarImage && (
                <Pressable
                  onPress={() => setAvatarImage('')}
                  disabled={uploading}
                  style={photoPillStyle}
                >
                  <Text style={styles.photoPillText}>✕ Back to emoji</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label}>Or go full emoji</Text>
          <View style={styles.avatarGrid}>
            {AVATARS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => {
                  setAvatarEmoji(emoji);
                  // Picking an emoji is an explicit "use this instead" —
                  // otherwise the choice would be invisible behind the photo.
                  setAvatarImage('');
                }}
                style={[
                  styles.avatarChip,
                  avatarEmoji === emoji && !avatarImage && styles.avatarChipActive,
                ]}
              >
                <Text style={{ fontSize: 26 }}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <CityPicker label="City" value={city} onChange={setCity} />

        <ErrorText message={error} />
        <Button
          title="Save"
          onPress={save}
          loading={saving}
          disabled={uploading}
          variant="primary"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  kicker: {
    ...kicker(colors.muted),
  },
  title: {
    ...display(44),
    color: colors.text,
  },
  label: {
    ...uiText(13, '700'),
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  photoSpinner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
    backgroundColor: 'rgba(249,246,241,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  avatarChip: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.card,
  },
});
