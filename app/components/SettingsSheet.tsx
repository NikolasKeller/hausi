import React, { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../lib/theme';
import { uiText } from '../lib/fonts';
import { Glass } from './glass';

interface Option {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface Props {
  onClose: () => void;
  onEditProfile: () => void;
  onShareProfile: () => void;
  onLogout: () => void;
}

// Settings bottom sheet — the gear on the profile header opens this menu instead
// of logging out on the spot. Log out is just one option among the rest, and it
// shares the dark-glass chrome of the event pickers.
export function SettingsSheet({ onClose, onEditProfile, onShareProfile, onLogout }: Props) {
  const options: Option[] = [
    { icon: 'pencil', label: 'Edit profile', onPress: onEditProfile },
    { icon: 'share-outline', label: 'Share profile', onPress: onShareProfile },
    { icon: 'log-out-outline', label: 'Log out', onPress: onLogout, destructive: true },
  ];

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.dock}>
        <Glass tint="dark" intensity={48} radius={radius.xl} border style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Settings ⚙️</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.rows}>
            {options.map((opt) => (
              <Pressable
                key={opt.label}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => {
                  onClose();
                  opt.onPress();
                }}
              >
                <View style={styles.rowLeft}>
                  <Ionicons
                    name={opt.icon}
                    size={18}
                    color={opt.destructive ? colors.danger : 'rgba(255,255,255,0.9)'}
                  />
                  <Text style={[styles.rowLabel, opt.destructive && styles.rowLabelDestructive]}>
                    {opt.label}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
              </Pressable>
            ))}
          </View>
        </Glass>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  dock: {
    maxHeight: '80%',
  },
  sheet: {
    flexShrink: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
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
  rows: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: spacing.sm,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowLabel: { ...uiText(15, '600'), color: '#fff' },
  rowLabelDestructive: { color: colors.danger },
});
