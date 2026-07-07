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
import { brand, colors, radius, spacing } from '../lib/theme';
import { uiText } from '../lib/fonts';

export type ButtonVariant = 'primary' | 'vibrant' | 'paper' | 'ghost' | 'danger';

// The Partiful button family (on the dark canvas):
//   primary  — solid WHITE pill, dark text. The high-contrast action, like
//              Partiful's "Sign in" / "See more on the app".
//   vibrant  — the party gradient fill (heliotrope→pink→blue), white text. The
//              hero CTA ("Create invite").
//   paper    — same white fill / dark text (kept for callers).
//   ghost    — transparent + a hairline border. `tone` sets the ink/label to
//              white (default) — used on top of vibrant surfaces too.
//   danger   — transparent + red border/label for destructive actions.
export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  tone = 'paper',
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

  // Vibrant: the signature party gradient CTA.
  if (variant === 'vibrant') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [pressed && styles.pressed, isDisabled && styles.disabled, style]}
      >
        <LinearGradient
          colors={[...brand.party]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, styles.solid]}
        >
          {label(colors.onAccent)}
        </LinearGradient>
      </Pressable>
    );
  }

  if (variant === 'primary' || variant === 'paper') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.button,
          styles.solid,
          { backgroundColor: colors.ink },
          pressed && styles.pressed,
          isDisabled && styles.disabled,
          style,
        ]}
      >
        {label(colors.onInk)}
      </Pressable>
    );
  }

  // ghost / danger — bordered, transparent.
  const edge = variant === 'danger' ? colors.danger : tone === 'ink' ? colors.onInk : '#fff';
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
  return (
    <View style={{ gap: spacing.xs }}>
      {labelText ? <Text style={styles.label}>{labelText}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, style]}
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
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  ghost: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
  buttonText: {
    ...uiText(16, '600'),
  },
  label: {
    ...uiText(13, '600'),
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    ...uiText(16, '400'),
  },
  error: {
    ...uiText(14, '700'),
    color: colors.danger,
  },
});
