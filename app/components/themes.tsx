import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COVER_LIST, coverFor, themeInk, THEME_CATEGORIES, type ThemeCategory } from '../lib/covers';
import { EFFECT_CATEGORIES, EFFECT_META } from './EffectOverlay';
import { Glass, GlassPill } from './glass';
import { colors, radius, spacing } from '../lib/theme';
import { uiText } from '../lib/fonts';

// ── ThemeBackground ───────────────────────────────────────────────────────────
// The event page surface. Renders the event's SELECTED theme as the full-page
// background — a rich, all-dark multi-stop gradient from `coverFor(theme)`. On
// top we keep a subtle bottom-deepening scrim (so content stays legible) plus
// our signature warm orange bloom at the top edge. This is intentionally
// separate from the square uploaded cover photo, which is rendered elsewhere
// via `CoverGradient`. `effect` is kept in the prop signature so existing
// callers (and the saved per-event setting) still type-check, but the
// drifting-emoji overlay itself is retired — it cluttered the page.
export function ThemeBackground({
  theme,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  effect,
  children,
  style,
}: {
  theme?: string;
  effect?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const cover = coverFor(theme ?? 'noir');
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }, style]}>
      {/* The theme itself: full-screen, opaque, diagonal multi-stop gradient. */}
      <LinearGradient
        colors={cover.colors}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Deepen the bottom so foreground glass + text stay readable on any theme. */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.58)']}
        start={{ x: 0.5, y: 0.35 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Soft neutral sheen fading out toward the middle. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.42 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
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
      style={styles.tabsScroll}
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
      <ScrollView style={styles.gridScroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
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
      <ScrollView style={styles.gridScroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
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
    height: '80%',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(18,16,28,0.72)',
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
  tabsScroll: { flexGrow: 0, flexShrink: 0 },
  tabsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  gridScroll: { flex: 1 },
  tab: { gap: 6 },
  tabEmoji: { fontSize: 13 },
  tabLabel: { ...uiText(13, '600'), color: 'rgba(255,255,255,0.7)' },
  tabLabelActive: { color: '#fff' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  circle: {
    width: CELL,
    height: CELL,
    borderRadius: CELL / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(30,26,48,0.7)',
  },
  swatchSelected: { borderColor: '#fff', borderWidth: 1.5 },
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
