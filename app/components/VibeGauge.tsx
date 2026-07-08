import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

const TICK_COUNT = 72;
const RADIUS = 108;
const CENTER_X = 140;
const CENTER_Y = 118;

type Tick = {
  x: number;
  y: number;
  h: number;
  angle: number;
};

function buildTicks(): Tick[] {
  const ticks: Tick[] = [];
  for (let i = 0; i < TICK_COUNT; i++) {
    const t = i / (TICK_COUNT - 1);
    const angle = Math.PI + t * Math.PI;
    const major = i % 6 === 0;
    const h = major ? 14 : i % 3 === 0 ? 9 : 5;
    const r = RADIUS - h / 2;
    ticks.push({
      x: CENTER_X + Math.cos(angle) * r,
      y: CENTER_Y + Math.sin(angle) * r,
      h,
      angle: (angle * 180) / Math.PI + 90,
    });
  }
  return ticks;
}

const TICKS = buildTicks();

export function VibeGauge({
  value = 0.72,
  onHeartPress,
}: {
  value?: number;
  onHeartPress?: () => void;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const indicatorAngle = Math.PI + clamped * Math.PI;
  const indicatorX = CENTER_X + Math.cos(indicatorAngle) * (RADIUS - 2);
  const indicatorY = CENTER_Y + Math.sin(indicatorAngle) * (RADIUS - 2);

  return (
    <View style={styles.wrap}>
      {/* Faint concentric guide rings */}
      {[0.55, 0.72, 0.88].map((scale, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: RADIUS * 2 * scale,
              height: RADIUS * 2 * scale,
              borderRadius: RADIUS * scale,
              left: CENTER_X - RADIUS * scale,
              top: CENTER_Y - RADIUS * scale,
            },
          ]}
        />
      ))}

      {TICKS.map((tick, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[
            styles.tick,
            {
              left: tick.x - 0.5,
              top: tick.y - tick.h / 2,
              height: tick.h,
              transform: [{ rotate: `${tick.angle}deg` }],
            },
          ]}
        />
      ))}

      {/* Indicator dot on the arc */}
      <View
        pointerEvents="none"
        style={[
          styles.indicator,
          { left: indicatorX - 5, top: indicatorY - 5 },
        ]}
      />

      {/* Heart action — solid white disc, black heart */}
      <Pressable
        onPress={onHeartPress}
        style={({ pressed }) => [
          styles.heartBtn,
          pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
        ]}
        hitSlop={12}
      >
        <Ionicons name="heart" size={16} color="#0A0A0A" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 280,
    height: 150,
    alignSelf: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
  },
  tick: {
    position: 'absolute',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 1,
  },
  indicator: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.text,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  heartBtn: {
    position: 'absolute',
    left: CENTER_X - 22,
    top: CENTER_Y + 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
