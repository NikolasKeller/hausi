import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { LIMITS, type EventDetail } from '../../../shared/types';
import { api } from '../../../lib/api';
import { notify } from '../../../lib/dialogs';
import { colors, light, radius, shadow, spacing } from '../../../lib/theme';
import { display, kicker, uiText } from '../../../lib/fonts';
import { ScreenBackground } from '../../../components/ScreenBackground';
import { Button, ErrorText } from '../../../components/ui';

// In-app "text blast" composer: the host writes an update here (no native
// compose sheet), and on send the server posts it to the event page AND texts
// every guest automatically — no per-message confirmation in Messages.
export default function BlastScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!slug || event) return;
      api
        .eventBySlug(slug)
        .then((res) => {
          if (!res.event.canManage) {
            setLoadError('Only hosts can send a text blast');
            return;
          }
          setEvent(res.event);
          setLoadError(null);
        })
        .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load event'));
    }, [slug, event])
  );

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace(`/event/${slug}`);
  }

  async function send() {
    if (!event || sending) return;
    if (!text.trim()) {
      setError('Write something to blast 📣');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await api.sendBlast(event.id, text.trim());
      // Report what actually went out (res.sent), not just who we targeted —
      // with no SMS provider the blast still lands on the event page.
      notify(
        'Blast sent 📣',
        res.sent > 0
          ? `${res.sent} guest${res.sent === 1 ? '' : 's'} just got a text 🎉`
          : 'Posted to your event page — everyone will see it.'
      );
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the blast');
      setSending(false);
    }
  }

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.header}>
          <Pressable onPress={close} hitSlop={10} style={styles.close}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.titleBlock}>
            <Text style={styles.kicker}>📣 Text Blast</Text>
            <Text style={styles.title}>Send an update</Text>
            {event ? (
              <Text style={styles.sub}>
                Everyone on “{event.title}” gets this as a text — no need to open Messages. It also
                lands on the event page.
              </Text>
            ) : null}
          </View>

          {loadError ? (
            <Text style={styles.loadError}>{loadError}</Text>
          ) : !event ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <>
              <View style={styles.inputCard}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Running 15 min late — grab a drink and settle in! 🍹"
                  placeholderTextColor={colors.muted}
                  multiline
                  maxLength={LIMITS.blast}
                  autoFocus
                  style={styles.input}
                />
              </View>
              <Text style={styles.counter}>
                {text.length}/{LIMITS.blast}
              </Text>

              <ErrorText message={error} />
              <Button
                title="Send blast 📣"
                onPress={send}
                loading={sending}
                disabled={!text.trim()}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.card,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
    paddingBottom: spacing.section,
  },
  titleBlock: {
    gap: spacing.xs,
  },
  kicker: {
    ...kicker(light.text3),
  },
  title: {
    ...display(32),
    color: colors.text,
  },
  sub: {
    ...uiText(14, '500', { lineHeight: 1.4 }),
    color: light.text3,
    marginTop: 2,
  },
  inputCard: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    ...shadow.card,
  },
  input: {
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 160,
    textAlignVertical: 'top',
  },
  counter: {
    ...uiText(12, '600'),
    color: light.text3,
    textAlign: 'right',
    marginTop: -spacing.xs,
  },
  loadError: {
    ...uiText(16, '600'),
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  loading: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
});
