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
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  DESCRIPTION_SCALE,
  LIMITS,
  type Category,
  type CoverTheme,
  type Effect,
  type EventInput,
  type TitleFont,
} from '../shared/types';
import { colors, light, radius, shadow, spacing } from '../lib/theme';
import { coverFor } from '../lib/covers';
import { titleFontStyle, kicker, uiText } from '../lib/fonts';
import { CoverGradient } from './CoverGradient';
import { EFFECT_META } from './EffectOverlay';
import { Button, ErrorText } from './ui';
import { LocationPicker } from './LocationPicker';
import { EventSettingsSheet } from './EventSettingsSheet';
import { DateTimeSheet } from './DateTimeSheet';
import { Glass } from './glass';
import { ThemePicker, EffectPicker, ThemeBackground } from './themes';
import { DescriptionEditor } from './DescriptionEditor';
import { Burst } from './partiful';
import { formatEventDate, formatEventTime } from './EventCard';
import { ImageCropSheet } from './ImageCropSheet';
import { pickRawImage, uploadCroppedImage, type CropRect } from '../lib/imageUpload';
import { mediaUrl } from '../lib/api';

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
// The form sits on the selected THEME rendered as the full-page background
// (same ThemeBackground as the live event page), so hosts see exactly what
// guests will get. Controls stay solid, opaque dark cards on top. The square
// preview only appears once a cover photo is uploaded — the theme itself is
// the page, not the square.

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

function defaultDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(19, 0, 0, 0);
  return d;
}

export function EventForm({ initial, submitLabel, onSubmit, footer }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [descriptionScale, setDescriptionScale] = useState<number>(
    initial?.descriptionScale ?? DESCRIPTION_SCALE.default
  );
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
  // The photo being cropped: a freshly picked asset (with pixel dims) or the
  // current cover reopened for a re-crop (dims measured by the sheet).
  const [cropSrc, setCropSrc] = useState<{ uri: string; width?: number; height?: number } | null>(
    null
  );
  const [titleFont] = useState<TitleFont>(initial?.titleFont ?? 'classic');
  const [effect, setEffect] = useState<Effect>(initial?.effect ?? 'none');
  // null until the host actually opens the When picker — "When" is a required
  // field, so we don't silently pre-fill it. The sheet opens at defaultDate().
  const [date, setDate] = useState<Date | null>(initial?.date ?? null);
  const [maxGuests, setMaxGuests] = useState(
    initial?.maxGuests != null ? String(initial.maxGuests) : ''
  );
  const [plusOneLimit, setPlusOneLimit] = useState<number>(initial?.plusOneLimit ?? 1);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
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

  // Name, When and Location are all required — the Save button stays disabled
  // until each is filled, so a half-baked event can't be created (or edited into
  // one). Location can only ever be a real, geocoded place: the LocationPicker
  // never commits free text, so a made-up spot can't be saved.
  const canSave = Boolean(
    title.trim() && date && !Number.isNaN(date.getTime()) && location.trim()
  );

  async function submit() {
    if (!title.trim()) {
      setError('Give your party a name!');
      return;
    }
    if (!date || Number.isNaN(date.getTime())) {
      setError('Pick a date and time for your party!');
      return;
    }
    if (!location.trim()) {
      setError('Add a location - pick a real spot from the list!');
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

  // Pick a new photo, then drop into the in-app cropper.
  async function onPickPhoto() {
    if (uploadingCover) return;
    const picked = await pickRawImage();
    if (picked) setCropSrc({ uri: picked.uri, width: picked.width, height: picked.height });
  }

  // Re-open the cropper on the cover already set, to reposition / zoom it.
  function onAdjustPhoto() {
    if (uploadingCover || !coverImage) return;
    const uri = mediaUrl(coverImage);
    if (uri) setCropSrc({ uri });
  }

  async function onCropConfirm(crop: CropRect) {
    if (!cropSrc) return;
    setUploadingCover(true);
    const url = await uploadCroppedImage(cropSrc.uri, crop);
    if (url) setCoverImage(url);
    setUploadingCover(false);
    setCropSrc(null);
  }

  return (
    <ThemeBackground theme={coverTheme}>
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
        <View style={styles.titleBox}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Untitled Event"
            placeholderTextColor={colors.muted}
            maxLength={LIMITS.title}
            style={[styles.titleInput, titleFontStyle(titleFont)]}
          />
        </View>

        {/* The theme lives on the page background itself; the square is only
            for an uploaded cover photo, so it appears once there is one. */}
        {coverImage ? (
          <CoverGradient theme={coverTheme} image={coverImage} style={styles.preview}>
            <Burst size={44} rays={8} color="rgba(255,255,255,0.9)" rotate={-12} style={styles.previewBurst} />
            <Text style={styles.previewKicker}>Live preview</Text>
          </CoverGradient>
        ) : null}

        <View style={styles.photoRow}>
          <PaperPressable style={styles.photoBtn} onPress={onPickPhoto} disabled={uploadingCover}>
            <Text style={styles.cardBtnText}>
              {uploadingCover
                ? 'Uploading…'
                : coverImage
                  ? 'Change photo'
                  : 'Add cover photo'}
            </Text>
          </PaperPressable>
          {coverImage && !uploadingCover ? (
            <>
              <Pressable style={styles.photoRemove} onPress={onAdjustPhoto} hitSlop={8}>
                <Text style={styles.photoRemoveText}>Adjust</Text>
              </Pressable>
              <Pressable style={styles.photoRemove} onPress={() => setCoverImage('')} hitSlop={8}>
                <Text style={styles.photoRemoveText}>Remove</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        <View style={{ gap: spacing.xs }}>
          <SectionLabel color={ink.faint}>When</SectionLabel>
          <PaperPressable
            style={styles.whenButton}
            onPress={() => {
              // Seed a sensible default the first time When opens so the picker
              // starts on a real value the host can accept or adjust.
              if (!date) setDate(defaultDate());
              setDateSheetOpen(true);
            }}
          >
            <Text style={[styles.dateText, !date && styles.datePlaceholder]}>
              {date
                ? `${formatEventDate(date.toISOString())} · ${formatEventTime(date.toISOString())}`
                : 'Add a date & time'}
            </Text>
          </PaperPressable>
        </View>

        <LocationPicker
          label="Location"
          labelColor={ink.faint}
          value={location}
          city={city}
          onChange={(loc, cty) => {
            setLocation(loc);
            setCity(cty);
          }}
        />

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
          disabled={!canSave}
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
          tint="dark"
          intensity={40}
          radius={radius.pill}
          border
          fill="rgba(24,24,27,0.94)"
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
      {dateSheetOpen ? (
        <DateTimeSheet
          date={date ?? defaultDate()}
          onChange={setDate}
          onClose={() => setDateSheetOpen(false)}
        />
      ) : null}
      {cropSrc ? (
        <ImageCropSheet
          uri={cropSrc.uri}
          width={cropSrc.width}
          height={cropSrc.height}
          busy={uploadingCover}
          onCancel={() => setCropSrc(null)}
          onConfirm={onCropConfirm}
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
    </ThemeBackground>
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
    fontWeight: '600',
    color: colors.text,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: spacing.lg,
    // Enough breathing room under the close button so the title card's top
    // edge doesn't crowd the ✕ — but still shallow enough that the title and
    // the full 1:1 cover preview fit above the floating taskbar.
    paddingTop: spacing.md,
    gap: spacing.lg,
    // Extra room at the end so the submit button scrolls clear of the
    // floating taskbar.
    paddingBottom: spacing.section + 72,
  },

  // ── Shared paper surfaces (opaque; lift off the gradient with a shadow) ──
  card: {
    // Flat paper field, Partiful-style: a thin hairline instead of a puffy
    // drop shadow, so buttons sit calmly on the linen canvas.
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardBtnText: {
    // Medium weight, not heavy — matches Partiful's calm field labels.
    color: colors.text,
    ...uiText(15, '600'),
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
  // Fixed box height (instead of lineHeight) keeps the field constant across
  // title fonts AND keeps the glyphs vertically centered: iOS pushes a
  // single-line TextInput's text down and clips it when lineHeight exceeds
  // the font size.
  titleInput: {
    color: colors.text,
    fontSize: 26,
    height: 56,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
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
    ...uiText(14, '600'),
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
  datePlaceholder: {
    color: colors.muted,
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
