import React, { useEffect, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors, light, radius, shadow, spacing } from '../lib/theme';
import { uiText } from '../lib/fonts';
import { formatEventDate, formatEventTime } from './EventCard';

const pad2 = (n: number) => String(n).padStart(2, '0');

// Value for the web <input type="datetime-local">, in local time.
function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}

// One combined Date & Time picker in a bottom sheet you can flick away by
// dragging the grabber down. iOS gets the inline calendar+clock (matches the
// reference); Android stacks spinner date + time; web uses a native
// datetime-local input.
export function DateTimeSheet({
  date,
  onChange,
  onClose,
}: {
  date: Date;
  onChange: (d: Date) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(winH)).current;
  // RN Web has no native animated module; gate the flag to avoid the warning.
  const nativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: nativeDriver,
      damping: 22,
      stiffness: 220,
    }).start();
  }, [translateY, nativeDriver]);

  function dismiss() {
    Animated.timing(translateY, {
      toValue: winH,
      duration: 200,
      useNativeDriver: nativeDriver,
    }).start(() => onClose());
  }

  function snapBack() {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: nativeDriver,
      damping: 22,
      stiffness: 220,
    }).start();
  }

  // Drag only from the grabber/header so the calendar keeps its own gestures.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 120 || g.vy > 0.6) dismiss();
        else snapBack();
      },
      // If a parent/system steals the gesture mid-drag, don't leave it stuck.
      onPanResponderTerminate: () => snapBack(),
    })
  ).current;

  function set(d?: Date) {
    if (d) onChange(d);
  }

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md, transform: [{ translateY }] }]}
      >
        <View {...pan.panHandlers} style={styles.grabArea}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>Date &amp; Time</Text>
            <Pressable onPress={dismiss} style={styles.doneBtn}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.pickerWrap}>
          {Platform.OS === 'web' ? (
            <View style={styles.webRow}>
              <Text style={styles.webValue}>
                {formatEventDate(date.toISOString())} · {formatEventTime(date.toISOString())}
              </Text>
              {React.createElement('input', {
                type: 'datetime-local',
                value: toLocalInputValue(date),
                onChange: (e: { target: { value: string } }) => {
                  if (e.target.value) set(new Date(e.target.value));
                },
                'aria-label': 'Event date and time',
                style: {
                  width: '100%',
                  padding: 14,
                  fontSize: 16,
                  borderRadius: radius.md,
                  border: `1px solid ${colors.cardBorder}`,
                  colorScheme: 'light',
                },
              })}
            </View>
          ) : Platform.OS === 'ios' ? (
            <DateTimePicker
              value={date}
              mode="datetime"
              display="inline"
              themeVariant="light"
              onChange={(_e, d) => set(d)}
              style={styles.iosPicker}
            />
          ) : (
            // Android's picker is imperative-only (it can't render inline), so
            // the sheet shows two rows that each open the native dialog.
            <View style={styles.androidStack}>
              <Pressable
                style={styles.androidRow}
                onPress={() =>
                  DateTimePickerAndroid.open({
                    value: date,
                    mode: 'date',
                    onChange: (_e, d) => set(d),
                  })
                }
              >
                <Text style={styles.androidLabel}>Date</Text>
                <Text style={styles.androidValue}>{formatEventDate(date.toISOString())}</Text>
              </Pressable>
              <Pressable
                style={styles.androidRow}
                onPress={() =>
                  DateTimePickerAndroid.open({
                    value: date,
                    mode: 'time',
                    is24Hour: true,
                    onChange: (_e, d) => set(d),
                  })
                }
              >
                <Text style={styles.androidLabel}>Time</Text>
                <Text style={styles.androidValue}>{formatEventTime(date.toISOString())}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    zIndex: 60,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    ...shadow.float,
  },
  grabArea: {
    paddingBottom: spacing.xs,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: light.hairline,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  title: { ...uiText(20, '800'), color: colors.text },
  doneBtn: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  doneText: { ...uiText(15, '600'), color: '#fff' },
  pickerWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  iosPicker: {
    height: 360,
  },
  androidStack: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  androidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  androidLabel: { ...uiText(15, '600'), color: light.text3 },
  androidValue: { ...uiText(16, '700'), color: colors.text },
  webRow: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  webValue: { ...uiText(16, '700'), color: colors.text, textAlign: 'center' },
});
