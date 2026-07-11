import React, { useRef, type ComponentProps } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  APPLICATION_LIMITS,
  LIMITS,
  MAX_PLUS_ONES,
  PUNCTUALITY_META,
  PUNCTUALITY_OPTIONS,
  type Punctuality,
} from '../shared/types';
import { radius, spacing } from '../lib/theme';
import { uiText } from '../lib/fonts';
import { Glass } from './glass';

interface Props {
  isPublic: boolean;
  onTogglePublic: () => void;
  maxGuests: string;
  onChangeMaxGuests: (v: string) => void;
  plusOneLimit: number;
  onChangePlusOneLimit: (v: number) => void;
  costPerPerson: string;
  onChangeCostPerPerson: (v: string) => void;
  dressCode: string;
  onChangeDressCode: (v: string) => void;
  // "Apply to join": guests request a spot and answer up to 3 questions.
  applicationRequired: boolean;
  onToggleApplicationRequired: () => void;
  applicationQuestions: string[];
  onChangeApplicationQuestion: (index: number, value: string) => void;
  vibe: string;
  onChangeVibe: (v: string) => void;
  // '' = unset; tapping the row cycles through the punctuality options.
  punctuality: Punctuality | '';
  onChangePunctuality: (v: Punctuality | '') => void;
  onClose: () => void;
}

// A full row that focuses its input wherever it's tapped, so the icon+label
// half isn't a dead zone (the Audience row is fully pressable — match it).
function InputRow({
  icon,
  label,
  ...props
}: TextInputProps & { icon: ComponentProps<typeof Ionicons>['name']; label: string }) {
  const inputRef = useRef<TextInput>(null);
  return (
    <Pressable style={styles.row} onPress={() => inputRef.current?.focus()}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={18} color="rgba(255,255,255,0.9)" />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <TextInput
        ref={inputRef}
        placeholderTextColor="rgba(255,255,255,0.45)"
        style={styles.rowInput}
        {...props}
      />
    </Pressable>
  );
}

// Event Settings bottom sheet — the guest-facing logistics that don't need to
// live on the poster itself (audience, capacity, plus-ones, cost, dress code).
// Opens from the Settings slot of the editor's mini taskbar and shares the
// dark-glass chrome of the theme/effect pickers.
export function EventSettingsSheet({
  isPublic,
  onTogglePublic,
  maxGuests,
  onChangeMaxGuests,
  plusOneLimit,
  onChangePlusOneLimit,
  costPerPerson,
  onChangeCostPerPerson,
  dressCode,
  onChangeDressCode,
  applicationRequired,
  onToggleApplicationRequired,
  applicationQuestions,
  onChangeApplicationQuestion,
  vibe,
  onChangeVibe,
  punctuality,
  onChangePunctuality,
  onClose,
}: Props) {
  // '' → sharp → grace → loose → '' — one tap per step keeps the row compact.
  const punctualityCycle: (Punctuality | '')[] = ['', ...PUNCTUALITY_OPTIONS];
  const nextPunctuality =
    punctualityCycle[(punctualityCycle.indexOf(punctuality) + 1) % punctualityCycle.length];
  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      {/* The height cap lives on the KAV (direct child of the absolute-fill
          overlay) — a percentage on the Glass itself would resolve against the
          auto-sized KAV and never clamp. The Glass shrinks within it. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
      >
        <Glass tint="dark" intensity={48} radius={radius.xl} border style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Event Settings</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.rows}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable style={styles.row} onPress={onTogglePublic}>
              <View style={styles.rowLeft}>
                <Ionicons
                  name={isPublic ? 'globe-outline' : 'lock-closed'}
                  size={18}
                  color="rgba(255,255,255,0.9)"
                />
                <Text style={styles.rowLabel}>Audience</Text>
              </View>
              <Text style={styles.rowValue}>{isPublic ? 'Public' : 'Private'}</Text>
            </Pressable>

            <InputRow
              icon="people"
              label="Max guests"
              value={maxGuests}
              onChangeText={onChangeMaxGuests}
              placeholder="Unlimited"
              keyboardType="number-pad"
            />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="person-add" size={18} color="rgba(255,255,255,0.9)" />
                <Text style={styles.rowLabel}>Plus ones</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => onChangePlusOneLimit(Math.max(0, plusOneLimit - 1))}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <Text style={styles.stepValue}>
                  {plusOneLimit === 0 ? 'None' : `+${plusOneLimit}`}
                </Text>
                {plusOneLimit < MAX_PLUS_ONES ? (
                  <Pressable
                    onPress={() => onChangePlusOneLimit(Math.min(MAX_PLUS_ONES, plusOneLimit + 1))}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepText}>＋</Text>
                  </Pressable>
                ) : (
                  // At the +10 ceiling the ＋ disappears; keep its footprint so
                  // the stepper doesn't jump.
                  <View style={styles.stepBtn} />
                )}
              </View>
            </View>

            <InputRow
              icon="shirt-outline"
              label="Dress code"
              value={dressCode}
              onChangeText={onChangeDressCode}
              placeholder="Come as you are"
              maxLength={120}
            />

            <InputRow
              icon="sparkles-outline"
              label="Vibe"
              value={vibe}
              onChangeText={onChangeVibe}
              placeholder="Cozy, wild, fancy…"
              maxLength={LIMITS.vibe}
            />

            <Pressable style={styles.row} onPress={() => onChangePunctuality(nextPunctuality)}>
              <View style={styles.rowLeft}>
                <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.9)" />
                <Text style={styles.rowLabel}>Punctuality</Text>
              </View>
              <Text style={styles.rowValue}>
                {punctuality ? PUNCTUALITY_META[punctuality].label : 'Not specified'}
              </Text>
            </Pressable>

            <Pressable style={styles.row} onPress={onToggleApplicationRequired}>
              <View style={styles.rowLeft}>
                <Ionicons
                  name={applicationRequired ? 'clipboard-outline' : 'flash-outline'}
                  size={18}
                  color="rgba(255,255,255,0.9)"
                />
                <Text style={styles.rowLabel}>Joining</Text>
              </View>
              <Text style={styles.rowValue}>
                {applicationRequired ? 'Apply first' : 'Anyone can join'}
              </Text>
            </Pressable>
            {applicationRequired ? (
              <View style={styles.applicationBox}>
                <Text style={styles.applicationHint}>
                  Guests answer these when they apply. Leave all empty for one simple
                  "why would you love to join?" question.
                </Text>
                {applicationQuestions.map((question, index) => (
                  <TextInput
                    // Fixed slots, safe to key by position.
                    // eslint-disable-next-line react/no-array-index-key
                    key={index}
                    value={question}
                    onChangeText={(value) => onChangeApplicationQuestion(index, value)}
                    placeholder={`Question ${index + 1} (optional)`}
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    maxLength={APPLICATION_LIMITS.question}
                    style={styles.applicationInput}
                  />
                ))}
              </View>
            ) : null}
          </ScrollView>
        </Glass>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  kav: {
    maxHeight: '80%',
  },
  sheet: {
    flexShrink: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: 'rgba(18,16,28,0.72)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sheetTitle: { ...uiText(20, '700'), color: '#fff' },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  rows: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: spacing.sm,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowLabel: { ...uiText(15, '600'), color: '#fff' },
  rowValue: { ...uiText(15, '600'), color: 'rgba(255,255,255,0.65)' },
  rowInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    textAlign: 'right',
    paddingVertical: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  stepText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  stepValue: { ...uiText(15, '600'), color: '#fff', minWidth: 40, textAlign: 'center' },
  applicationBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  applicationHint: { ...uiText(12, '500', { lineHeight: 1.4 }), color: 'rgba(255,255,255,0.65)' },
  applicationInput: {
    ...uiText(14),
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
});
