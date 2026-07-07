import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import type { DeliveryChannel } from '../../shared/types';
import { colors, radius, spacing } from '../../lib/theme';
import { display, uiText } from '../../lib/fonts';
import { AuroraBackground } from '../../components/AuroraBackground';
import { Button, ErrorText } from '../../components/ui';

const COUNTRY_CODES = [
  { code: '+1', flag: '🇺🇸' },
  { code: '+49', flag: '🇩🇪' },
  { code: '+44', flag: '🇬🇧' },
  { code: '+33', flag: '🇫🇷' },
  { code: '+34', flag: '🇪🇸' },
  { code: '+39', flag: '🇮🇹' },
  { code: '+31', flag: '🇳🇱' },
  { code: '+43', flag: '🇦🇹' },
  { code: '+41', flag: '🇨🇭' },
] as const;

// WhatsApp's brand green — the one splash of a non-orange accent, mirroring the
// reference design's WhatsApp button.
const WHATSAPP_GREEN = '#25D366';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PhoneScreen() {
  const router = useRouter();
  const [countryIndex, setCountryIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [digits, setDigits] = useState('');
  const [email, setEmail] = useState('');
  // 'phone' covers the sms + whatsapp channels (both need a number); 'email'
  // swaps the number field for an email field.
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [invite, setInvite] = useState('');
  const [inviteRequired, setInviteRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Which channel is mid-send, so only the tapped control shows a spinner.
  const [pendingChannel, setPendingChannel] = useState<DeliveryChannel | null>(null);

  // The host may gate signup behind a shared invite code; ask the server.
  useEffect(() => {
    api
      .config()
      .then((cfg) => setInviteRequired(cfg.inviteRequired))
      .catch(() => {});
  }, []);

  const country = COUNTRY_CODES[countryIndex];
  const phone = `${country.code}${digits.replace(/[^0-9]/g, '')}`;
  const phoneValid = /^\+[0-9]{7,15}$/.test(phone);
  const emailValid = EMAIL_RE.test(email.trim());
  const inviteOk = !inviteRequired || invite.trim().length > 0;

  async function sendCode(channel: DeliveryChannel) {
    if (sending) return;
    const contact = channel === 'email' ? email.trim().toLowerCase() : phone;
    if (channel === 'email' ? !emailValid : !phoneValid) {
      setError(channel === 'email' ? 'Enter a valid email' : 'Enter a valid phone number');
      return;
    }
    if (!inviteOk) {
      setError('Enter the invite code');
      return;
    }
    setSending(true);
    setPendingChannel(channel);
    setError(null);
    try {
      const res = await api.requestPhoneCode(contact, {
        invite: invite.trim() || undefined,
        channel,
      });
      router.push({
        pathname: '/code',
        params: {
          phone: channel === 'email' ? '' : phone,
          email: channel === 'email' ? contact : '',
          devCode: res.devCode ?? '',
          channel,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the code');
    } finally {
      setSending(false);
      setPendingChannel(null);
    }
  }

  function onWhatsApp() {
    if (sending) return;
    // WhatsApp needs a phone number; make sure we're on the phone field first.
    if (mode === 'email') {
      setMode('phone');
      setError('Enter your number, then tap WhatsApp');
      return;
    }
    sendCode('whatsapp');
  }

  function onEmail() {
    if (sending) return;
    setMode('email');
    setPickerOpen(false);
    setError(null);
  }

  const primaryChannel: DeliveryChannel = mode === 'email' ? 'email' : 'sms';
  const canSubmit = mode === 'email' ? emailValid && inviteOk : phoneValid && inviteOk;

  return (
    <AuroraBackground confetti={false}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flex: 0.5 }} />
            <Text style={styles.title}>Join the party</Text>

            <View style={styles.channelRow}>
              <Pressable
                onPress={onEmail}
                disabled={sending}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.channelBtn,
                  mode === 'email' && styles.channelBtnActive,
                  pressed && styles.channelPressed,
                  sending && styles.channelDisabled,
                ]}
              >
                {pendingChannel === 'email' ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Ionicons name="mail-outline" size={26} color={colors.text} />
                )}
              </Pressable>

              <Pressable
                onPress={onWhatsApp}
                disabled={sending}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.channelBtn,
                  styles.channelBtnWhatsapp,
                  pressed && styles.channelPressed,
                  sending && styles.channelDisabled,
                ]}
              >
                {pendingChannel === 'whatsapp' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="logo-whatsapp" size={28} color="#FFFFFF" />
                )}
              </Pressable>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {mode === 'email' ? (
              <>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@email.com"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  style={[styles.phoneInput, styles.noOutline]}
                />
                <Text style={styles.switchLink} onPress={() => setMode('phone')}>
                  Use phone number instead
                </Text>
              </>
            ) : (
              <>
                <View style={styles.phoneRow}>
                  <Pressable
                    style={styles.countryInline}
                    onPress={() => setPickerOpen(!pickerOpen)}
                    hitSlop={10}
                  >
                    <Text style={styles.phonePrefix}>{country.code}</Text>
                    <Text style={styles.phoneCaret}>▾</Text>
                  </Pressable>
                  <TextInput
                    value={digits}
                    onChangeText={(t) => setDigits(t.replace(/[^0-9 ]/g, ''))}
                    placeholder="(123) 456-7890"
                    placeholderTextColor={colors.muted}
                    keyboardType="phone-pad"
                    autoFocus
                    style={[styles.phoneInputInline, styles.noOutline]}
                    maxLength={16}
                  />
                </View>

                {pickerOpen ? (
                  <View style={styles.picker}>
                    {COUNTRY_CODES.map((c, i) => (
                      <Pressable
                        key={c.code}
                        onPress={() => {
                          setCountryIndex(i);
                          setPickerOpen(false);
                        }}
                        style={[styles.pickerItem, i === countryIndex && styles.pickerItemActive]}
                      >
                        <Text style={styles.pickerText}>
                          {c.flag} {c.code}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            )}

            {inviteRequired ? (
              <TextInput
                value={invite}
                onChangeText={setInvite}
                placeholder="Invite code"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.phoneInput}
              />
            ) : null}

            <ErrorText message={error} />
            <View style={{ flex: 1 }} />

            <Button
              title={pendingChannel === primaryChannel ? 'Sending…' : 'Send code'}
              variant="primary"
              onPress={() => sendCode(primaryChannel)}
              loading={pendingChannel === primaryChannel}
              disabled={sending}
              style={canSubmit ? undefined : styles.buttonDisabled}
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
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    ...display(56),
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  // Round icon buttons for the alternate delivery channels (email + WhatsApp).
  channelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  channelBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  channelBtnActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(255,106,43,0.14)',
  },
  channelBtnWhatsapp: {
    backgroundColor: WHATSAPP_GREEN,
    borderColor: WHATSAPP_GREEN,
  },
  channelPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  channelDisabled: {
    opacity: 0.5,
  },
  // "—— or ——" divider between the round buttons and the phone/email flow.
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  dividerText: {
    color: colors.muted,
    ...uiText(14, '500'),
  },
  switchLink: {
    color: colors.muted,
    ...uiText(14, '500'),
    textAlign: 'center',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  // Borderless inline country prefix (e.g. "+1 ▾") — no box/bubble.
  countryInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  phonePrefix: {
    color: colors.text,
    ...uiText(30),
  },
  phoneCaret: {
    color: colors.muted,
    fontSize: 14,
  },
  // Borderless inline phone field — plain text on the canvas, no box.
  phoneInputInline: {
    flex: 1,
    ...uiText(30),
    color: colors.text,
    lineHeight: 38,
    textAlign: 'center',
    paddingVertical: 6,
  },
  // Kill the browser's blue focus ring on web (react-native-web maps these).
  noOutline: Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : {},
  phoneInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    ...uiText(18),
    color: colors.text,
    // Keep the box height comfortable; uiText's lineHeight can clip on web.
    lineHeight: 22,
    paddingVertical: 14,
  },
  picker: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  pickerItemActive: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  pickerText: {
    color: colors.text,
    ...uiText(15, '500'),
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
