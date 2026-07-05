import React, { useEffect, useState } from 'react';
import {
  Keyboard,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  CATEGORIES,
  CATEGORY_META,
  DESCRIPTION_SCALE,
  LIMITS,
  TITLE_FONTS,
  type Category,
  type CoverTheme,
  type Effect,
  type EventInput,
  type TitleFont,
} from '../shared/types';
import { colors, light, radius, shadow, spacing } from '../lib/theme';
import { coverFor } from '../lib/covers';
import { TITLE_FONT_LABELS, titleFontStyle, kicker, uiText } from '../lib/fonts';
import { CoverGradient } from './CoverGradient';
import { EFFECT_META, EffectOverlay } from './EffectOverlay';
import { Button, ErrorText } from './ui';
import { CityPicker } from './CityPicker';
import { EventSettingsSheet } from './EventSettingsSheet';
import { Glass } from './glass';
import { ThemePicker, EffectPicker } from './themes';
import { ScreenBackground } from './ScreenBackground';
import { DescriptionEditor } from './DescriptionEditor';
import { Burst } from './partiful';
import { formatEventDate, formatEventTime } from './EventCard';
import { pickCoverImage } from '../lib/imageUpload';

export interface EventFormValues {
  title: string;
  description: string;
  descriptionScale: number;
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

// ── Local "paper" primitives ──────────────────────────────────────────────────
// The form sits on the calm warm "linen" surface shared with the rest of the
// app, so every control is a solid, opaque paper card (near-black ink on warm
// white) that lifts off the canvas with a soft shadow. The chosen theme shows
// only in the live-preview cover, its taskbar swatch, and the picker — never as
// a full-screen wash.

function SectionLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={[styles.sectionLabel, color ? { color } : null]}>{children}</Text>;
}

// A tappable paper card — the base for every button/row on the form.
function PaperPressable({
  onPress,
  disabled,
  style,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
    >
      {children}
    </Pressable>
  );
}

function PaperField({
  label,
  labelColor,
  style,
  ...props
}: TextInputProps & { label?: string; labelColor?: string; style?: TextInputProps['style'] }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <SectionLabel color={labelColor}>{label}</SectionLabel> : null}
      <View style={styles.inputCard}>
        <TextInput placeholderTextColor={colors.muted} style={[styles.input, style]} {...props} />
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
  const [descriptionScale, setDescriptionScale] = useState<number>(
    initial?.descriptionScale ?? DESCRIPTION_SCALE.default
  );
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
  const [descriptionEditorOpen, setDescriptionEditorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const insets = useSafeAreaInsets();

  // Hide the floating taskbar while typing — on Android the window resizes for
  // the keyboard, which would otherwise park the bar right on top of the
  // focused field (and swallow the taps meant to refocus it).
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardOpen(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardOpen(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // The form now sits on the calm linen canvas (like the calendar), so labels
  // and controls use fixed dark-on-light ink instead of a mood that flipped
  // with the theme gradient.
  const ink = {
    dark: false,
    text: colors.text,
    faint: light.text3,
    glassTint: 'light' as const,
    hairline: light.hairline,
  };
  const cover = coverFor(coverTheme);
  const effectMeta = effect === 'none' ? null : EFFECT_META.find((e) => e.key === effect);
  // Dot on the Settings gear when values that only live in the sheet are set —
  // e.g. a party-starter template seeded a dress code the user hasn't seen.
  const hasHiddenSettings =
    Boolean(costPerPerson.trim() || dressCode.trim() || maxGuests.trim()) || plusOneLimit !== 1;

  async function submit() {
    if (!title.trim()) {
      setError('Give your party a name!');
      return;
    }
    const guests = maxGuests.trim() ? Number(maxGuests.trim()) : null;
    if (guests != null && (!Number.isInteger(guests) || guests < 1 || guests > LIMITS.maxGuests)) {
      setError(`Max guests (in Settings) must be a whole number between 1 and ${LIMITS.maxGuests}`);
      // The field lives in the settings sheet now — open it so the error
      // points at something the user can see.
      setSettingsOpen(true);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        descriptionScale,
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
          <View style={[styles.card, styles.dateButton]}>
            <Text style={styles.dateText}>{labelText}</Text>
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
        style={styles.dateButton}
        onPress={() => setPicker(picker === kind ? null : kind)}
      >
        <Text style={styles.dateText}>{labelText}</Text>
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
    <ScreenBackground>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.formHeader}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={10}
            style={styles.formClose}
          >
            <Text style={styles.formCloseText}>✕</Text>
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
        {/* Title and its typeface live in ONE box — the name up top, the four
            font choices right beneath it, like the reference poster editor. */}
        <View style={styles.titleBox}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Untitled Event"
            placeholderTextColor={colors.muted}
            maxLength={LIMITS.title}
            // Pin the line box so switching fonts only swaps the glyphs — the
            // field keeps the same height instead of growing for tall faces
            // (Pacifico/Bungee) and shrinking for compact ones.
            style={[styles.titleInput, titleFontStyle(titleFont)]}
          />
          <View style={styles.fontBar}>
            {TITLE_FONTS.map((f) => {
              const selected = titleFont === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setTitleFont(f)}
                  style={[styles.fontSeg, selected && styles.fontSegActive]}
                >
                  <Text
                    style={[
                      styles.fontSegText,
                      titleFontStyle(f),
                      { color: selected ? '#fff' : light.text3 },
                    ]}
                    numberOfLines={1}
                  >
                    {TITLE_FONT_LABELS[f]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* The cover the guest will see — framed against the full-screen theme. */}
        <CoverGradient theme={coverTheme} image={coverImage} style={styles.preview}>
          <Burst size={44} rays={8} color="rgba(255,255,255,0.9)" rotate={-12} style={styles.previewBurst} />
          <Text style={styles.previewKicker}>Live preview</Text>
        </CoverGradient>

        <View style={styles.photoRow}>
          <PaperPressable style={styles.photoBtn} onPress={onPickPhoto} disabled={uploadingCover}>
            <Text style={styles.cardBtnText}>
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

        <PaperPressable onPress={() => setIsPublic(!isPublic)} style={styles.publicPill}>
          <Text style={styles.publicPillText}>
            {isPublic ? '🌐 Public — anyone can find it' : '🔒 Private — invite only'}
          </Text>
          <Text style={styles.publicPillAction}>
            {isPublic ? 'Make private' : 'Make it public'}
          </Text>
        </PaperPressable>

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
          label="Where"
          labelColor={ink.faint}
          value={location}
          onChangeText={setLocation}
          placeholder="Location"
          maxLength={LIMITS.location}
        />
        <CityPicker label="City" labelColor={ink.faint} value={city} onChange={setCity} />

        <View style={{ gap: spacing.xs }}>
          <SectionLabel color={ink.faint}>Category</SectionLabel>
          <View style={styles.themeRow}>
            {CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[styles.optionPill, active && styles.optionPillActive]}
                >
                  <Text style={[styles.chipLabel, { color: active ? '#fff' : light.text2 }]}>
                    {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Collapsed to a compact row — tapping opens the full-screen note
            editor (bullets, font size) instead of a big always-open box. */}
        <View style={{ gap: spacing.xs }}>
          <SectionLabel color={ink.faint}>Description</SectionLabel>
          <PaperPressable style={styles.descButton} onPress={() => setDescriptionEditorOpen(true)}>
            <View style={styles.descButtonBody}>
              {description.trim() ? (
                <Text style={styles.descPreview} numberOfLines={3}>
                  {description.trim()}
                </Text>
              ) : (
                <Text style={styles.descPlaceholder}>Add a description of your event</Text>
              )}
            </View>
            <Ionicons name="create-outline" size={20} color={colors.muted} />
          </PaperPressable>
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

      {/* Floating mini taskbar — Theme, Effect, Settings (reference order).
          Glass pinned above the bottom edge; the form scrolls underneath it. */}
      {keyboardOpen ? null : (
      <View
        pointerEvents="box-none"
        style={[styles.taskbarWrap, { bottom: insets.bottom + spacing.sm }]}
      >
        <Glass
          tint={ink.glassTint}
          intensity={40}
          radius={radius.pill}
          border
          fill={ink.dark ? 'rgba(15,12,24,0.45)' : 'rgba(255,255,255,0.5)'}
          style={styles.taskbar}
        >
          <Pressable style={styles.taskbarItem} onPress={() => setThemePickerOpen(true)}>
            <View style={[styles.taskbarSwatch, { borderColor: ink.hairline }]}>
              <LinearGradient
                colors={cover.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <Text style={[styles.taskbarLabel, { color: ink.text }]}>Theme</Text>
          </Pressable>
          <Pressable style={styles.taskbarItem} onPress={() => setEffectPickerOpen(true)}>
            <View
              style={[styles.taskbarSwatch, styles.taskbarEffectSwatch, { borderColor: ink.hairline }]}
            >
              {effectMeta ? (
                <Text style={styles.taskbarEffectEmoji}>{effectMeta.emoji}</Text>
              ) : (
                <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
              )}
            </View>
            <Text style={[styles.taskbarLabel, { color: ink.text }]}>Effect</Text>
          </Pressable>
          <Pressable style={styles.taskbarItem} onPress={() => setSettingsOpen(true)}>
            <View style={styles.taskbarIconWrap}>
              <Ionicons name="settings-sharp" size={26} color={ink.text} />
              {hasHiddenSettings ? <View style={styles.taskbarDot} /> : null}
            </View>
            <Text style={[styles.taskbarLabel, { color: ink.text }]}>Settings</Text>
          </Pressable>
        </Glass>
      </View>
      )}

      {/* Full-screen effect: drifts over everything (pointerEvents none, so it
          never blocks taps and never obscures the opaque controls). */}
      {effect !== 'none' ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <EffectOverlay effect={effect} height={winHeight} count={16} />
        </View>
      ) : null}

      {descriptionEditorOpen ? (
        <DescriptionEditor
          value={description}
          scale={descriptionScale}
          onChangeText={setDescription}
          onChangeScale={setDescriptionScale}
          onClose={() => setDescriptionEditorOpen(false)}
        />
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
      {settingsOpen ? (
        <EventSettingsSheet
          isPublic={isPublic}
          onTogglePublic={() => setIsPublic(!isPublic)}
          maxGuests={maxGuests}
          onChangeMaxGuests={(v) => setMaxGuests(v.replace(/\D/g, ''))}
          plusOneLimit={plusOneLimit}
          onChangePlusOneLimit={setPlusOneLimit}
          costPerPerson={costPerPerson}
          onChangeCostPerPerson={setCostPerPerson}
          dressCode={dressCode}
          onChangeDressCode={setDressCode}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  formClose: {
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
    // Keep the top shallow so the title and the full 1:1 cover preview fit
    // above the floating taskbar without scrolling.
    paddingTop: spacing.sm,
    gap: spacing.lg,
    // Extra room at the end so the submit button scrolls clear of the
    // floating taskbar.
    paddingBottom: spacing.section + 72,
  },

  // ── Shared paper surfaces (opaque; lift off the gradient with a shadow) ──
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    ...shadow.card,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardBtnText: {
    color: colors.text,
    ...uiText(15, '700'),
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
  },
  // ── Title box (name + font picker as one unit) ──
  titleBox: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.sm,
    ...shadow.card,
  },
  // Fixed line box so the title field height stays constant across title fonts.
  titleInput: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 40,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  sectionLabel: {
    ...kicker(light.text3),
  },

  // ── Live preview ──
  preview: {
    borderRadius: radius.lg,
    aspectRatio: 1,
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
    color: colors.accentDark,
    ...uiText(14, '700'),
  },
  // ── Font segmented control (inset row of the title box) ──
  fontBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    padding: 4,
    gap: 2,
  },
  fontSeg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 2,
    borderRadius: radius.pill,
  },
  fontSegActive: {
    backgroundColor: colors.ink,
  },
  // Small enough that the widest face (Bungee "Eclectic") fits its segment.
  fontSegText: {
    fontSize: 13,
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    ...shadow.card,
  },
  optionPillActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipLabel: {
    ...uiText(13, '600'),
  },

  // ── Description (compact row → full-screen note editor) ──
  descButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  descButtonBody: {
    flex: 1,
  },
  descPreview: {
    color: colors.text,
    ...uiText(15, '500', { lineHeight: 1.4 }),
  },
  descPlaceholder: {
    color: colors.muted,
    ...uiText(16, '400'),
  },

  // ── Floating mini taskbar (Theme / Effect / Settings) ──
  taskbarWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
  },
  taskbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    ...shadow.float,
  },
  taskbarItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  taskbarSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskbarEffectSwatch: {
    backgroundColor: 'rgba(30,26,48,0.7)',
  },
  taskbarEffectEmoji: {
    fontSize: 17,
  },
  taskbarIconWrap: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskbarDot: {
    position: 'absolute',
    top: 2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  taskbarLabel: {
    ...uiText(12, '600'),
  },
});
