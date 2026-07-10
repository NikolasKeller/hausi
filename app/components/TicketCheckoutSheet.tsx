import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { EventDetail } from '../shared/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, light, radius, shadow, spacing } from '../lib/theme';
import { display, uiText } from '../lib/fonts';
import { Button, Field } from './ui';
import { formatEventDate, formatEventTime } from './EventCard';

// MOCK checkout — the "Buy ticket" flow demoed end to end inside the app:
// name + address → a staged post-purchase animation → the ticket lands in the
// in-app Wallet, with an (equally mocked) "Add to Apple Wallet" badge. No
// money moves; the only real side effect is the GOING RSVP, which is what
// makes the Wallet issue the entry pass. The organiser's real ticket page
// stays reachable via the link under the form.

type Step = 'form' | 'processing' | 'done';

export function TicketCheckoutSheet({
  event,
  onClose,
  onPurchased,
  onOpenExternal,
}: {
  event: EventDetail;
  onClose: () => void;
  // Called once the mock purchase went through (event page refetches).
  onPurchased: () => void;
  // Opens the organiser's real ticket page ('' hides the link).
  onOpenExternal: (url: string) => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState(user?.name ?? '');
  const [address, setAddress] = useState('');
  const [appleAdded, setAppleAdded] = useState(false);

  // Processing: a ticket that gently pulses while the "payment" runs.
  const pulse = useRef(new Animated.Value(1)).current;
  // Done: the check bursts in, then the copy fades up beneath it.
  const checkScale = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step !== 'processing') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.25,
          duration: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [step, pulse]);

  useEffect(() => {
    if (step !== 'done') return;
    // Parallel with a stagger (not a sequence): on web a spring's completion
    // callback can stay pending while it settles, which would leave the copy
    // stuck at opacity 0 behind the checkmark.
    Animated.parallel([
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 350,
        delay: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [step, checkScale, contentFade]);

  const canBuy = name.trim().length > 1 && address.trim().length > 3;
  const price = event.costPerPerson || 'Free';

  async function buy() {
    if (!canBuy || step !== 'form') return;
    setStep('processing');
    // The one real side effect: GOING — that's what issues the Wallet pass.
    // Mock payment: the animation runs its ~2s regardless of the RSVP call.
    const rsvp =
      user && !event.canManage
        ? api.rsvp(event.id, 'GOING').catch(() => null)
        : Promise.resolve(null);
    await Promise.all([rsvp, new Promise((r) => setTimeout(r, 2000))]);
    onPurchased();
    setStep('done');
  }

  function viewInWallet() {
    onClose();
    router.push('/wallet');
  }

  return (
    <View style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        // Don't let a tap-out abandon the flow mid-"payment".
        onPress={step === 'processing' ? undefined : onClose}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
        style={styles.sheetWrap}
      >
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          {step === 'form' ? (
            <>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Checkout</Text>
                <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
                  <Ionicons name="close" size={18} color={colors.muted} />
                </Pressable>
              </View>

              {/* Order summary */}
              <View style={styles.orderCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderTitle} numberOfLines={2}>
                    {event.title}
                  </Text>
                  <Text style={styles.orderMeta}>
                    {formatEventDate(event.date)} · {formatEventTime(event.date)}
                  </Text>
                  <Text style={styles.orderMeta}>1 × General Admission</Text>
                </View>
                <Text style={styles.orderPrice}>{price}</Text>
              </View>

              <View style={styles.form}>
                <Field
                  label="Full name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                />
                <Field
                  label="Address"
                  value={address}
                  onChangeText={setAddress}
                  placeholder="5 Analytical Ave, Berlin"
                  autoComplete="street-address"
                />
              </View>

              <Button
                title={`Buy ticket · ${price}`}
                onPress={buy}
                disabled={!canBuy}
                style={{ marginHorizontal: spacing.lg }}
              />
              {event.ticketUrl ? (
                <Pressable
                  onPress={() => {
                    onClose();
                    onOpenExternal(event.ticketUrl);
                  }}
                  hitSlop={6}
                  style={({ pressed }) => [styles.externalLink, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.externalLinkText}>
                    Buy on the organiser's site instead
                  </Text>
                  <Ionicons name="open-outline" size={13} color={colors.muted} />
                </Pressable>
              ) : (
                <Text style={styles.mockNote}>Demo checkout, no real payment happens here.</Text>
              )}
            </>
          ) : step === 'processing' ? (
            <View style={styles.stage}>
              <Animated.Text style={[styles.stageEmoji, { transform: [{ scale: pulse }] }]}>
                🎟️
              </Animated.Text>
              <Text style={styles.stageTitle}>Securing your ticket…</Text>
              <Text style={styles.stageBody}>Hold tight, confirming your spot.</Text>
            </View>
          ) : (
            <View style={styles.stage}>
              <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
                <Ionicons name="checkmark" size={44} color="#FFFFFF" />
              </Animated.View>
              <Animated.View style={[styles.doneContent, { opacity: contentFade }]}>
                <Text style={styles.stageTitle}>You're in! 🎉</Text>
                <Text style={styles.stageBody}>
                  Your ticket is saved in your Wallet here in the app. The QR at the door is all
                  you need.
                </Text>
                <Button title="View in Wallet" onPress={viewInWallet} style={{ alignSelf: 'stretch' }} />
                {/* Mock Apple Wallet badge — flips to "added" without doing
                    anything real (PassKit needs a pass certificate). */}
                <Pressable
                  onPress={() => setAppleAdded(true)}
                  disabled={appleAdded}
                  style={({ pressed }) => [styles.appleBadge, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons
                    name={appleAdded ? 'checkmark-circle' : 'logo-apple'}
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.appleBadgeText}>
                    {appleAdded ? 'Added to Apple Wallet' : 'Add to Apple Wallet'}
                  </Text>
                </Pressable>
                <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
                  <Text style={styles.doneClose}>Done</Text>
                </Pressable>
              </Animated.View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  sheetWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
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
  sheetTitle: {
    ...uiText(20, '700'),
    color: colors.text,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  orderTitle: {
    ...uiText(15, '700'),
    color: colors.text,
  },
  orderMeta: {
    ...uiText(13, '500'),
    color: colors.muted,
    marginTop: 2,
  },
  orderPrice: {
    ...uiText(16, '800'),
    color: colors.text,
  },
  form: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  externalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.md,
  },
  externalLinkText: {
    ...uiText(13, '600'),
    color: colors.muted,
    textDecorationLine: 'underline',
  },
  mockNote: {
    ...uiText(12, '500'),
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  // ── Processing / success stage ──────────────────────────────────────────────
  stage: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    minHeight: 260,
    justifyContent: 'center',
  },
  stageEmoji: {
    fontSize: 56,
    marginBottom: spacing.sm,
  },
  stageTitle: {
    ...display(24),
    color: colors.text,
    textAlign: 'center',
  },
  stageBody: {
    ...uiText(14, '500', { lineHeight: 1.5 }),
    color: colors.muted,
    textAlign: 'center',
  },
  checkCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  doneContent: {
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  // Modeled on Apple's official black "Add to Apple Wallet" badge.
  appleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.sm + 2,
    paddingVertical: 13,
  },
  appleBadgeText: {
    ...uiText(16, '600'),
    color: '#FFFFFF',
  },
  doneClose: {
    ...uiText(14, '600'),
    color: colors.muted,
  },
});
