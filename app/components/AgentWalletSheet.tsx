import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  AgentWallet,
  TicketJobInfo,
  TicketProvider,
  WalletIdentity,
  WalletPayment,
} from '../shared/types';
import { colors, light, radius, shadow, spacing } from '../lib/theme';
import { uiText } from '../lib/fonts';
import {
  EMPTY_WALLET,
  identityComplete,
  identityOf,
  loadWallet,
  paymentComplete,
  paymentOf,
  saveWallet,
} from '../lib/wallet';
import { Button, ErrorText, Field } from './ui';

interface Props {
  onClose: () => void;
  // 'purchase' → the full wizard (identity → availability → payment →
  //              purchasing → done). 'edit' → just view/save the wallet.
  mode: 'purchase' | 'edit';
  eventTitle?: string;
  // The current server job, so the sheet can mirror the real phase. Purchase
  // mode only.
  job?: TicketJobInfo | null;
  // Step 1: hand the identity to the caller, which starts the availability
  // check (POST /tickets/check) and begins polling `job`.
  onCheckAvailability?: (identity: WalletIdentity, provider: TicketProvider) => Promise<void>;
  // Step 3: hand identity + payment to the caller, which completes the
  // purchase (the server needs both to fill the checkout).
  onPurchase?: (identity: WalletIdentity, payment: WalletPayment) => Promise<void>;
}

// Pretty-print the card number as "4242 4242 4242 4242" while typing.
function formatCardNumber(v: string): string {
  return v
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

// Keep only date characters; the field guides the user to YYYY-MM-DD.
function formatDob(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 8);
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  return [y, m, d].filter(Boolean).join('-');
}

type SheetView = 'identity' | 'checking' | 'soldout' | 'payment' | 'purchasing' | 'done' | 'failed';

// Which view to show: the server job drives the phase once a purchase is
// underway; before that (and in edit mode) we show the data-entry forms.
function viewFor(mode: 'purchase' | 'edit', job: TicketJobInfo | null | undefined): SheetView {
  if (mode === 'edit' || !job) return 'identity';
  switch (job.status) {
    case 'checking':
      return 'checking';
    case 'soldout':
      return 'soldout';
    case 'available':
      return 'payment';
    case 'purchasing':
      return 'purchasing';
    case 'done':
      return 'done';
    case 'failed':
      return 'failed';
    default:
      return 'identity';
  }
}

export function AgentWalletSheet({
  onClose,
  mode,
  eventTitle,
  job,
  onCheckAvailability,
  onPurchase,
}: Props) {
  const [wallet, setWallet] = useState<AgentWallet>(EMPTY_WALLET);
  const [loaded, setLoaded] = useState(false);
  const [demoProvider, setDemoProvider] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWallet().then((stored) => {
      setWallet(stored);
      setLoaded(true);
    });
  }, []);

  const set = (patch: Partial<AgentWallet>) => setWallet((w) => ({ ...w, ...patch }));
  const view = viewFor(mode, job);

  // A change in the job phase (availability confirmed, purchase done, …) means
  // the caller-driven poll advanced — release the local busy latch so the new
  // view's buttons are live again.
  useEffect(() => {
    setBusy(false);
  }, [job?.status]);

  async function submitIdentity() {
    if (!identityComplete(wallet) || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveWallet(wallet);
      if (mode === 'purchase' && onCheckAvailability) {
        await onCheckAvailability(identityOf(wallet), demoProvider ? 'demo' : 'web');
        // The job now drives the view; keep busy until its status changes.
      } else {
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  }

  async function submitPayment() {
    if (!paymentComplete(wallet) || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveWallet(wallet);
      if (onPurchase) await onPurchase(identityOf(wallet), paymentOf(wallet));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment could not be started');
      setBusy(false);
    }
  }

  const editable = loaded && !busy;

  function Header({ title }: { title: string }) {
    return (
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn} disabled={busy}>
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      </View>
    );
  }

  // The little phase tracker shown across the purchase views.
  function Steps({ active }: { active: 1 | 2 | 3 }) {
    const labels = ['Details', 'Availability', 'Payment'];
    return (
      <View style={styles.steps}>
        {labels.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const on = n <= active;
          return (
            <View key={label} style={styles.step}>
              <View style={[styles.stepDot, on && styles.stepDotOn]}>
                <Text style={[styles.stepNum, on && styles.stepNumOn]}>{n}</Text>
              </View>
              <Text style={[styles.stepLabel, on && styles.stepLabelOn]}>{label}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          {/* ── Step 1: identity ─────────────────────────────────────────── */}
          {view === 'identity' ? (
            <>
              <Header title="Agent Wallet" />
              <ScrollView
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {mode === 'purchase' ? <Steps active={1} /> : null}
                <Text style={styles.blurb}>
                  {mode === 'purchase'
                    ? `Your agent needs these details to buy the ticket${eventTitle ? ` for ${eventTitle}` : ''}. Entered once, stored only on this device.`
                    : 'Your purchase details for agentic ticket buying. Stored only on this device.'}
                </Text>

                <Field
                  label="Full name"
                  value={wallet.name}
                  onChangeText={(v) => set({ name: v })}
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                  editable={editable}
                />
                <Field
                  label="Email"
                  value={wallet.email}
                  onChangeText={(v) => set({ email: v })}
                  placeholder="ada@example.com"
                  autoComplete="email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={editable}
                />
                <Field
                  label="Address"
                  value={wallet.address}
                  onChangeText={(v) => set({ address: v })}
                  placeholder="5 Analytical Ave, London"
                  autoComplete="street-address"
                  editable={editable}
                />
                <Field
                  label="Date of birth"
                  value={wallet.dateOfBirth}
                  onChangeText={(v) => set({ dateOfBirth: formatDob(v) })}
                  placeholder="YYYY-MM-DD"
                  keyboardType="number-pad"
                  editable={editable}
                />

                {mode === 'purchase' ? (
                  <Pressable
                    onPress={() => setDemoProvider((d) => !d)}
                    style={styles.toggleRow}
                    disabled={busy}
                  >
                    <Ionicons
                      name={demoProvider ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={colors.text}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.toggleLabel}>Use demo checkout</Text>
                      <Text style={styles.toggleHint}>
                        Full flow on our test shop. Off = the agent checks the real ticket site
                        (usually blocked by bot protection; it never completes a real purchase).
                      </Text>
                    </View>
                  </Pressable>
                ) : null}

                <ErrorText message={error} />
                <Button
                  title={mode === 'purchase' ? 'Check availability' : 'Save wallet'}
                  onPress={submitIdentity}
                  loading={busy}
                  disabled={!identityComplete(wallet)}
                />
                <Text style={styles.note}>
                  Prototype: details are held in memory for the purchase only — never stored or
                  logged on the server.
                </Text>
              </ScrollView>
            </>
          ) : null}

          {/* ── Step 2: checking availability ────────────────────────────── */}
          {view === 'checking' ? (
            <>
              <Header title="Checking availability" />
              <View style={styles.statusView}>
                <Steps active={2} />
                <ActivityIndicator color={colors.text} size="large" />
                <Text style={styles.statusTitle}>Your agent is checking for tickets…</Text>
                <Text style={styles.statusBody}>
                  Visiting the ticket page{eventTitle ? ` for ${eventTitle}` : ''} to confirm
                  tickets are still available. No payment is made yet.
                </Text>
              </View>
            </>
          ) : null}

          {/* ── Sold out ─────────────────────────────────────────────────── */}
          {view === 'soldout' ? (
            <>
              <Header title="Sold out" />
              <View style={styles.statusView}>
                <Text style={styles.bigEmoji}>😞</Text>
                <Text style={styles.statusTitle}>No tickets available</Text>
                <Text style={styles.statusBody}>{job?.error || 'This event is sold out.'}</Text>
                <Button title="Close" variant="ghost" onPress={onClose} />
              </View>
            </>
          ) : null}

          {/* ── Step 3: payment ──────────────────────────────────────────── */}
          {view === 'payment' ? (
            <>
              <Header title="Payment" />
              <ScrollView
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Steps active={3} />
                <View style={styles.availableBanner}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.availableText}>Tickets available — enter payment to buy.</Text>
                </View>

                <Field
                  label="Card number"
                  value={wallet.cardNumber}
                  onChangeText={(v) => set({ cardNumber: formatCardNumber(v) })}
                  placeholder="4242 4242 4242 4242"
                  keyboardType="number-pad"
                  editable={editable}
                />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Expiry"
                      value={wallet.cardExpiry}
                      onChangeText={(v) => set({ cardExpiry: formatExpiry(v) })}
                      placeholder="MM/YY"
                      keyboardType="number-pad"
                      editable={editable}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="CVC"
                      value={wallet.cardCvc}
                      onChangeText={(v) => set({ cardCvc: v.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="123"
                      keyboardType="number-pad"
                      secureTextEntry
                      editable={editable}
                    />
                  </View>
                </View>

                <ErrorText message={error} />
                <Button
                  title="Pay & buy ticket"
                  onPress={submitPayment}
                  loading={busy}
                  disabled={!paymentComplete(wallet)}
                />
                <Text style={styles.note}>
                  Prototype: card details are held in memory for this purchase only — never stored
                  or logged on the server. No 3-D Secure / SCA.
                </Text>
              </ScrollView>
            </>
          ) : null}

          {/* ── Step 4: purchasing ───────────────────────────────────────── */}
          {view === 'purchasing' ? (
            <>
              <Header title="Buying your ticket" />
              <View style={styles.statusView}>
                <ActivityIndicator color={colors.text} size="large" />
                <Text style={styles.statusTitle}>Your agent is completing the purchase…</Text>
                <Text style={styles.statusBody}>
                  Filling in the checkout and confirming the order. Your ticket appears here once
                  it's done.
                </Text>
              </View>
            </>
          ) : null}

          {/* ── Done ─────────────────────────────────────────────────────── */}
          {view === 'done' ? (
            <>
              <Header title="Ticket purchased" />
              <View style={styles.statusView}>
                <Text style={styles.bigEmoji}>🎟️</Text>
                <Text style={styles.statusTitle}>You're in!</Text>
                <Text style={styles.statusBody}>
                  Your ticket (with QR code) is ready under Tickets in your profile.
                </Text>
                <Button title="Done" onPress={onClose} />
              </View>
            </>
          ) : null}

          {/* ── Failed ───────────────────────────────────────────────────── */}
          {view === 'failed' ? (
            <>
              <Header title="Purchase failed" />
              <View style={styles.statusView}>
                <Ionicons name="alert-circle-outline" size={44} color={colors.danger} />
                <Text style={styles.statusTitle}>The agent couldn't finish</Text>
                <Text style={styles.statusBody}>{job?.error || 'Unknown reason.'}</Text>
                <Button title="Close" variant="ghost" onPress={onClose} />
              </View>
            </>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    zIndex: 60,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: 680,
    ...shadow.float,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: light.hairline,
    marginBottom: spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sheetTitle: { ...uiText(20, '700'), color: colors.text },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  blurb: {
    ...uiText(14, '500'),
    color: colors.muted,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  toggleLabel: { ...uiText(15, '600'), color: colors.text },
  toggleHint: { ...uiText(12, '400'), color: colors.muted, marginTop: 2 },
  note: { ...uiText(11, '400'), color: colors.muted, textAlign: 'center' },
  // Phase tracker
  steps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  stepDotOn: { backgroundColor: colors.ink },
  stepNum: { ...uiText(12, '700'), color: colors.muted },
  stepNumOn: { color: colors.onInk },
  stepLabel: { ...uiText(11, '600'), color: colors.muted, flexShrink: 1 },
  stepLabelOn: { color: colors.text },
  // Status views (checking / purchasing / done / soldout / failed)
  statusView: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  bigEmoji: { fontSize: 48 },
  statusTitle: { ...uiText(18, '700'), color: colors.text, textAlign: 'center' },
  statusBody: { ...uiText(14, '500'), color: colors.muted, textAlign: 'center' },
  availableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(30,158,82,0.10)',
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  availableText: { ...uiText(14, '600'), color: colors.text, flex: 1 },
});
