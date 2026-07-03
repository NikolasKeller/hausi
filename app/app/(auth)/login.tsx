import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../lib/auth';
import { colors, spacing } from '../../lib/theme';
import { Button, ErrorText, Field } from '../../components/ui';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter your email and password');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoBlock}>
          <Text style={styles.logoEmoji}>🏠</Text>
          <LinearGradient
            colors={['#B48CFF', '#FF6EC4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logoUnderline}
          />
          <Text style={styles.logo}>Hausi</Text>
          <Text style={styles.tagline}>Parties worth showing up for</Text>
        </View>

        <View style={styles.form}>
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
            placeholder="••••••••"
            secureTextEntry
          />
          <ErrorText message={error} />
          <Button title="Log in" onPress={submit} loading={loading} />
          <Link href="/signup" style={styles.link}>
            New here? <Text style={styles.linkAccent}>Create an account</Text>
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
    gap: spacing.xl,
  },
  logoBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  logoEmoji: {
    fontSize: 44,
  },
  logo: {
    color: colors.text,
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -2,
  },
  logoUnderline: {
    width: 80,
    height: 4,
    borderRadius: 2,
  },
  tagline: {
    color: colors.muted,
    fontSize: 15,
  },
  form: {
    gap: spacing.md,
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
