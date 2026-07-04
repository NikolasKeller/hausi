import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COVER_LIST, coverFor, themeInk, THEME_CATEGORIES, type ThemeCategory } from '../lib/covers';
import { EFFECT_CATEGORIES, EFFECT_META, EffectOverlay } from './EffectOverlay';
import { Glass, GlassPill } from './glass';
import { radius, spacing } from '../lib/theme';
import { uiText } from '../lib/fonts';

// Deterministic textural scatter of the theme emoji across the whole surface.
const SCATTER: { top: string; left: string; size: number; rotate: string }[] = [
  { top: '5%', left: '8%', size: 40, rotate: '-14deg' },
  { top: '12%', left: '76%', size: 52, rotate: '10deg' },
  { top: '34%', left: '30%', size: 34, rotate: '6deg' },
  { top: '48%', left: '84%', size: 44, rotate: '-8deg' },
  { top: '62%', left: '12%', size: 38, rotate: '16deg' },
  { top: '78%', left: '64%', size: 48, rotate: '-6deg' },
  { top: '88%', left: '24%', size: 32, rotate: '12deg' },
];

// ── ThemeBackground ───────────────────────────────────────────────────────────
// A full-page event theme surface: the theme gradient fills the whole screen,
// its emoji scatters faintly for texture, and an optional effect overlay drifts
// across the top. Opaque. Content floats on top in mood-aware glass.
export function ThemeBackground({
  theme,
  effect,
  children,
  style,
}: {
  theme: string;
  effect?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const cover = coverFor(theme);
  const { height } = useWindowDimensions();
  const emojiTint = cover.mood === 'dark' ? 0.16 : 0.2;
  return (
    <View style={[styles.fill, { backgroundColor: cover.colors[0] }, style]}>
      <LinearGradient
        colors={cover.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {SCATTER.map((s, i) => (
          <Text
            key={i}
            style={{
              position: 'absolute',
              top: s.top as `${number}%`,
              left: s.left as `${number}%`,
              fontSize: s.size,
              opacity: emojiTint,
              transform: [{ rotate: s.rotate }],
            }}
          >
            {cover.emoji}
          </Text>
        ))}
      </View>
      {effect ? <EffectOverlay effect={effect} height={height} count={14} /> : null}
      {children}
    </View>
  );
}

// ── Shared picker chrome ──────────────────────────────────────────────────────
function PickerShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Glass tint="dark" intensity={48} radius={radius.xl} border style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color="#fff" />
          </Pressable>
        </View>
        {children}
      </Glass>
    </View>
  );
}

function Tabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: { key: string; label: string; emoji: string }[];
  active: string;
  onSelect: (k: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabsRow}
    >
      {[{ key: 'all', label: 'All', emoji: '✦' }, ...tabs].map((t) => (
        <Pressable key={t.key} onPress={() => onSelect(t.key)}>
          <GlassPill active={active === t.key} tint="dark" style={styles.tab}>
            <Text style={styles.tabEmoji}>{t.emoji}</Text>
            <Text style={[styles.tabLabel, active === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </GlassPill>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ── ThemePicker ───────────────────────────────────────────────────────────────
export function ThemePicker({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (theme: string) => void;
  onClose: () => void;
}) {
  const [cat, setCat] = useState<'all' | ThemeCategory>('all');
  const list = COVER_LIST.filter((c) => cat === 'all' || c.category === cat);
  return (
    <PickerShell title="Theme" onClose={onClose}>
      <Tabs tabs={THEME_CATEGORIES} active={cat} onSelect={(k) => setCat(k as typeof cat)} />
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {list.map((c) => {
          const selected = c.key === value;
          return (
            <Pressable key={c.key} onPress={() => onChange(c.key)} style={styles.cell}>
              <View style={[styles.swatch, selected && styles.swatchSelected]}>
                <LinearGradient
                  colors={c.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.swatchEmoji}>{c.emoji}</Text>
                {selected ? (
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={14} color="#000" />
                  </View>
                ) : null}
              </View>
              <Text style={styles.cellLabel} numberOfLines={1}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </PickerShell>
  );
}

// ── EffectPicker ──────────────────────────────────────────────────────────────
export function EffectPicker({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (effect: string) => void;
  onClose: () => void;
}) {
  const [cat, setCat] = useState<'all' | string>('all');
  const list = EFFECT_META.filter((e) => cat === 'all' || e.category === cat);
  return (
    <PickerShell title="Effect" onClose={onClose}>
      <Tabs tabs={EFFECT_CATEGORIES} active={cat} onSelect={setCat} />
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => onChange('none')} style={styles.cell}>
          <View style={[styles.circle, value === 'none' && styles.swatchSelected]}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
          </View>
          <Text style={styles.cellLabel}>None</Text>
        </Pressable>
        {list.map((e) => {
          const selected = e.key === value;
          return (
            <Pressable key={e.key} onPress={() => onChange(e.key)} style={styles.cell}>
              <View style={[styles.circle, selected && styles.swatchSelected]}>
                <Text style={styles.effectEmoji}>{e.emoji}</Text>
                {selected ? (
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={14} color="#000" />
                  </View>
                ) : null}
              </View>
              <Text style={styles.cellLabel} numberOfLines={1}>
                {e.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </PickerShell>
  );
}

// Convenience: the ink palette for a theme surface (re-export so screens can
// import everything theme-related from one place).
export { themeInk, coverFor };

const CELL = 92;

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  sheet: {
    maxHeight: '78%',
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: 'rgba(18,16,28,0.55)',
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
  tabsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  tab: { gap: 6 },
  tabEmoji: { fontSize: 13 },
  tabLabel: { ...uiText(13, '700'), color: 'rgba(255,255,255,0.7)' },
  tabLabelActive: { color: '#fff' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    justifyContent: 'space-between',
  },
  cell: { width: CELL, alignItems: 'center', gap: 6 },
  swatch: {
    width: CELL,
    height: CELL,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  circle: {
    width: CELL,
    height: CELL,
    borderRadius: CELL / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(30,26,48,0.7)',
  },
  swatchSelected: { borderColor: '#fff', borderWidth: 3 },
  swatchEmoji: { fontSize: 30, opacity: 0.9 },
  effectEmoji: { fontSize: 34 },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLabel: { ...uiText(12, '600'), color: 'rgba(255,255,255,0.85)' },
});
