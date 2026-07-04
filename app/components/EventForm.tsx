import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useHeaderHeight } from '@react-navigation/elements';
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
import { colors, light, radius, spacing } from '../lib/theme';
import { themeInk } from '../lib/covers';
import { TITLE_FONT_LABELS, titleFontStyle, display, kicker, uiText } from '../lib/fonts';
import { CoverGradient } from './CoverGradient';
import { Button, ErrorText } from './ui';
import { Glass, GlassField, GlassPill } from './glass';
import { ThemeBackground, ThemePicker, EffectPicker } from './themes';
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
  backgroundColor: 'rgba(255,255,255,0.42)',
  color: '#0A0A0A',
  colorScheme: 'light',
  border: '1px solid rgba(255,255,255,0.55)',
  borderRadius: '14px',
  padding: '12px',
  fontSize: '16px',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
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

  async function onPickPhoto() {
    if (uploadingCover) return;
    setUploadingCover(true);
    const url = await pickCoverImage();
    if (url) setCoverImage(url);
    setUploadingCover(false);
  }

  return (
    <ThemeBackground theme={coverTheme} effect={effect}>
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
        <Pressable onPress={() => setIsPublic(!isPublic)}>
          <GlassPill tint={ink.glassTint} style={styles.publicPill}>
            <Text style={[styles.publicPillText, { color: ink.subtext }]}>
              {isPublic ? '🌐 Public — anyone can find it' : '🔒 Private — invite only'}
            </Text>
            <Text style={[styles.publicPillAction, { color: ink.text }]}>
              {isPublic ? 'Make private' : 'Make it public'}
            </Text>
          </GlassPill>
        </Pressable>

        <CoverGradient theme={coverTheme} image={coverImage} style={styles.preview}>
          <Burst size={44} rays={8} color={colors.helio} rotate={-12} style={styles.previewBurst} />
          <Text style={styles.previewKicker}>Live preview</Text>
          <Text style={[styles.previewTitle, titleFontStyle(titleFont)]} numberOfLines={3}>
            {title.trim() || 'Untitled Event'}
          </Text>
        </CoverGradient>

        <View style={styles.photoRow}>
          <Pressable style={styles.photoBtnWrap} onPress={onPickPhoto} disabled={uploadingCover}>
            <Glass radius={radius.md} intensity={24} tint={ink.glassTint} style={styles.photoBtn}>
              <Text style={[styles.photoBtnText, { color: ink.text }]}>
                {uploadingCover
                  ? 'Uploading…'
                  : coverImage
                    ? '🖼  Change cover photo'
                    : '🖼  Add cover photo'}
              </Text>
            </Glass>
          </Pressable>
          {coverImage && !uploadingCover ? (
            <Pressable style={styles.photoRemove} onPress={() => setCoverImage('')} hitSlop={8}>
              <Text style={styles.photoRemoveText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.styleRow}>
          <Pressable style={styles.styleBtnWrap} onPress={() => setThemePickerOpen(true)}>
            <Glass radius={radius.md} intensity={24} tint={ink.glassTint} style={styles.styleBtn}>
              <Text style={[styles.styleBtnText, { color: ink.text }]}>🎨 Theme</Text>
            </Glass>
          </Pressable>
          <Pressable style={styles.styleBtnWrap} onPress={() => setEffectPickerOpen(true)}>
            <Glass radius={radius.md} intensity={24} tint={ink.glassTint} style={styles.styleBtn}>
              <Text style={[styles.styleBtnText, { color: ink.text }]}>✨ Effect</Text>
            </Glass>
          </Pressable>
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={[styles.label, { color: ink.faint }]}>Title font</Text>
          <View style={styles.fontRow}>
            {TITLE_FONTS.map((f, i) => (
              <Pressable
                key={f}
                onPress={() => setTitleFont(f)}
                style={[
                  styles.fontChipWrap,
                  { transform: [{ rotate: `${(i % 2 === 0 ? -1 : 1) * 3}deg` }] },
                ]}
              >
                <Glass
                  radius={radius.md}
                  intensity={titleFont === f ? 40 : 24}
                  tint={ink.glassTint}
                  fill={
                    titleFont === f
                      ? ink.dark
                        ? 'rgba(255,255,255,0.18)'
                        : 'rgba(255,255,255,0.34)'
                      : undefined
                  }
                  style={styles.fontChip}
                >
                  <Text style={[styles.fontChipSample, titleFontStyle(f), { color: ink.text }]}>Aa</Text>
                  <Text style={[styles.chipLabel, { color: ink.subtext }]}>{TITLE_FONT_LABELS[f]}</Text>
                </Glass>
              </Pressable>
            ))}
          </View>
        </View>

        <GlassField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Untitled Event"
          maxLength={LIMITS.title}
        />

        <View style={{ gap: spacing.xs }}>
          <Text style={[styles.label, { color: ink.faint }]}>When</Text>
          <View style={styles.dateRow}>
            <Pressable
              style={styles.dateButtonWrap}
              onPress={() => setPicker(picker === 'date' ? null : 'date')}
            >
              <Glass radius={14} intensity={24} tint={ink.glassTint} style={styles.dateButton}>
                <Text style={[styles.dateText, { color: ink.text }]}>{formatEventDate(date.toISOString())}</Text>
              </Glass>
            </Pressable>
            <Pressable
              style={styles.dateButtonWrap}
              onPress={() => setPicker(picker === 'time' ? null : 'time')}
            >
              <Glass radius={14} intensity={24} tint={ink.glassTint} style={styles.dateButton}>
                <Text style={[styles.dateText, { color: ink.text }]}>{formatEventTime(date.toISOString())}</Text>
              </Glass>
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

        <GlassField
          label="Where"
          value={location}
          onChangeText={setLocation}
          placeholder="Location"
          maxLength={LIMITS.location}
        />
        <GlassField
          label="City"
          value={city}
          onChangeText={setCity}
          placeholder="e.g. San Francisco"
          maxLength={80}
        />

        <View style={{ gap: spacing.xs }}>
          <Text style={[styles.label, { color: ink.faint }]}>Category</Text>
          <View style={styles.themeRow}>
            {CATEGORIES.map((cat) => (
              <Pressable key={cat} onPress={() => setCategory(cat)}>
                <GlassPill active={category === cat} tint={ink.glassTint} style={styles.optionPill}>
                  <Text style={[styles.chipLabel, { color: ink.subtext }]}>
                    {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                  </Text>
                </GlassPill>
              </Pressable>
            ))}
          </View>
        </View>

        <GlassField
          label="Cost per person (optional)"
          value={costPerPerson}
          onChangeText={setCostPerPerson}
          placeholder="Free"
          maxLength={60}
        />
        <GlassField
          label="Dress code (optional)"
          value={dressCode}
          onChangeText={setDressCode}
          placeholder="Come as you are"
          maxLength={120}
        />

        <View style={{ gap: 6 }}>
          <Text style={[styles.glassFieldLabel, { color: ink.faint }]}>Description</Text>
          <Glass radius={14} intensity={24} tint={ink.glassTint} style={styles.descPanel}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add a description of your event"
              placeholderTextColor={ink.faint}
              multiline
              numberOfLines={4}
              maxLength={LIMITS.description}
              style={[styles.descInput, { color: ink.text }]}
            />
          </Glass>
        </View>

        <GlassField
          label="Max guests (optional)"
          value={maxGuests}
          onChangeText={setMaxGuests}
          placeholder="Unlimited spots"
          keyboardType="number-pad"
        />

        <Glass radius={radius.md} intensity={24} tint={ink.glassTint} style={styles.plusOneRow}>
          <Text style={[styles.plusOneLabel, { color: ink.subtext }]}>Plus ones per guest</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => setPlusOneLimit(Math.max(0, plusOneLimit - 1))}
              style={styles.stepButtonWrap}
            >
              <Glass radius={18} intensity={30} tint={ink.glassTint} style={styles.stepButton}>
                <Text style={[styles.stepText, { color: ink.text }]}>−</Text>
              </Glass>
            </Pressable>
            <Text style={[styles.plusOneValue, { color: ink.text }]}>
              {plusOneLimit === 0 ? 'None' : `+${plusOneLimit}`}
            </Text>
            <Pressable
              onPress={() => setPlusOneLimit(Math.min(LIMITS.plusOnes, plusOneLimit + 1))}
              style={styles.stepButtonWrap}
            >
              <Glass radius={18} intensity={30} tint={ink.glassTint} style={styles.stepButton}>
                <Text style={[styles.stepText, { color: ink.text }]}>＋</Text>
              </Glass>
            </Pressable>
          </View>
        </Glass>

        <ErrorText message={error} />
        <Button title={submitLabel} onPress={submit} loading={saving} variant="primary" />
        {footer}
        </ScrollView>
      </KeyboardAvoidingView>

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
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.section,
  },
  preview: {
    borderRadius: radius.lg,
    minHeight: 230,
    padding: spacing.md,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.ink,
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
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  photoBtnWrap: {
    flex: 1,
  },
  photoBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  photoBtnText: {
    color: light.text2,
    ...uiText(14, '600'),
  },
  photoRemove: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  photoRemoveText: {
    color: colors.danger,
    ...uiText(14, '700'),
  },
  previewTitle: {
    color: '#fff',
    ...display(38),
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  label: {
    ...kicker('rgba(0,0,0,0.5)'),
  },
  glassFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
    color: 'rgba(0,0,0,0.5)',
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  styleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  styleBtnWrap: {
    flex: 1,
  },
  styleBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  styleBtnText: {
    color: light.text,
    ...uiText(15, '700'),
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateButtonWrap: {
    flex: 1,
  },
  dateButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dateText: {
    color: light.text,
    ...uiText(16, '600'),
  },
  fontRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  publicPill: {
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  publicPillText: {
    color: light.text2,
    ...uiText(13, '600'),
    flexShrink: 1,
  },
  publicPillAction: {
    color: light.text,
    ...uiText(13, '700'),
  },
  fontChipWrap: {
    flex: 1,
  },
  fontChip: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
  },
  fontChipSample: {
    color: light.text,
    fontSize: 22,
  },
  optionPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  chipLabel: {
    color: light.text2,
    ...uiText(13, '600'),
  },
  descPanel: {
    padding: 4,
  },
  descInput: {
    color: '#0A0A0A',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  plusOneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  stepButtonWrap: {
    width: 36,
    height: 36,
  },
  stepButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: light.text,
    fontSize: 18,
    fontWeight: '700',
  },
  plusOneValue: {
    color: light.text,
    ...uiText(16, '800'),
    minWidth: 44,
    textAlign: 'center',
  },
});
