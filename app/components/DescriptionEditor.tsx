import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DESCRIPTION_SCALE, LIMITS } from '../shared/types';
import { colors, light, radius, shadow, spacing } from '../lib/theme';
import { DISPLAY_FONT, kicker, uiText } from '../lib/fonts';
import { Glass } from './glass';
import { BULLET } from './RichDescription';

type Selection = { start: number; end: number };

const BASE_SIZE = 16;
const clampScale = (n: number) =>
  Math.max(DESCRIPTION_SCALE.min, Math.min(DESCRIPTION_SCALE.max, n));

// Toggle a "• " prefix on the line(s) the selection touches. Blank lines are
// neutral — they never carry a bullet, so a paragraph gap in the range stays a
// gap (rather than gaining a stray glyph), and it doesn't block a strip. If
// every content line is already bulleted, strip; otherwise add. A lone empty
// line still gets a bullet so tapping on an empty editor starts a list. Returns
// a COLLAPSED caret at the end of the toggled block so the next keystroke
// doesn't replace the just-inserted text; the range for a repeat tap / the
// active state is re-derived from newline boundaries around the caret.
function toggleBullets(text: string, sel: Selection): { text: string; selection: Selection } {
  const lineStart = text.lastIndexOf('\n', sel.start - 1) + 1;
  let lineEnd = text.indexOf('\n', sel.end);
  if (lineEnd === -1) lineEnd = text.length;
  const head = text.slice(0, lineStart);
  const body = text.slice(lineStart, lineEnd);
  const tail = text.slice(lineEnd);
  const lines = body.split('\n');
  const hasBullet = lines.some((l) => l.startsWith(BULLET));
  const hasNonEmpty = lines.some((l) => l !== '');
  const allBulleted = hasBullet && lines.every((l) => l === '' || l.startsWith(BULLET));
  const nextLines = allBulleted
    ? lines.map((l) => (l.startsWith(BULLET) ? l.slice(BULLET.length) : l))
    : lines.map((l) => {
        if (l.startsWith(BULLET)) return l;
        if (l === '' && hasNonEmpty) return l; // keep paragraph-gap lines blank
        return BULLET + l;
      });
  const nextBody = nextLines.join('\n');
  const caret = lineStart + nextBody.length;
  return { text: head + nextBody + tail, selection: { start: caret, end: caret } };
}

function selectionBulleted(text: string, sel: Selection): boolean {
  const lineStart = text.lastIndexOf('\n', sel.start - 1) + 1;
  let lineEnd = text.indexOf('\n', sel.end);
  if (lineEnd === -1) lineEnd = text.length;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  return lines.some((l) => l.startsWith(BULLET)) && lines.every((l) => l === '' || l.startsWith(BULLET));
}

// A full-screen "note page" for the event description: a big text area on paper
// with a floating toolbar to add bullet points and step the body size up/down.
export function DescriptionEditor({
  value,
  scale,
  onChangeText,
  onChangeScale,
  onClose,
}: {
  value: string;
  scale: number;
  onChangeText: (text: string) => void;
  onChangeScale: (scale: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState<Selection>({
    start: value.length,
    end: value.length,
  });
  // When a toolbar action rewrites the text we force the caret to the new spot
  // for one render, then release it so typing drives the caret again.
  const [forced, setForced] = useState<Selection | null>(null);

  const size = Math.round((BASE_SIZE * scale) / 100);
  const bulletsActive = selectionBulleted(value, selection);
  const canShrink = scale > DESCRIPTION_SCALE.min;
  const canGrow = scale < DESCRIPTION_SCALE.max;

  function onBullet() {
    const next = toggleBullets(value, selection);
    // maxLength only caps typed input, not this programmatic insert — don't let
    // adding "• " prefixes push past the server's limit (it'd reject the save).
    if (next.text.length > LIMITS.description) return;
    onChangeText(next.text);
    setSelection(next.selection);
    setForced(next.selection);
    // Tapping a toolbar button blurs the field on native — keep the keyboard up.
    inputRef.current?.focus();
  }

  function bumpScale(dir: 1 | -1) {
    const next = clampScale(scale + dir * DESCRIPTION_SCALE.step);
    if (next !== scale) onChangeScale(next);
    inputRef.current?.focus();
  }

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
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              autoFocus
              multiline
              selection={forced ?? undefined}
              onSelectionChange={(e) => {
                setSelection(e.nativeEvent.selection);
                setForced(null);
              }}
              placeholder={"Write the details - who, what, and why it'll be great.\n\nTip: tap “Bullets” to make a list."}
              placeholderTextColor={colors.muted}
              maxLength={LIMITS.description}
              textAlignVertical="top"
              style={[styles.input, { fontSize: size, lineHeight: Math.round(size * 1.5) }]}
            />
          </View>

          <View style={[styles.toolbarWrap, { paddingBottom: insets.bottom + spacing.sm }]}>
            <Glass
              tint="light"
              intensity={40}
              radius={radius.pill}
              border
              fill="rgba(255,255,255,0.6)"
              style={styles.toolbar}
            >
              <Pressable
                onPress={onBullet}
                style={[styles.toolBtn, bulletsActive && styles.toolBtnActive]}
              >
                <Ionicons
                  name="list"
                  size={20}
                  color={bulletsActive ? '#fff' : colors.text}
                />
                <Text style={[styles.toolLabel, bulletsActive && styles.toolLabelActive]}>
                  Bullets
                </Text>
              </Pressable>

              <View style={styles.sizeGroup}>
                <Pressable
                  onPress={() => bumpScale(-1)}
                  disabled={!canShrink}
                  hitSlop={8}
                  style={[styles.sizeBtn, !canShrink && styles.sizeBtnOff]}
                >
                  <Text style={styles.sizeSmall}>A</Text>
                </Pressable>
                <Text style={styles.sizePct}>{scale}%</Text>
                <Pressable
                  onPress={() => bumpScale(1)}
                  disabled={!canGrow}
                  hitSlop={8}
                  style={[styles.sizeBtn, !canGrow && styles.sizeBtnOff]}
                >
                  <Text style={styles.sizeBig}>A</Text>
                </Pressable>
              </View>
            </Glass>
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
  toolbarWrap: {
    paddingHorizontal: spacing.lg,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    ...shadow.card,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  toolBtnActive: {
    backgroundColor: colors.ink,
  },
  toolLabel: {
    ...uiText(14, '600'),
    color: colors.text,
  },
  toolLabelActive: {
    color: colors.onInk,
  },
  sizeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  sizeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sizeBtnOff: {
    opacity: 0.4,
  },
  sizeSmall: {
    ...uiText(13, '600'),
    color: colors.text,
  },
  sizeBig: {
    ...uiText(20, '600'),
    color: colors.text,
  },
  sizePct: {
    ...kicker(light.text3),
    minWidth: 40,
    textAlign: 'center',
  },
});
