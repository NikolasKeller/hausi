import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { colors, radius, shadow, spacing } from '../../lib/theme';
import { display, kicker, uiText } from '../../lib/fonts';
import { AuroraBackground } from '../../components/AuroraBackground';
import { Button, ErrorText } from '../../components/ui';

const RESEND_SECONDS = 30;

export default function CodeScreen() {
  const { phone, devCode } = useLocalSearchParams<{ phone: string; devCode?: string }>();
  const { verifyPhone } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [currentDevCode, setCurrentDevCode] = useState(devCode ?? '');
  const bannerY = useRef(new Animated.Value(-120)).current;

  // Tick down the resend timer.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Simulated text-message banner (dev only, until real SMS/Supabase auth).
  useEffect(() => {
    if (!currentDevCode) return;
    bannerY.setValue(-120);
    Animated.spring(bannerY, {
      toValue: 0,
      useNativeDriver: Platform.OS !== 'web',
      damping: 14,
    }).start();
  }, [currentDevCode, bannerY]);

  async function submit(value?: string) {
    const entered = (value ?? code).trim();
    if (entered.length !== 6 || busy || !phone) return;
    setBusy(true);
    setError(null);
    try {
      // The root guard routes: new users → /setup, returning users → home.
      await verifyPhone(phone, entered);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
      setBusy(false);
    }
  }

  async function resend() {
    if (resendIn > 0 || !phone) return;
    try {
      const res = await api.requestPhoneCode(phone);
      setCurrentDevCode(res.devCode ?? '');
      setResendIn(RESEND_SECONDS);
      setCode('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resend the code');
    }
  }

  return (
    <AuroraBackground confetti={false}>
      <SafeAreaView style={styles.safe}>
        {currentDevCode ? (
          <Animated.View style={[styles.banner, { transform: [{ translateY: bannerY }] }]}>
            <View style={styles.bannerIcon}>
              <Text style={{ fontSize: 18 }}>💬</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerFrom}>Hausi (dev preview)</Text>
              <Text style={styles.bannerText}>
                {currentDevCode} is your Hausi verification code
              </Text>
            </View>
            <Text style={styles.bannerNow}>now</Text>
          </Animated.View>
        ) : null}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.kicker}>Step 2 of 2</Text>
            <Text style={styles.title}>
              Verify your phone
            </Text>
            <Text style={styles.subtitle}>We sent {phone} a code via SMS</Text>

            <View style={styles.card}>
              <TextInput
                value={code}
                onChangeText={(t) => {
                  const clean = t.replace(/[^0-9]/g, '').slice(0, 6);
                  setCode(clean);
                  if (clean.length === 6) submit(clean);
                }}
                placeholder="000000"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                autoFocus
                style={styles.codeInput}
                maxLength={6}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
              />
            </View>

            <Text style={styles.resend} onPress={resend}>
              {resendIn > 0
                ? `Didn't receive your code? Resend it in ${resendIn}s`
                : 'Resend code'}
            </Text>

            <ErrorText message={error} />
            <View style={{ flex: 1 }} />
            <Button
              title={busy ? 'Verifying…' : 'Next'}
              variant="primary"
              onPress={() => submit()}
              loading={busy}
              style={code.length === 6 ? undefined : styles.buttonDisabled}
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  bannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerFrom: {
    color: colors.muted,
    ...uiText(12, '700'),
  },
  bannerText: {
    color: colors.text,
    ...uiText(14, '500'),
  },
  bannerNow: {
    color: colors.muted,
    ...uiText(12, '400'),
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl * 2,
    gap: spacing.md,
  },
  kicker: {
    ...kicker(colors.muted),
    textAlign: 'center',
  },
  title: {
    color: colors.text,
    ...display(56),
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    ...uiText(16, '400'),
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    ...shadow.card,
  },
  codeInput: {
    color: colors.text,
    paddingVertical: spacing.sm,
    fontSize: 36,
    letterSpacing: 14,
    textAlign: 'center',
    fontWeight: '700',
  },
  resend: {
    color: colors.muted,
    ...uiText(14, '500'),
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
