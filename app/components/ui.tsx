import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { brand, colors, light, radius, shadow, spacing } from '../lib/theme';

export type ButtonVariant = 'primary' | 'vibrant' | 'paper' | 'ghost' | 'danger';

// The Partiful button family:
//   primary  — solid BLACK fill, white text. The signature action; pops on the
//              light paper canvas and on top of vibrant gradients.
//   vibrant  — party gradient fill (heliotrope→pink→blue). Hero CTA for dark
//              screens where a black fill would vanish.
//   paper    — white fill, black text. Primary CTA on dark surfaces.
//   ghost    — transparent + a heavy 2px border. `tone` sets ink (black) or
//              paper (white) for the border + label.
//   danger   — transparent + red border/label for destructive actions.
export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  tone = 'ink',
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  tone?: 'ink' | 'paper';
  style?: ViewStyle;
}) {
  const isDisabled = loading || disabled;

  const label = (color: string) =>
    loading ? (
      <ActivityIndicator color={color} />
    ) : (
      <Text style={[styles.buttonText, { color }]}>{title}</Text>
    );

  // 'vibrant' used to render a party gradient; now the whole app is light/cream
  // so treat it the same as primary (solid black) — keeps all callers working.
  const effectiveVariant = variant === 'vibrant' ? 'primary' : variant;

  if (effectiveVariant === 'primary' || effectiveVariant === 'paper') {
    const filled = effectiveVariant === 'primary';
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.button,
          styles.solid,
          { backgroundColor: filled ? colors.ink : light.paper },
          pressed && styles.pressed,
          isDisabled && styles.disabled,
          style,
        ]}
      >
        {label(filled ? '#fff' : colors.ink)}
      </Pressable>
    );
  }

  // ghost / danger — bordered, transparent.
  const edge = effectiveVariant === 'danger' ? colors.danger : tone === 'paper' ? '#fff' : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        styles.ghost,
        { borderColor: edge },
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {label(edge)}
    </Pressable>
  );
}

export function Field({
  label: labelText,
  tone = 'dark',
  style,
  ...props
}: TextInputProps & { label?: string; tone?: 'dark' | 'light'; style?: TextInputProps['style'] }) {
  const isLight = tone === 'light';
  return (
    <View style={{ gap: spacing.xs }}>
      {labelText ? (
        <Text style={[styles.label, isLight && { color: light.text3 }]}>{labelText}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={isLight ? light.muted : colors.muted}
        style={[styles.input, isLight && styles.inputLight, style]}
        {...props}
      />
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.pill,
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: {
    // Heavy black CTAs get a subtle lift so they read as physical.
    ...shadow.card,
  },
  ghost: {
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 16,
  },
  inputLight: {
    backgroundColor: light.paper,
    borderWidth: 2,
    borderColor: light.ink,
    color: light.text,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
});
