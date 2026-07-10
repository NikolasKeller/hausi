import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { TicketJobInfo, WalletPass } from '../shared/types';
import { api, mediaUrl } from '../lib/api';
import { colors, radius, shadow, spacing } from '../lib/theme';
import { display, titleFontStyle, uiText } from '../lib/fonts';
import { ChromeText } from '../components/ChromeText';
import { Button } from '../components/ui';
import { CoverGradient } from '../components/CoverGradient';
import { formatEventDate, formatEventTime } from '../components/EventCard';
import { withScreenBackground } from '../components/ScreenBackground';

// The in-app Wallet — Apple-Wallet-style passes for every upcoming event the
// user hosts or is going to. Each pass carries a server-signed entry QR that
// opens the public /checkin page (door staff scan it with any camera, no app
// needed). Below the passes: tickets the purchase agent bought (PDF), moved
// here from the profile.

export default withScreenBackground(WalletScreen, { bloom: false });

// The pass "paper" — a light ticket stub on the midnight canvas, so it reads
// as a physical object (and matches the QR's paper background).
const PASS_PAPER = '#F4F1EB';
const PASS_INK = '#171717';
const PASS_INK_SOFT = 'rgba(23,23,23,0.58)';

function PassCard({ pass }: { pass: WalletPass }) {
  const router = useRouter();
  return (
    <View style={styles.pass}>
      {/* Cover strip: the event's look, tap-through to the event page. */}
      <Pressable
        onPress={() => router.push(`/event/${pass.slug}`)}
        style={({ pressed }) => pressed && { opacity: 0.85 }}
      >
        <CoverGradient theme={pass.coverTheme} image={pass.coverImage} style={styles.passCover}>
          <View style={styles.passCoverContent}>
            <Text
              style={[
                styles.passTitle,
                titleFontStyle(pass.titleFont),
                // Photo covers carry a scrim (light text); paper covers don't.
                { color: pass.coverImage ? '#FFFFFF' : PASS_INK },
              ]}
              numberOfLines={2}
            >
              {pass.title}
            </Text>
          </View>
        </CoverGradient>
      </Pressable>

      <View style={styles.passBody}>
        <View style={styles.passMetaRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.passMetaLabel}>Date</Text>
            <Text style={styles.passMetaValue}>
              {formatEventDate(pass.date)} · {formatEventTime(pass.date)}
            </Text>
          </View>
          <View style={styles.rolePill}>
            <Ionicons
              name={pass.role === 'host' ? 'key-outline' : 'ticket-outline'}
              size={12}
              color={PASS_PAPER}
            />
            <Text style={styles.rolePillText}>{pass.role === 'host' ? 'Host' : 'Guest'}</Text>
          </View>
        </View>
        {pass.location ? (
          <View>
            <Text style={styles.passMetaLabel}>Where</Text>
            <Text style={styles.passMetaValue} numberOfLines={1}>
              {pass.location}
              {pass.city ? `, ${pass.city}` : ''}
            </Text>
          </View>
        ) : null}
        <View>
          <Text style={styles.passMetaLabel}>Hosted by</Text>
          <Text style={styles.passMetaValue} numberOfLines={1}>
            {pass.hostName}
          </Text>
        </View>
      </View>

      {/* Perforation between stub and QR — notches + dashed rule. */}
      <View style={styles.perforation}>
        <View style={[styles.notch, { left: -10 }]} />
        <View style={styles.dashes} />
        <View style={[styles.notch, { right: -10 }]} />
      </View>

      <View style={styles.passQrSection}>
        <Image source={{ uri: pass.qrDataUrl }} style={styles.qr} />
        <Text style={styles.qrHint}>Show at the door, staff scan it with any camera</Text>
        <Text style={styles.qrCode} numberOfLines={1}>
          {pass.code.slice(-8).toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [passes, setPasses] = useState<WalletPass[] | null>(null);
  const [ticketJobs, setTicketJobs] = useState<TicketJobInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.myWallet();
      setPasses(res.passes);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your wallet');
    }
    try {
      const res = await api.myTickets();
      setTicketJobs(res.jobs.filter((jb) => ['purchasing', 'done', 'failed'].includes(jb.status)));
    } catch {
      // best-effort — the wallet renders fine without agent tickets
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.safe}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 64, paddingBottom: insets.bottom + spacing.xxl },
        ]}
      >
        <ChromeText style={styles.heading}>Wallet</ChromeText>
        <Text style={styles.subheading}>
          Your passes: one for every event you host or are going to.
        </Text>

        {error && !passes ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <Button title="Retry" variant="ghost" onPress={load} />
          </View>
        ) : !passes ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : passes.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎟️</Text>
            <Text style={styles.emptyTitle}>No passes yet</Text>
            <Text style={styles.emptyBody}>
              Host an event or get on a guest list and your entry pass appears here.
            </Text>
          </View>
        ) : (
          <View style={styles.passList}>
            {passes.map((p) => (
              <PassCard key={p.eventId} pass={p} />
            ))}
          </View>
        )}

        {/* Agent-purchased tickets (PDF with the provider's own QR). */}
        {ticketJobs.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Purchased tickets</Text>
            <View style={styles.ticketList}>
              {ticketJobs.map((jb) => {
                const done = jb.status === 'done';
                const pdfUrl = mediaUrl(jb.pdfPath);
                return (
                  <Pressable
                    key={jb.id}
                    disabled={!done || !pdfUrl}
                    onPress={() => {
                      if (!pdfUrl) return;
                      if (Platform.OS === 'web') {
                        (globalThis as any).window?.open(pdfUrl, '_blank');
                      } else {
                        WebBrowser.openBrowserAsync(pdfUrl).catch(() => {});
                      }
                    }}
                    style={({ pressed }) => [styles.ticketRow, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons
                      name={
                        done
                          ? 'qr-code-outline'
                          : jb.status === 'failed'
                            ? 'alert-circle-outline'
                            : 'hourglass-outline'
                      }
                      size={22}
                      color={jb.status === 'failed' ? colors.danger : colors.text}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ticketRowTitle} numberOfLines={1}>
                        {jb.event?.title ?? 'Event'}
                      </Text>
                      <Text style={styles.ticketRowMeta} numberOfLines={1}>
                        {jb.event ? `${formatEventDate(jb.event.date)} · ` : ''}
                        {done
                          ? `Ticket PDF${jb.cardLast4 ? ` · card •••• ${jb.cardLast4}` : ''}`
                          : jb.status === 'failed'
                            ? 'Purchase failed'
                            : 'Your agent is buying…'}
                      </Text>
                    </View>
                    {done ? <Ionicons name="open-outline" size={18} color={colors.muted} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Floating back chip, same as the event page (no nav header). */}
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
        hitSlop={10}
        style={[styles.backFab, { top: insets.top + spacing.sm }]}
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    paddingHorizontal: spacing.md,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.section,
  },
  errorText: {
    ...uiText(15),
    color: colors.danger,
    textAlign: 'center',
  },
  backFab: {
    position: 'absolute',
    left: spacing.lg,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10,13,24,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    ...display(40),
    color: colors.text,
  },
  subheading: {
    ...uiText(14),
    color: colors.muted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  passList: {
    gap: spacing.lg,
  },
  // ── The pass ────────────────────────────────────────────────────────────────
  pass: {
    backgroundColor: PASS_PAPER,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  passCover: {
    height: 120,
    justifyContent: 'flex-end',
  },
  passCoverContent: {
    padding: spacing.md,
  },
  passTitle: {
    fontSize: 24,
    lineHeight: 32,
  },
  passBody: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  passMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  passMetaLabel: {
    ...uiText(11, '700', { tracking: 0.08 }),
    textTransform: 'uppercase',
    color: PASS_INK_SOFT,
  },
  passMetaValue: {
    ...uiText(15, '600'),
    color: PASS_INK,
    marginTop: 1,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PASS_INK,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
  },
  rolePillText: {
    ...uiText(12, '700'),
    color: PASS_PAPER,
  },
  perforation: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  notch: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.bg,
  },
  dashes: {
    flex: 1,
    marginHorizontal: spacing.lg,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(23,23,23,0.25)',
  },
  passQrSection: {
    alignItems: 'center',
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: 6,
  },
  qr: {
    width: 190,
    height: 190,
    borderRadius: radius.sm,
  },
  qrHint: {
    ...uiText(12, '500'),
    color: PASS_INK_SOFT,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  qrCode: {
    ...uiText(12, '700', { tracking: 0.18 }),
    color: PASS_INK,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  // ── Empty state ─────────────────────────────────────────────────────────────
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.section,
    paddingHorizontal: spacing.lg,
  },
  emptyEmoji: {
    fontSize: 44,
  },
  emptyTitle: {
    ...display(22),
    color: colors.text,
  },
  emptyBody: {
    ...uiText(14),
    color: colors.muted,
    textAlign: 'center',
  },
  // ── Agent-purchased tickets ─────────────────────────────────────────────────
  section: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  sectionTitle: {
    ...display(24),
    color: colors.text,
  },
  ticketList: {
    gap: spacing.md,
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.card,
  },
  ticketRowTitle: {
    ...uiText(15, '700'),
    color: colors.text,
  },
  ticketRowMeta: {
    ...uiText(13, '500'),
    color: colors.muted,
    marginTop: 2,
  },
});
