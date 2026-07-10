import React, { useEffect, useRef, useState } from 'react';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  fromLocalDateKey,
  startOfLocalDay,
  toLocalDateKey,
} from '../lib/eventDateFilter';
import { colors, radius, shadow, spacing } from '../lib/theme';
import { uiText } from '../lib/fonts';

export function DateFilterSheet({
  value,
  minimumDate,
  onSelect,
  onClose,
}: {
  value: string;
  minimumDate: Date;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const nativeDriver = Platform.OS !== 'web';
  const minimum = startOfLocalDay(minimumDate);
  const [selected, setSelected] = useState(() => {
    const requested = fromLocalDateKey(value);
    return requested && requested.getTime() >= minimum.getTime() ? requested : minimum;
  });

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: nativeDriver,
      damping: 22,
      stiffness: 220,
      isInteraction: false,
    }).start();
  }, [nativeDriver, translateY]);

  function dismiss() {
    Animated.timing(translateY, {
      toValue: windowHeight,
      duration: 180,
      useNativeDriver: nativeDriver,
    }).start(onClose);
  }

  function snapBack() {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: nativeDriver,
      damping: 22,
      stiffness: 220,
    }).start();
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_event, gesture) => {
        if (gesture.dy > 0) translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 0.6) dismiss();
        else snapBack();
      },
      onPanResponderTerminate: snapBack,
    })
  ).current;

  const selectedLabel = selected.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={styles.overlay}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close date picker"
        style={StyleSheet.absoluteFill}
        onPress={dismiss}
      />
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + spacing.md,
            transform: [{ translateY }],
          },
        ]}
      >
        <View {...pan.panHandlers} style={styles.grabArea}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Pick a date</Text>
              <Text style={styles.selection}>{selectedLabel}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close date picker"
              hitSlop={8}
              onPress={dismiss}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.pickerWrap}>
          {Platform.OS === 'web' ? (
            <View style={styles.webRow}>
              {React.createElement('input', {
                type: 'date',
                value: toLocalDateKey(selected),
                min: toLocalDateKey(minimum),
                onChange: (event: { target: { value: string } }) => {
                  const date = fromLocalDateKey(event.target.value);
                  if (date) setSelected(date);
                },
                'aria-label': 'Event date',
                style: {
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: 14,
                  fontSize: 16,
                  borderRadius: radius.md,
                  border: `1px solid ${colors.cardBorder}`,
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  colorScheme: 'dark',
                },
              })}
            </View>
          ) : (
            <DateTimePicker
              value={selected}
              minimumDate={minimum}
              mode="date"
              display="inline"
              themeVariant="dark"
              onChange={(event, date) => {
                if (event.type !== 'dismissed' && date) setSelected(startOfLocalDay(date));
              }}
              style={styles.iosPicker}
            />
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onSelect(toLocalDateKey(selected));
            dismiss();
          }}
          style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}
        >
          <Text style={styles.applyText}>Show events</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    zIndex: 70,
  },
  sheet: {
    backgroundColor: '#141928',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.cardBorder,
    paddingTop: spacing.sm,
    ...shadow.float,
  },
  grabArea: {
    paddingBottom: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.cardBorder,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...uiText(21, '800'),
    color: colors.text,
  },
  selection: {
    ...uiText(14, '500'),
    color: colors.muted,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
  },
  closeText: {
    ...uiText(25, '400'),
    color: colors.text,
    lineHeight: 27,
  },
  pickerWrap: {
    paddingHorizontal: spacing.lg,
  },
  iosPicker: {
    height: 340,
  },
  webRow: {
    paddingVertical: spacing.lg,
  },
  applyButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  applyText: {
    ...uiText(16, '700'),
    color: colors.onInk,
  },
  pressed: {
    opacity: 0.8,
  },
});
