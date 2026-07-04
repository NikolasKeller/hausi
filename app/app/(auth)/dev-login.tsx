import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { AuroraBackground } from '../../components/AuroraBackground';
import { uiText } from '../../lib/fonts';
import { colors } from '../../lib/theme';

// Dev-only: hausi://dev-login signs in as the Preview account so the app
// can be toured while the real SMS flow is under construction. In release
// builds (and against a server with real SMS) this just bounces to welcome.
export default function DevLoginScreen() {
  const router = useRouter();
  const { devSignIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!__DEV__) {
      router.replace('/welcome');
      return;
    }
    devSignIn().catch((e) => {
      setError(e instanceof Error ? e.message : 'Dev sign-in failed');
      setTimeout(() => router.replace('/welcome'), 1500);
    });
    // The root guard routes to home once the session lands.
  }, [devSignIn, router]);

  return (
    <AuroraBackground confetti={false}>
      <View style={styles.center}>
        {error ? (
          <Text style={styles.text}>{error}</Text>
        ) : (
          <>
            <ActivityIndicator color={colors.text} size="large" />
            <Text style={styles.text}>Signing in as Preview…</Text>
          </>
        )}
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    color: colors.muted,
    ...uiText(15, '500'),
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
