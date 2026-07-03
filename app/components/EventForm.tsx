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
import type { CoverTheme, EventInput } from '../../shared/types';
import { colors, radius, spacing } from '../lib/theme';
import { COVER_LIST } from '../lib/covers';
import { CoverGradient } from './CoverGradient';
import { Button, ErrorText, Field } from './ui';
import { formatEventDate, formatEventTime } from './EventCard';

export interface EventFormValues {
  title: string;
  description: string;
  location: string;
  coverTheme: CoverTheme;
  date: Date;
  maxGuests: number | null;
}

interface Props {
  initial?: Partial<EventFormValues>;
  submitLabel: string;
  onSubmit: (data: EventInput) => Promise<void>;
}

function defaultDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(19, 0, 0, 0);
  return d;
}

export function EventForm({ initial, submitLabel, onSubmit }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [coverTheme, setCoverTheme] = useState<CoverTheme>(initial?.coverTheme ?? 'sunset');
  const [date, setDate] = useState<Date>(initial?.date ?? defaultDate());
  const [maxGuests, setMaxGuests] = useState(
    initial?.maxGuests != null ? String(initial.maxGuests) : ''
  );
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) {
      setError('Give your party a name!');
      return;
    }
    const guests = maxGuests.trim() ? Number(maxGuests.trim()) : null;
    if (guests != null && (!Number.isInteger(guests) || guests < 1)) {
      setError('Max guests must be a whole number');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        coverTheme,
        date: date.toISOString(),
        maxGuests: guests,
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <CoverGradient theme={coverTheme} style={styles.preview}>
          <Text style={styles.previewTitle} numberOfLines={3}>
            {title.trim() || 'Untitled Event'}
          </Text>
        </CoverGradient>

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

        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Untitled Event" />

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
            <DateTimePicker
              value={date}
              mode={picker}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onPickerChange}
              themeVariant="dark"
            />
          ) : null}
        </View>

        <Field
          label="Where"
          value={location}
          onChangeText={setLocation}
          placeholder="Location"
        />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Add a description of your event"
          multiline
          numberOfLines={4}
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />
        <Field
          label="Max guests (optional)"
          value={maxGuests}
          onChangeText={setMaxGuests}
          placeholder="Unlimited spots"
          keyboardType="number-pad"
        />

        <ErrorText message={error} />
        <Button title={submitLabel} onPress={submit} loading={saving} />
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
});
