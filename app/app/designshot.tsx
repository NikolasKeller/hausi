import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from '../components/GlassSurface';

// ── Design shot ───────────────────────────────────────────────────────────────
// A 1:1 recreation of the rondesignlab glass-dashboard reference: dark blurred
// silhouette in fog, hairline-thin italic numerals, tick-mark dials, and true
// frosted-glass cards cut off by the bottom edge. Single static screen, no
// data wiring — purely the design language, so we can judge fidelity before
// rolling it across the app.
const BG = require('../assets/brand/designshot-bg.png');

const THIN = 'Inter_100Thin_Italic';
const XLIGHT = 'Inter_200ExtraLight_Italic';

// ── Tick ring ────────────────────────────────────────────────────────────────
// A watch-bezel ring of fine radial ticks. `bright` marks the progress arc.
function TickRing({
  radius,
  count = 72,
  tickH = 9,
  tickW = 1.2,
  from = 0,
  to = 360,
  brightFrom,
  brightTo,
  style,
}: {
  radius: number;
  count?: number;
  tickH?: number;
  tickW?: number;
  from?: number;
  to?: number;
  brightFrom?: number;
  brightTo?: number;
  style?: object;
}) {
  const ticks = [];
  const span = to - from;
  const n = span >= 360 ? count : Math.max(2, Math.round((count * span) / 360));
  for (let i = 0; i < n; i++) {
    const angle = from + (i * span) / (span >= 360 ? n : n - 1);
    const a = ((angle % 360) + 360) % 360;
    const bright =
      brightFrom != null &&
      brightTo != null &&
      (brightFrom <= brightTo ? a >= brightFrom && a <= brightTo : a >= brightFrom || a <= brightTo);
    ticks.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          left: radius - tickW / 2,
          top: radius - tickH / 2,
          width: tickW,
          height: tickH,
          borderRadius: tickW,
          backgroundColor: bright ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.30)',
          transform: [{ rotate: `${angle}deg` }, { translateY: -radius }],
        }}
      />
    );
  }
  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', width: radius * 2, height: radius * 2 }, style]}
    >
      {ticks}
    </View>
  );
}

// A small dot knob sitting on a ring at a given angle.
function Knob({
  radius,
  angle,
  size = 13,
  cx,
  cy,
}: {
  radius: number;
  angle: number;
  size?: number;
  cx: number;
  cy: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: cx - size / 2,
        top: cy - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FFFFFF',
        transform: [{ rotate: `${angle}deg` }, { translateY: -radius }],
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      }}
    />
  );
}

// A tiny circular progress ring (thin track + bright arc), CSS-free.
function MiniRing({ size, progress = 0.65 }: { size: number; progress?: number }) {
  const ticks = 40;
  const r = size / 2;
  const items = [];
  for (let i = 0; i < ticks; i++) {
    const angle = (i * 360) / ticks;
    const on = i / ticks <= progress;
    items.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          left: r - 0.8,
          top: r - 1.75,
          width: 1.6,
          height: 3.5,
          borderRadius: 1,
          backgroundColor: on ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
          transform: [{ rotate: `${angle}deg` }, { translateY: -r + 2 }],
        }}
      />
    );
  }
  return <View style={{ width: size, height: size }}>{items}</View>;
}

export default function DesignShotScreen() {
  return (
    <View style={styles.screen}>
      {/* Explicit 100% size: RNW otherwise sizes the img at the asset's
          natural dimensions, which overrides absoluteFill's stretch. */}
      <Image
        source={BG}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        resizeMode="cover"
      />

      {/* Faux status bar so the shot reads like the reference's phone frame. */}
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>00:25</Text>
        <View style={styles.statusRight}>
          <Ionicons name="cellular" size={13} color="#FFFFFF" />
          <Text style={styles.statusCarrier}>5G</Text>
          <Ionicons name="battery-full" size={16} color="#FFFFFF" />
        </View>
      </View>

      {/* Top pill */}
      <GlassSurface
        radius={999}
        blur={18}
        fill="rgba(255,255,255,0.10)"
        borderColor="rgba(255,255,255,0.30)"
        shadow={false}
        style={styles.topPill}
      >
        <Text style={styles.topPillText}>Users Stress Profile</Text>
      </GlassSurface>

      {/* Left metric block — hairline italic numerals */}
      <View style={styles.metricBlock}>
        <Text style={styles.metricLabel}>Yoga Time Index</Text>
        <View style={styles.metricRow}>
          <Text style={styles.metricValue}>88</Text>
          <Text style={styles.metricUnit}>SCR</Text>
        </View>
        {/* dotted arc */}
        <View style={styles.dotsRow}>
          {Array.from({ length: 22 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  opacity: 0.85 - i * 0.032,
                  transform: [{ translateY: Math.pow(i - 4, 2) * 0.055 }],
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.metricCaption}>
          Your resting rhythm improved{'\n'}12% during the evening session
        </Text>
      </View>

      {/* Right-edge cropped tick arc */}
      <TickRing
        radius={128}
        count={72}
        tickH={10}
        brightFrom={215}
        brightTo={275}
        style={{ left: 430 - 128 + 62, top: 300 - 128 }}
      />
      <Knob radius={128} angle={247} size={11} cx={430 + 62} cy={300} />

      {/* Small progress ring, left of the hero dial */}
      <View style={{ position: 'absolute', left: 56, top: 468 }}>
        <MiniRing size={38} progress={0.72} />
      </View>

      {/* Hero dial */}
      <View style={styles.dialWrap}>
        <TickRing
          radius={104}
          count={72}
          tickH={10}
          brightFrom={150}
          brightTo={250}
          style={{ left: 0, top: 0 }}
        />
        <Knob radius={104} angle={205} size={13} cx={104} cy={104} />
        {/* tiny scale labels */}
        <Text style={[styles.dialTick, { left: -26, top: 96 }]}>50</Text>
        <Text style={[styles.dialTick, { left: 96, top: -26 }]}>100</Text>
        {/* centre heart button */}
        <View style={styles.heartButton}>
          <Ionicons name="heart" size={26} color="#0B0C10" />
        </View>
      </View>

      {/* Bottom cards — deliberately bleeding off the bottom edge */}
      <GlassSurface
        radius={30}
        blur={26}
        fill="rgba(255,255,255,0.12)"
        borderColor="rgba(255,255,255,0.30)"
        style={styles.cardLeft}
      >
        <View style={styles.cardLeftHead}>
          <View style={styles.cardHeartCircle}>
            <Ionicons name="heart" size={18} color="#0B0C10" />
          </View>
          <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.85)" style={{ transform: [{ rotate: '-45deg' }] }} />
        </View>
        <Text style={styles.cardTitle}>Latest Session</Text>
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardMeta}>DONE</Text>
          <Text style={styles.cardMetaDim}>0:24</Text>
        </View>
      </GlassSurface>

      <GlassSurface
        radius={30}
        blur={26}
        fill="rgba(255,255,255,0.12)"
        borderColor="rgba(255,255,255,0.30)"
        style={styles.cardRight}
      >
        <Text style={styles.cardTitle}>Current Score</Text>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreValue}>18</Text>
          <View style={{ marginBottom: 10 }}>
            <MiniRing size={34} progress={0.4} />
          </View>
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B0C10',
    overflow: 'hidden',
  },
  statusBar: {
    position: 'absolute',
    top: 10,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 5,
  },
  statusTime: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    textShadowColor: 'rgba(30,45,60,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusCarrier: {
    color: '#FFFFFF',
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  topPill: {
    position: 'absolute',
    top: 64,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  topPillText: {
    color: 'rgba(255,255,255,0.95)',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(30,45,60,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  metricBlock: {
    position: 'absolute',
    left: 40,
    top: 150,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.95)',
    fontFamily: XLIGHT,
    fontSize: 14,
    letterSpacing: 0.3,
    marginBottom: 2,
    marginLeft: 6,
    textShadowColor: 'rgba(30,45,60,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  metricValue: {
    color: '#FFFFFF',
    fontFamily: THIN,
    fontSize: 104,
    lineHeight: 108,
    letterSpacing: -2,
    textShadowColor: 'rgba(30,45,60,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 14,
  },
  metricUnit: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: XLIGHT,
    fontSize: 13,
    marginTop: 18,
    marginLeft: 8,
    textShadowColor: 'rgba(30,45,60,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 6,
    marginLeft: 6,
  },
  dot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  metricCaption: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 12,
    marginLeft: 6,
    textShadowColor: 'rgba(30,45,60,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  dialWrap: {
    position: 'absolute',
    left: 215 - 104,
    top: 500,
    width: 208,
    height: 208,
  },
  dialTick: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.6)',
    fontFamily: XLIGHT,
    fontSize: 11,
  },
  heartButton: {
    position: 'absolute',
    left: 104 - 37,
    top: 104 - 37,
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  cardLeft: {
    position: 'absolute',
    left: 20,
    bottom: -74,
    width: 196,
    height: 210,
    padding: 18,
  },
  cardLeftHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeartCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: 'rgba(255,255,255,0.92)',
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 14,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  cardMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    letterSpacing: 1.2,
  },
  cardMetaDim: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
  cardRight: {
    position: 'absolute',
    right: 20,
    bottom: -74,
    width: 178,
    height: 210,
    padding: 18,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  scoreValue: {
    color: '#FFFFFF',
    fontFamily: THIN,
    fontSize: 72,
    lineHeight: 76,
    letterSpacing: -1.5,
  },
});
