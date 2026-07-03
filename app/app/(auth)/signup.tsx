import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { colors, radius, spacing } from '../../lib/theme';
import { Button, ErrorText, Field } from '../../components/ui';

const AVATARS = ['🎉', '🦄', '🕺', '🌸', '🐙', '🪩', '🌈', '🍕', '👽', '🔥', '🐸', '💫'];

export default function SignupScreen() {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('🎉');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim() || !email.trim() || !password) {
      setError('Fill in name, email and password');
      return;
    }
    if (password.length < 6) {
      setError('Password needs at least 6 characters');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signup({ name: name.trim(), email: email.trim(), password, avatarEmoji });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signup failed');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Join Hausi</Text>
          <Text style={styles.subtitle}>Your parties are waiting</Text>
        </View>

        <View style={styles.form}>
          <View style={{ gap: spacing.xs }}>
            <Text style={styles.label}>Pick your avatar</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => setAvatarEmoji(emoji)}
                  style={[styles.avatarChip, avatarEmoji === emoji && styles.avatarChipActive]}
                >
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="min. 6 characters"
            secureTextEntry
          />
          <ErrorText message={error} />
          <Button title="Create account" onPress={submit} loading={loading} />
          <Link href="/login" style={styles.link}>
            Already have an account? <Text style={styles.linkAccent}>Log in</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
  },
  form: {
    gap: spacing.md,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  avatarChip: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarChipActive: {
    borderColor: colors.accent,
  },
  link: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontSize: 15,
  },
  linkAccent: {
    color: colors.accent,
    fontWeight: '700',
  },
});
