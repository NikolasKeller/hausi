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
import { colors, radius, spacing } from '../lib/theme';
import { display, kicker, uiText } from '../lib/fonts';
import { Button, ErrorText, Field } from '../components/ui';
import { CityPicker } from '../components/CityPicker';

const AVATARS = ['🎉', '🦄', '🕺', '🌸', '🐙', '🪩', '🌈', '🍕', '👽', '🔥', '🐸', '💫'];

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('🎉');
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

  async function save() {
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
        city: city.trim(),
      });
      if (user) {
        updateUser({ ...user, name: res.user.name, avatarEmoji: res.user.avatarEmoji });
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile');
      setSaving(false);
    }
  }

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
          <Text style={styles.label}>Avatar</Text>
          <View style={styles.avatarGrid}>
            {AVATARS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => setAvatarEmoji(emoji)}
                style={[styles.avatarChip, avatarEmoji === emoji && styles.avatarChipActive]}
              >
                <Text style={{ fontSize: 26 }}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <CityPicker label="City" value={city} onChange={setCity} />

        <ErrorText message={error} />
        <Button title="Save" onPress={save} loading={saving} variant="primary" />
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
