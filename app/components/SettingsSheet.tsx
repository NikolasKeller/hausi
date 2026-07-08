import React, { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, light, radius, shadow, spacing } from '../lib/theme';
import { uiText } from '../lib/fonts';

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
  // Opens the Agent Wallet sheet (purchase details for agentic ticket buying).
  onEditWallet: () => void;
  onLogout: () => void;
}

// Settings bottom sheet — the gear on the profile header opens this menu instead
// of logging out on the spot. Log out is just one option among the rest, and it
// wears the warm-linen card chrome shared with the rest of the app's sheets.
export function SettingsSheet({ onClose, onEditProfile, onShareProfile, onEditWallet, onLogout }: Props) {
  const options: Option[] = [
    { icon: 'pencil', label: 'Edit profile', onPress: onEditProfile },
    { icon: 'card-outline', label: 'Agent Wallet', onPress: onEditWallet },
    { icon: 'share-outline', label: 'Share profile', onPress: onShareProfile },
    { icon: 'log-out-outline', label: 'Log out', onPress: onLogout, destructive: true },
  ];

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Settings</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color={colors.muted} />
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
                  color={opt.destructive ? colors.danger : colors.text}
                />
                <Text style={[styles.rowLabel, opt.destructive && styles.rowLabelDestructive]}>
                  {opt.label}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          ))}
        </View>
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
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    ...shadow.float,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: light.hairline,
    marginBottom: spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sheetTitle: { ...uiText(20, '700'), color: colors.text },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
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
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
  rowLabel: { ...uiText(15, '600'), color: colors.text },
  rowLabelDestructive: { color: colors.danger },
});
