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
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { COUNTRIES, DEFAULT_COUNTRY, type Country } from '../../lib/countries';
import { colors, radius, spacing } from '../../lib/theme';
import { display, uiText } from '../../lib/fonts';
import { AuroraBackground } from '../../components/AuroraBackground';
import { Glass } from '../../components/glass';
import { Button, ErrorText } from '../../components/ui';

export default function PhoneScreen() {
  const router = useRouter();
  // Germany is the default; the picker lets the user search for any other.
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [prefixSearch, setPrefixSearch] = useState('');
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

  const phone = `${country.code}${digits.replace(/[^0-9]/g, '')}`;
  const phoneValid = /^\+[0-9]{7,15}$/.test(phone);
  const inviteOk = !inviteRequired || invite.trim().length > 0;
  const canSubmit = phoneValid && inviteOk;

  // Filter the country list by name or dial code (with or without the "+").
  const q = prefixSearch.trim().toLowerCase();
  const filteredCountries = q
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.replace('+', '').includes(q.replace('+', ''))
      )
    : COUNTRIES;

  async function sendCode() {
    if (sending) return;
    if (!phoneValid) {
      setError('Enter a valid phone number');
      return;
    }
    if (!inviteOk) {
      setError('Enter the invite code');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await api.requestPhoneCode(phone, {
        invite: invite.trim() || undefined,
      });
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
            <View style={styles.header}>
              <Text style={styles.kicker}>WELCOME</Text>
              <Text style={styles.title}>Join the party</Text>
              <Text style={styles.subtitle}>We'll text you a code to confirm it's you.</Text>
            </View>

            {/* Plain, borderless field — no card, just the country code and
                number sitting together as one row (not two floating pieces
                with a big gap between them like before). */}
            <View style={styles.phoneRow}>
              <Pressable
                style={styles.countrySeg}
                onPress={() => setPickerOpen((v) => !v)}
                hitSlop={10}
              >
                <Text style={styles.flag}>{country.flag}</Text>
                <Text style={styles.code}>{country.code}</Text>
                <Ionicons
                  name={pickerOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.muted}
                />
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
            <View style={styles.phoneUnderline} />

            {pickerOpen ? (
              <Glass radius={radius.lg} intensity={24} tint="dark" style={styles.picker}>
                <TextInput
                  value={prefixSearch}
                  onChangeText={setPrefixSearch}
                  placeholder="Search country or code…"
                  placeholderTextColor={colors.muted}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.pickerSearch, styles.noOutline]}
                />
                <ScrollView
                  style={styles.pickerScroll}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {filteredCountries.map((c) => {
                    const active = c.name === country.name;
                    return (
                      <Pressable
                        key={c.name}
                        onPress={() => {
                          setCountry(c);
                          setPickerOpen(false);
                          setPrefixSearch('');
                        }}
                        style={[styles.pickerItem, active && styles.pickerItemActive]}
                      >
                        <Text style={styles.pickerFlag}>{c.flag}</Text>
                        <Text style={styles.pickerName} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={styles.pickerCode}>{c.code}</Text>
                      </Pressable>
                    );
                  })}
                  {filteredCountries.length === 0 ? (
                    <Text style={styles.pickerEmpty}>No match</Text>
                  ) : null}
                </ScrollView>
              </Glass>
            ) : null}

            {inviteRequired ? (
              <Glass radius={radius.lg} intensity={24} tint="dark" style={styles.inviteCard}>
                <TextInput
                  value={invite}
                  onChangeText={setInvite}
                  placeholder="Invite code"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.inviteInput, styles.noOutline]}
                />
              </Glass>
            ) : null}

            <ErrorText message={error} />
            <View style={{ flex: 1, minHeight: spacing.xxl }} />

            <Button
              title={sending ? 'Sending…' : 'Send code'}
              variant="chrome"
              onPress={sendCode}
              loading={sending}
              disabled={!canSubmit || sending}
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
    paddingTop: spacing.section,
    gap: spacing.md,
  },
  header: {
    gap: 6,
    marginBottom: spacing.sm,
  },
  kicker: {
    color: colors.muted,
    ...uiText(12, '700'),
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    ...display(36),
  },
  subtitle: {
    color: colors.muted,
    ...uiText(15, '500'),
  },
  // Plain borderless row — country code + number sit together, no card.
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countrySeg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  flag: {
    fontSize: 20,
  },
  code: {
    color: colors.text,
    ...uiText(22, '600'),
  },
  // Borderless inline phone field — plain text on the canvas, no own box.
  phoneInputInline: {
    flex: 1,
    ...uiText(22, '600'),
    color: colors.text,
    lineHeight: 27,
    paddingVertical: 10,
  },
  // A single hairline beneath the row is the only anchor — enough to read as
  // one field without a card/border boxing it in.
  phoneUnderline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginTop: 2,
  },
  // Kill the browser's blue focus ring on web (react-native-web maps these).
  noOutline: Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : {},
  // Searchable country-code picker — a glass card matching the field above.
  picker: {
    overflow: 'hidden',
  },
  pickerSearch: {
    ...uiText(16),
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  pickerScroll: {
    maxHeight: 260,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  pickerItemActive: {
    backgroundColor: colors.inputBg,
  },
  pickerFlag: {
    fontSize: 20,
  },
  pickerName: {
    flex: 1,
    color: colors.text,
    ...uiText(15, '500'),
  },
  pickerCode: {
    color: colors.muted,
    ...uiText(15, '600'),
  },
  pickerEmpty: {
    color: colors.muted,
    ...uiText(14),
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  inviteCard: {
    overflow: 'hidden',
  },
  inviteInput: {
    paddingHorizontal: spacing.md,
    ...uiText(16, '500'),
    color: colors.text,
    lineHeight: 20,
    paddingVertical: 15,
  },
});
