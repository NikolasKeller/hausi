import React, { useEffect, useState } from 'react';
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
import { api } from '../../lib/api';
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
            <View style={{ flex: 0.5 }} />
            <Text style={styles.title}>
              Join the party
            </Text>

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
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    ...display(56),
    textAlign: 'center',
    marginBottom: spacing.lg,
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
