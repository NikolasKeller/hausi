import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LIMITS } from '../shared/types';
import { colors, radius, shadow, spacing } from '../lib/theme';
import { DISPLAY_FONT, uiText } from '../lib/fonts';

const BASE_SIZE = 16;

// A full-screen "note page" for the event description: a plain multiline text
// area on paper. `scale`/`onChangeScale` are kept for caller compatibility but
// are no longer editable here.
export function DescriptionEditor({
  value,
  onChangeText,
  onClose,
}: {
  value: string;
  scale: number;
  onChangeText: (text: string) => void;
  onChangeScale: (scale: number) => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Description</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.doneBtn}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={styles.sheet}>
            <TextInput
              value={value}
              onChangeText={onChangeText}
              autoFocus
              multiline
              placeholder={"Write the details - who, what, and why it'll be great."}
              placeholderTextColor={colors.muted}
              maxLength={LIMITS.description}
              textAlignVertical="top"
              style={[styles.input, { fontSize: BASE_SIZE, lineHeight: Math.round(BASE_SIZE * 1.5) }]}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    zIndex: 60,
  },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  backBtn: {
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
  headerTitle: {
    ...uiText(17, '700'),
    color: colors.text,
  },
  doneBtn: {
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: colors.ink,
    ...shadow.card,
  },
  doneText: {
    ...uiText(15, '600'),
    color: colors.onInk,
  },
  body: { flex: 1 },
  sheet: {
    flex: 1,
    margin: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: DISPLAY_FONT,
  },
});
