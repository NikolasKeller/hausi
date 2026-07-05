import React, { useEffect, useState } from 'react';
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
import { api } from '../../lib/api';
import { colors, radius, shadow, spacing } from '../../lib/theme';
import { display, kicker, uiText } from '../../lib/fonts';
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

export default function PhoneScreen() {
  const router = useRouter();
  const [countryIndex, setCountryIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [digits, setDigits] = useState('');
  const [invite, setInvite] = useState('');
  const [inviteRequired, setInviteRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // The host may gate signup behind a shared invite code; ask the server.
  useEffect(() => {
    api
      .config()
      .then((cfg) => setInviteRequired(cfg.inviteRequired))
      .catch(() => {});
  }, []);

  const country = COUNTRY_CODES[countryIndex];
  const phone = `${country.code}${digits.replace(/[^0-9]/g, '')}`;
  const valid =
    /^\+[0-9]{7,15}$/.test(phone) && (!inviteRequired || invite.trim().length > 0);

  async function sendCode() {
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.requestPhoneCode(phone, invite.trim() || undefined);
      router.push({
        pathname: '/code',
        params: { phone, devCode: res.devCode ?? '' },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the code');
    } finally {
      setSending(false);
    }
  }

  return (
    <AuroraBackground confetti={false}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.kicker}>Step 1 of 2</Text>
            <Text style={styles.title}>
              Join the party
            </Text>
            <Text style={styles.subtitle}>Just for event updates. No spam.</Text>

            <View style={styles.card}>
              <View style={styles.phoneRow}>
                <Pressable style={styles.countryPill} onPress={() => setPickerOpen(!pickerOpen)}>
                  <Text style={styles.countryText}>
                    {country.flag} {country.code}
                  </Text>
                  <Text style={styles.countryCaret}>▾</Text>
                </Pressable>
                <TextInput
                  value={digits}
                  onChangeText={(t) => setDigits(t.replace(/[^0-9 ]/g, ''))}
                  placeholder="Phone number"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  autoFocus
                  style={styles.phoneInput}
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
            </View>

            <ErrorText message={error} />
            <View style={{ flex: 1 }} />

            <Text style={styles.smallPrint}>
              By tapping “Send code” you agree to get a one-time text with your login code.
              Message and data rates may apply.
            </Text>
            <Button
              title={sending ? 'Sending…' : 'Send code'}
              variant="primary"
              onPress={sendCode}
              loading={sending}
              style={valid ? undefined : styles.buttonDisabled}
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
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  countryText: {
    color: colors.text,
    ...uiText(16, '600'),
  },
  countryCaret: {
    color: colors.muted,
    fontSize: 12,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: 18,
    paddingVertical: 12,
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
  smallPrint: {
    color: colors.muted,
    ...uiText(12, '400', { lineHeight: 1.4 }),
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
