import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import {
  CATEGORIES,
  CATEGORY_META,
  LIMITS,
  TITLE_FONTS,
  type Category,
  type CoverTheme,
  type Effect,
  type EventInput,
  type TitleFont,
} from '../shared/types';
import { colors, light, radius, shadow, spacing } from '../lib/theme';
import { themeInk } from '../lib/covers';
import { TITLE_FONT_LABELS, titleFontStyle, display, kicker, uiText } from '../lib/fonts';
import { CoverGradient } from './CoverGradient';
import { EffectOverlay } from './EffectOverlay';
import { Button, ErrorText } from './ui';
import { ThemeBackground, ThemePicker, EffectPicker } from './themes';
import { Burst } from './partiful';
import { Glass } from './glass';
import { formatEventDate, formatEventTime } from './EventCard';
import { pickCoverImage } from '../lib/imageUpload';

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
  coverImage: string;
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

// ── Frosted "glass" primitives ─────────────────────────────────────────────────
// The theme gradient + effect fill the whole screen, and every control is a
// translucent frosted pane that lets that surface glow through — the Partiful
// look. Tint, border and text colour follow the theme's mood (dark frost + white
// ink on vibrant/dark themes, light frost + near-black ink on pastel ones) so the
// labels stay legible on ANY theme while the surface keeps showing through.

type Ink = ReturnType<typeof themeInk>;

// A faint wash painted over the blur so text keeps contrast on busy or very
// bright gradients — darkens dark-mood glass, brightens light-mood glass.
function glassFill(ink: Ink) {
  return ink.dark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.26)';
}

// The frosted backdrop for a control: an absolute-fill pane painted behind its
// content, so the control's existing layout/padding styles stay untouched. It
// never intercepts taps (pointerEvents none), so parent Pressables still fire.
function GlassBg({ ink, r = radius.md }: { ink: Ink; r?: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Glass
        tint={ink.glassTint}
        intensity={26}
        radius={r}
        fill={glassFill(ink)}
        style={{ flex: 1 }}
      />
    </View>
  );
}

function SectionLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={[styles.sectionLabel, color ? { color } : null]}>{children}</Text>;
}

// A tappable frosted card — the base for every button/row on the form.
function PaperPressable({
  ink,
  onPress,
  disabled,
  radius: r = radius.md,
  style,
  children,
}: {
  ink: Ink;
  onPress: () => void;
  disabled?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.surface, style, pressed && styles.cardPressed]}
    >
      <GlassBg ink={ink} r={r} />
      {children}
    </Pressable>
  );
}

function PaperField({
  ink,
  label,
  labelColor,
  style,
  ...props
}: TextInputProps & {
  ink: Ink;
  label?: string;
  labelColor?: string;
  style?: TextInputProps['style'];
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <SectionLabel color={labelColor}>{label}</SectionLabel> : null}
      <View style={styles.surface}>
        <GlassBg ink={ink} />
        <TextInput
          placeholderTextColor={ink.faint}
          style={[styles.input, { color: ink.text }, style]}
          {...props}
        />
      </View>
    </View>
  );
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
// gets the browser's native pickers. Rather than revealing a separate inline
// input (which pushes the rest of the form down), an invisible native input is
// laid directly over each date/time button — tapping it opens the browser's
// floating calendar/clock popup, so the form layout never shifts.
const webPickerOverlayStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  margin: 0,
  padding: 0,
  border: 'none',
  background: 'transparent',
  opacity: 0,
  cursor: 'pointer',
  colorScheme: 'light',
} as const;

export function EventForm({ initial, submitLabel, onSubmit, footer }: Props) {
  const router = useRouter();
  const { height: winHeight } = useWindowDimensions();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [category, setCategory] = useState<Category>(initial?.category ?? 'community');
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [costPerPerson, setCostPerPerson] = useState(initial?.costPerPerson ?? '');
  const [dressCode, setDressCode] = useState(initial?.dressCode ?? '');
  const [coverTheme, setCoverTheme] = useState<CoverTheme>(initial?.coverTheme ?? 'sunset');
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? '');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [titleFont, setTitleFont] = useState<TitleFont>(initial?.titleFont ?? 'classic');
  const [effect, setEffect] = useState<Effect>(initial?.effect ?? 'none');
  const [date, setDate] = useState<Date>(initial?.date ?? defaultDate());
  const [maxGuests, setMaxGuests] = useState(
    initial?.maxGuests != null ? String(initial.maxGuests) : ''
  );
  const [plusOneLimit, setPlusOneLimit] = useState<number>(initial?.plusOneLimit ?? 1);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [effectPickerOpen, setEffectPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Mood-aware ink for the few labels/CTAs that sit directly on the gradient.
  const ink = themeInk(coverTheme);

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
        coverImage,
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

  // Web: apply a value from the native <input type="date|time"> overlay.
  function updateDate(kind: 'date' | 'time', value: string) {
    if (!value) return;
    const next = new Date(date);
    if (kind === 'date') {
      const [y, m, d] = value.split('-').map(Number);
      next.setFullYear(y, m - 1, d);
    } else {
      const [h, min] = value.split(':').map(Number);
      next.setHours(h, min);
    }
    setDate(next);
  }

  // One WHEN button. On web the button is a plain view with an invisible native
  // picker overlaid on top (opens a floating popup — no layout shift). On native
  // it's a Pressable that toggles the inline DateTimePicker below.
  function renderPickerField(kind: 'date' | 'time') {
    const labelText =
      kind === 'date' ? formatEventDate(date.toISOString()) : formatEventTime(date.toISOString());
    if (Platform.OS === 'web') {
      return (
        <View style={styles.dateButtonWrap}>
          <View style={styles.dateButton}>
            <GlassBg ink={ink} />
            <Text style={[styles.dateText, { color: ink.text }]}>{labelText}</Text>
          </View>
          {React.createElement('input', {
            type: kind,
            value: kind === 'date' ? toDateInputValue(date) : toTimeInputValue(date),
            onChange: (e: { target: { value: string } }) => updateDate(kind, e.target.value),
            onClick: (e: { currentTarget: { showPicker?: () => void } }) =>
              e.currentTarget.showPicker?.(),
            'aria-label': kind === 'date' ? 'Event date' : 'Event time',
            style: webPickerOverlayStyle,
          })}
        </View>
      );
    }
    return (
      <PaperPressable
        ink={ink}
        style={styles.dateButton}
        onPress={() => setPicker(picker === kind ? null : kind)}
      >
        <Text style={[styles.dateText, { color: ink.text }]}>{labelText}</Text>
      </PaperPressable>
    );
  }

  async function onPickPhoto() {
    if (uploadingCover) return;
    setUploadingCover(true);
    const url = await pickCoverImage();
    if (url) setCoverImage(url);
    setUploadingCover(false);
  }

  return (
    <ThemeBackground theme={coverTheme}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.formHeader}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.formClose}>
            <GlassBg ink={ink} r={18} />
            <Text style={[styles.formCloseText, { color: ink.text }]}>✕</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={saving}
            style={[
              styles.formSave,
              { backgroundColor: ink.dark ? '#fff' : colors.ink, opacity: saving ? 0.5 : 1 },
            ]}
          >
            <Text style={[styles.formSaveText, { color: ink.dark ? colors.ink : '#fff' }]}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
        <PaperPressable
          ink={ink}
          radius={radius.pill}
          onPress={() => setIsPublic(!isPublic)}
          style={styles.publicPill}
        >
          <Text style={[styles.publicPillText, { color: ink.subtext }]}>
            {isPublic ? '🌐 Public — anyone can find it' : '🔒 Private — invite only'}
          </Text>
          <Text style={[styles.publicPillAction, { color: ink.dark ? colors.accent : colors.accentDark }]}>
            {isPublic ? 'Make private' : 'Make it public'}
          </Text>
        </PaperPressable>

        {/* Title first, with the font picker directly beneath it — the poster
            editor order from the reference. */}
        <PaperField
          ink={ink}
          label="Event title"
          labelColor={ink.faint}
          value={title}
          onChangeText={setTitle}
          placeholder="Untitled Event"
          maxLength={LIMITS.title}
          // Pin the line box so switching fonts only swaps the glyphs — the
          // field keeps the same height instead of growing for tall faces
          // (Pacifico/Bungee) and shrinking for compact ones.
          style={[titleFontStyle(titleFont), styles.titleFieldInput]}
        />

        <View style={styles.fontBar}>
          <GlassBg ink={ink} r={radius.pill} />
          {TITLE_FONTS.map((f) => {
            const selected = titleFont === f;
            return (
              <Pressable
                key={f}
                onPress={() => setTitleFont(f)}
                style={[
                  styles.fontSeg,
                  selected && {
                    backgroundColor: ink.dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.62)',
                    borderColor: ink.dark ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.95)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.fontSegText,
                    titleFontStyle(f),
                    { color: selected ? ink.text : ink.subtext },
                  ]}
                  numberOfLines={1}
                >
                  {TITLE_FONT_LABELS[f]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* The cover the guest will see — framed against the full-screen theme. */}
        <CoverGradient theme={coverTheme} image={coverImage} style={styles.preview}>
          <Burst size={44} rays={8} color="rgba(255,255,255,0.9)" rotate={-12} style={styles.previewBurst} />
          <Text style={styles.previewKicker}>Live preview</Text>
          <Text style={[styles.previewTitle, titleFontStyle(titleFont)]} numberOfLines={3}>
            {title.trim() || 'Untitled Event'}
          </Text>
        </CoverGradient>

        <View style={styles.photoRow}>
          <PaperPressable ink={ink} style={styles.photoBtn} onPress={onPickPhoto} disabled={uploadingCover}>
            <Text style={[styles.cardBtnText, { color: ink.text }]}>
              {uploadingCover
                ? 'Uploading…'
                : coverImage
                  ? '🖼  Change cover photo'
                  : '🖼  Add cover photo'}
            </Text>
          </PaperPressable>
          {coverImage && !uploadingCover ? (
            <Pressable style={styles.photoRemove} onPress={() => setCoverImage('')} hitSlop={8}>
              <Text style={styles.photoRemoveText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.styleRow}>
          <PaperPressable ink={ink} style={styles.styleBtn} onPress={() => setThemePickerOpen(true)}>
            <Text style={[styles.cardBtnText, { color: ink.text }]}>🎨 Theme</Text>
          </PaperPressable>
          <PaperPressable ink={ink} style={styles.styleBtn} onPress={() => setEffectPickerOpen(true)}>
            <Text style={[styles.cardBtnText, { color: ink.text }]}>✨ Effect</Text>
          </PaperPressable>
        </View>

        <View style={{ gap: spacing.xs }}>
          <SectionLabel color={ink.faint}>When</SectionLabel>
          <View style={styles.dateRow}>
            {renderPickerField('date')}
            {renderPickerField('time')}
          </View>
          {Platform.OS !== 'web' && picker ? (
            <DateTimePicker
              value={date}
              mode={picker}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onPickerChange}
              themeVariant="light"
            />
          ) : null}
        </View>

        <PaperField
          ink={ink}
          label="Where"
          labelColor={ink.faint}
          value={location}
          onChangeText={setLocation}
          placeholder="Location"
          maxLength={LIMITS.location}
        />
        <PaperField
          ink={ink}
          label="City"
          labelColor={ink.faint}
          value={city}
          onChangeText={setCity}
          placeholder="e.g. San Francisco"
          maxLength={80}
        />

        <View style={{ gap: spacing.xs }}>
          <SectionLabel color={ink.faint}>Category</SectionLabel>
          <View style={styles.themeRow}>
            {CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[
                    styles.optionPill,
                    active && {
                      backgroundColor: ink.dark ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.64)',
                      borderColor: ink.dark ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.95)',
                    },
                  ]}
                >
                  {!active ? <GlassBg ink={ink} r={radius.pill} /> : null}
                  <Text style={[styles.chipLabel, { color: active ? ink.text : ink.subtext }]}>
                    {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <PaperField
          ink={ink}
          label="Cost per person (optional)"
          labelColor={ink.faint}
          value={costPerPerson}
          onChangeText={setCostPerPerson}
          placeholder="Free"
          maxLength={60}
        />
        <PaperField
          ink={ink}
          label="Dress code (optional)"
          labelColor={ink.faint}
          value={dressCode}
          onChangeText={setDressCode}
          placeholder="Come as you are"
          maxLength={120}
        />

        <View style={{ gap: 6 }}>
          <SectionLabel color={ink.faint}>Description</SectionLabel>
          <View style={styles.surface}>
            <GlassBg ink={ink} />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add a description of your event"
              placeholderTextColor={ink.faint}
              multiline
              numberOfLines={4}
              maxLength={LIMITS.description}
              style={[styles.input, styles.descInput, { color: ink.text }]}
            />
          </View>
        </View>

        <PaperField
          ink={ink}
          label="Max guests (optional)"
          labelColor={ink.faint}
          value={maxGuests}
          onChangeText={setMaxGuests}
          placeholder="Unlimited spots"
          keyboardType="number-pad"
        />

        <View style={styles.plusOneRow}>
          <GlassBg ink={ink} />
          <Text style={[styles.plusOneLabel, { color: ink.subtext }]}>Plus ones per guest</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => setPlusOneLimit(Math.max(0, plusOneLimit - 1))}
              style={[
                styles.stepButton,
                {
                  backgroundColor: ink.dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.55)',
                  borderColor: ink.hairline,
                },
              ]}
            >
              <Text style={[styles.stepText, { color: ink.text }]}>−</Text>
            </Pressable>
            <Text style={[styles.plusOneValue, { color: ink.text }]}>
              {plusOneLimit === 0 ? 'None' : `+${plusOneLimit}`}
            </Text>
            <Pressable
              onPress={() => setPlusOneLimit(Math.min(LIMITS.plusOnes, plusOneLimit + 1))}
              style={[
                styles.stepButton,
                {
                  backgroundColor: ink.dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.55)',
                  borderColor: ink.hairline,
                },
              ]}
            >
              <Text style={[styles.stepText, { color: ink.text }]}>＋</Text>
            </Pressable>
          </View>
        </View>

        <ErrorText message={error} />
        <Button
          title={submitLabel}
          onPress={submit}
          loading={saving}
          variant={ink.dark ? 'paper' : 'primary'}
        />
        {footer}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Full-screen effect: drifts over everything (pointerEvents none, so it
          never blocks taps and never obscures the opaque controls). */}
      {effect !== 'none' ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <EffectOverlay effect={effect} height={winHeight} count={16} />
        </View>
      ) : null}

      {themePickerOpen ? (
        <ThemePicker
          value={coverTheme}
          onChange={(t) => {
            setCoverTheme(t as CoverTheme);
            setThemePickerOpen(false);
          }}
          onClose={() => setThemePickerOpen(false)}
        />
      ) : null}
      {effectPickerOpen ? (
        <EffectPicker
          value={effect}
          onChange={(e) => {
            setEffect(e as Effect);
            setEffectPickerOpen(false);
          }}
          onClose={() => setEffectPickerOpen(false)}
        />
      ) : null}
    </ThemeBackground>
  );
}

const styles = StyleSheet.create({
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  formClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  formCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  formSave: {
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 10,
    ...shadow.card,
  },
  formSaveText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.section,
  },

  // ── Shared frosted surfaces (translucent; the theme gradient glows through) ──
  surface: {
    borderRadius: radius.md,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardBtnText: {
    ...uiText(15, '700'),
  },
  input: {
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  // Fixed line box so the title field height stays constant across title fonts.
  titleFieldInput: {
    lineHeight: 24,
  },
  sectionLabel: {
    ...kicker(light.text3),
  },

  // ── Live preview ──
  preview: {
    borderRadius: radius.lg,
    minHeight: 230,
    padding: spacing.md,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.ink,
    ...shadow.float,
  },
  previewBurst: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  previewKicker: {
    ...kicker(),
    color: 'rgba(255,255,255,0.9)',
    marginBottom: spacing.xs,
  },
  previewTitle: {
    color: '#fff',
    ...display(38),
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  // ── Public toggle ──
  publicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  publicPillText: {
    color: light.text2,
    ...uiText(13, '600'),
    flexShrink: 1,
  },
  publicPillAction: {
    color: colors.accentDark,
    ...uiText(13, '700'),
  },

  // ── Photo / style buttons ──
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  photoBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  photoRemove: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  photoRemoveText: {
    color: '#fff',
    ...uiText(14, '700'),
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  styleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  styleBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },

  // ── Font segmented control ──
  fontBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    padding: 4,
    gap: 2,
  },
  fontSeg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fontSegText: {
    fontSize: 15,
  },

  // ── Date / time ──
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  // Web wraps each date button so the invisible native <input> overlay can be
  // absolutely positioned over it (opens the picker without shifting the form).
  dateButtonWrap: {
    flex: 1,
    position: 'relative',
  },
  dateButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dateText: {
    color: colors.text,
    ...uiText(16, '600'),
  },

  // ── Category pills ──
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionPill: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  chipLabel: {
    ...uiText(13, '600'),
  },

  // ── Description ──
  descInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },

  // ── Plus-one stepper ──
  plusOneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  plusOneLabel: {
    color: light.text2,
    ...uiText(15, '600'),
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stepText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  plusOneValue: {
    color: colors.text,
    ...uiText(16, '800'),
    minWidth: 44,
    textAlign: 'center',
  },
});
