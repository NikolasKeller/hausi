import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useHeaderHeight } from 'expo-router/react-navigation';
import {
  CATEGORIES,
  CATEGORY_META,
  EFFECTS,
  LIMITS,
  TITLE_FONTS,
  type Category,
  type CoverTheme,
  type Effect,
  type EventInput,
  type TitleFont,
} from '../shared/types';
import { colors, radius, spacing } from '../lib/theme';
import { COVER_LIST } from '../lib/covers';
import { TITLE_FONT_LABELS, titleFontStyle } from '../lib/fonts';
import { CoverGradient } from './CoverGradient';
import { EffectOverlay } from './EffectOverlay';
import { Button, ErrorText, Field } from './ui';
import { formatEventDate, formatEventTime } from './EventCard';

const EFFECT_LABELS: Record<Effect, string> = {
  none: '✖️ None',
  confetti: '🎊 Confetti',
  sparkles: '✨ Sparkles',
  balloons: '🎈 Balloons',
};

export interface EventFormValues {
  title: string;
  description: string;
  location: string;
  city: string;
  category: Category;
  isPublic: boolean;
  costPerPerson: string;
  dressCode: string;
  coverTheme: CoverTheme;
  titleFont: TitleFont;
  effect: Effect;
  date: Date;
  maxGuests: number | null;
  plusOneLimit: number;
}

interface Props {
  initial?: Partial<EventFormValues>;
  submitLabel: string;
  onSubmit: (data: EventInput) => Promise<void>;
  footer?: React.ReactNode;
}

function defaultDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(19, 0, 0, 0);
  return d;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// Values for the HTML <input type="date|time"> used on web, in local time.
function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeInputValue(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// @react-native-community/datetimepicker throws when rendered on web, so web
// gets the browser's native pickers styled to match the form fields.
const webPickerStyle = {
  backgroundColor: colors.inputBg,
  color: colors.text,
  colorScheme: 'dark',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${radius.md}px`,
  padding: '12px',
  fontSize: '16px',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
} as const;

export function EventForm({ initial, submitLabel, onSubmit, footer }: Props) {
  const headerHeight = useHeaderHeight();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [category, setCategory] = useState<Category>(initial?.category ?? 'community');
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [costPerPerson, setCostPerPerson] = useState(initial?.costPerPerson ?? '');
  const [dressCode, setDressCode] = useState(initial?.dressCode ?? '');
  const [coverTheme, setCoverTheme] = useState<CoverTheme>(initial?.coverTheme ?? 'sunset');
  const [titleFont, setTitleFont] = useState<TitleFont>(initial?.titleFont ?? 'classic');
  const [effect, setEffect] = useState<Effect>(initial?.effect ?? 'none');
  const [date, setDate] = useState<Date>(initial?.date ?? defaultDate());
  const [maxGuests, setMaxGuests] = useState(
    initial?.maxGuests != null ? String(initial.maxGuests) : ''
  );
  const [plusOneLimit, setPlusOneLimit] = useState<number>(initial?.plusOneLimit ?? 1);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) {
      setError('Give your party a name!');
      return;
    }
    const guests = maxGuests.trim() ? Number(maxGuests.trim()) : null;
    if (guests != null && (!Number.isInteger(guests) || guests < 1 || guests > LIMITS.maxGuests)) {
      setError(`Max guests must be a whole number between 1 and ${LIMITS.maxGuests}`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        city: city.trim(),
        category,
        isPublic,
        costPerPerson: costPerPerson.trim(),
        dressCode: dressCode.trim(),
        coverTheme,
        titleFont,
        effect,
        date: date.toISOString(),
        maxGuests: guests,
        plusOneLimit,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setSaving(false);
    }
  }

  function onPickerChange(_event: unknown, selected?: Date) {
    if (Platform.OS === 'android') setPicker(null);
    if (selected) setDate(selected);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => setIsPublic(!isPublic)} style={styles.publicPill}>
          <Text style={styles.publicPillText}>
            {isPublic ? '🌐 Public — anyone can find it' : '🔒 Private — invite only'}
          </Text>
          <Text style={styles.publicPillAction}>{isPublic ? 'Make private' : 'Make it public'}</Text>
        </Pressable>

        <CoverGradient theme={coverTheme} style={styles.preview}>
          <EffectOverlay effect={effect} height={140} />
          <Text style={[styles.previewTitle, titleFontStyle(titleFont)]} numberOfLines={3}>
            {title.trim() || 'Untitled Event'}
          </Text>
        </CoverGradient>

        <View style={styles.fontRow}>
          {TITLE_FONTS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setTitleFont(f)}
              style={[styles.fontChip, titleFont === f && styles.chipActive]}
            >
              <Text style={[styles.fontChipSample, titleFontStyle(f)]}>Aa</Text>
              <Text style={styles.chipLabel}>{TITLE_FONT_LABELS[f]}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={styles.label}>Cover theme</Text>
          <View style={styles.themeRow}>
            {COVER_LIST.map((c) => (
              <Pressable key={c.key} onPress={() => setCoverTheme(c.key)}>
                <CoverGradient
                  theme={c.key}
                  emojiOpacity={0}
                  style={StyleSheet.flatten([
                    styles.themeChip,
                    coverTheme === c.key && styles.themeChipActive,
                  ])}
                >
                  <Text style={styles.themeEmoji}>{c.emoji}</Text>
                </CoverGradient>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={styles.label}>Effect</Text>
          <View style={styles.themeRow}>
            {EFFECTS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEffect(e)}
                style={[styles.effectChip, effect === e && styles.chipActive]}
              >
                <Text style={styles.chipLabel}>{EFFECT_LABELS[e]}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Untitled Event"
          maxLength={LIMITS.title}
        />

        <View style={{ gap: spacing.xs }}>
          <Text style={styles.label}>When</Text>
          <View style={styles.dateRow}>
            <Pressable
              style={styles.dateButton}
              onPress={() => setPicker(picker === 'date' ? null : 'date')}
            >
              <Text style={styles.dateText}>{formatEventDate(date.toISOString())}</Text>
            </Pressable>
            <Pressable
              style={styles.dateButton}
              onPress={() => setPicker(picker === 'time' ? null : 'time')}
            >
              <Text style={styles.dateText}>{formatEventTime(date.toISOString())}</Text>
            </Pressable>
          </View>
          {picker ? (
            Platform.OS === 'web' ? (
              React.createElement('input', {
                type: picker,
                value: picker === 'date' ? toDateInputValue(date) : toTimeInputValue(date),
                onChange: (e: { target: { value: string } }) => {
                  const value = e.target.value;
                  if (!value) return;
                  const next = new Date(date);
                  if (picker === 'date') {
                    const [y, m, d] = value.split('-').map(Number);
                    next.setFullYear(y, m - 1, d);
                  } else {
                    const [h, min] = value.split(':').map(Number);
                    next.setHours(h, min);
                  }
                  setDate(next);
                },
                style: webPickerStyle,
              })
            ) : (
              <DateTimePicker
                value={date}
                mode={picker}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickerChange}
                themeVariant="dark"
              />
            )
          ) : null}
        </View>

        <Field
          label="Where"
          value={location}
          onChangeText={setLocation}
          placeholder="Location"
          maxLength={LIMITS.location}
        />
        <Field
          label="City"
          value={city}
          onChangeText={setCity}
          placeholder="e.g. San Francisco"
          maxLength={80}
        />

        <View style={{ gap: spacing.xs }}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.themeRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[styles.effectChip, category === cat && styles.chipActive]}
              >
                <Text style={styles.chipLabel}>
                  {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Field
          label="Cost per person (optional)"
          value={costPerPerson}
          onChangeText={setCostPerPerson}
          placeholder="Free"
          maxLength={60}
        />
        <Field
          label="Dress code (optional)"
          value={dressCode}
          onChangeText={setDressCode}
          placeholder="Come as you are"
          maxLength={120}
        />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Add a description of your event"
          multiline
          numberOfLines={4}
          maxLength={LIMITS.description}
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />
        <Field
          label="Max guests (optional)"
          value={maxGuests}
          onChangeText={setMaxGuests}
          placeholder="Unlimited spots"
          keyboardType="number-pad"
        />

        <View style={styles.plusOneRow}>
          <Text style={styles.plusOneLabel}>Plus ones per guest</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => setPlusOneLimit(Math.max(0, plusOneLimit - 1))}
              style={styles.stepButton}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.plusOneValue}>
              {plusOneLimit === 0 ? 'None' : `+${plusOneLimit}`}
            </Text>
            <Pressable
              onPress={() => setPlusOneLimit(Math.min(LIMITS.plusOnes, plusOneLimit + 1))}
              style={styles.stepButton}
            >
              <Text style={styles.stepText}>＋</Text>
            </Pressable>
          </View>
        </View>

        <ErrorText message={error} />
        <Button title={submitLabel} onPress={submit} loading={saving} />
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  preview: {
    borderRadius: radius.lg,
    minHeight: 140,
    padding: spacing.md,
    justifyContent: 'flex-end',
  },
  previewTitle: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  themeChip: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeChipActive: {
    borderColor: '#fff',
  },
  themeEmoji: {
    fontSize: 22,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateButton: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dateText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  fontRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  publicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  publicPillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  publicPillAction: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  fontChip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.inputBg,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  fontChipSample: {
    color: colors.text,
    fontSize: 20,
  },
  effectChip: {
    backgroundColor: colors.inputBg,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: colors.accent,
  },
  chipLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  plusOneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  plusOneLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  plusOneValue: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'center',
  },
});
