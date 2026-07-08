import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import type { DeliveryChannel } from '../../shared/types';
import { useAuth } from '../../lib/auth';
import { colors, radius, shadow, spacing } from '../../lib/theme';
import { display, uiText } from '../../lib/fonts';
import { AuroraBackground } from '../../components/AuroraBackground';
import { Button, ErrorText } from '../../components/ui';

const RESEND_SECONDS = 30;

export default function CodeScreen() {
  const { phone, email, devCode, channel } = useLocalSearchParams<{
    phone: string;
    email?: string;
    devCode?: string;
    channel?: string;
  }>();
  const router = useRouter();
  const deliveryChannel: DeliveryChannel =
    channel === 'whatsapp' ? 'whatsapp' : channel === 'email' ? 'email' : 'sms';
  const viaEmail = deliveryChannel === 'email';
  // The contact used to verify: an email for the email channel, else the phone.
  const contact = viaEmail ? email ?? '' : phone;
  const channelLabel = viaEmail ? 'Email' : deliveryChannel === 'whatsapp' ? 'WhatsApp' : 'SMS';
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
    if (entered.length !== 6 || busy || !contact) return;
    setBusy(true);
    setError(null);
    try {
      // The root guard routes: new users → /setup, returning users → home.
      await verifyPhone(contact, entered, deliveryChannel);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
      setBusy(false);
    }
  }

  async function resend() {
    if (resendIn > 0 || !contact) return;
    try {
      const res = await api.requestPhoneCode(contact, { channel: deliveryChannel });
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
              <Text style={styles.bannerFrom}>iykyk (dev preview)</Text>
              <Text style={styles.bannerText}>
                {currentDevCode} is your iykyk verification code
              </Text>
            </View>
            <Text style={styles.bannerNow}>now</Text>
          </Animated.View>
        ) : null}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Plain chevron back button (no text) — decrowds the screen; it
                still returns to the phone/method step. */}
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/phone'))}
              hitSlop={10}
              style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Text
              style={styles.title}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {viaEmail ? 'Verify your email' : 'Verify your phone'}
            </Text>
            <Text style={styles.subtitle}>
              We sent {contact ? `${contact} ` : ''}a code via {channelLabel}
            </Text>

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
              style={[styles.codeInput, styles.noOutline]}
              maxLength={6}
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
            />

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
            <View style={{ height: spacing.xl }} />
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
    paddingTop: spacing.lg,
    // Roomier vertical rhythm so the screen never feels crowded.
    gap: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    ...display(40),
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    ...uiText(16, '400'),
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  codeInput: {
    color: colors.text,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: spacing.md,
    fontSize: 36,
    letterSpacing: 14,
    textAlign: 'center',
    // letterSpacing also adds a trailing gap after the last digit, which shifts
    // the glyphs left of true center; a matching left pad re-centers them so the
    // "Resend code" line below lines up with the middle of the six digits.
    paddingLeft: 14,
    fontWeight: '700',
  },
  // Kill the browser's focus ring / native input chrome on web.
  noOutline:
    Platform.OS === 'web'
      ? ({ outlineStyle: 'none', outlineWidth: 0, appearance: 'none', border: 'none', background: 'transparent' } as any)
      : {},
  resend: {
    color: colors.muted,
    ...uiText(14, '500'),
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
