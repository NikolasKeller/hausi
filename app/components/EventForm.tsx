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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
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
import { DateTimeSheet } from './DateTimeSheet';
import { Glass } from './glass';
import { ThemePicker, EffectPicker } from './themes';
import { ScreenBackground } from './ScreenBackground';
import { Burst } from './partiful';
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

export function EventForm({ initial, submitLabel, onSubmit, footer }: Props) {
  const router = useRouter();
  const { height: winHeight } = useWindowDimensions();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  // Category is no longer edited on the form — kept at its default (or the
  // event's existing value) so the payload stays valid.
  const category: Category = initial?.category ?? 'community';
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
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [effectPickerOpen, setEffectPickerOpen] = useState(false);
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

        <View style={{ gap: spacing.xs }}>
          <SectionLabel color={ink.faint}>When</SectionLabel>
          <PaperPressable style={styles.whenButton} onPress={() => setDateSheetOpen(true)}>
            <Text style={styles.dateText}>
              {formatEventDate(date.toISOString())} · {formatEventTime(date.toISOString())}
            </Text>
          </PaperPressable>
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

        <View style={{ gap: 6 }}>
          <SectionLabel color={ink.faint}>Description</SectionLabel>
          <View style={styles.inputCard}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add a description of your event"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
              maxLength={LIMITS.description}
              style={[styles.input, styles.descInput]}
            />
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
      {dateSheetOpen ? (
        <DateTimeSheet
          date={date}
          onChange={setDate}
          onClose={() => setDateSheetOpen(false)}
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

  // ── Date / time (one combined button, opens the Date & Time sheet) ──
  whenButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  dateText: {
    color: colors.text,
    ...uiText(16, '600'),
  },

  // ── Description ──
  descInput: {
    minHeight: 100,
    textAlignVertical: 'top',
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
