import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing } from '../lib/theme';
import { uiText } from '../lib/fonts';

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

const MAX_ZOOM = 4;

// A frosted-out, near-black canvas so the photo (not the app chrome) is the
// star while you position it. Dark reads best for judging a cover image.
const PANEL = '#141210';

// ── The interactive canvas ────────────────────────────────────────────────────
// Rendered only once real pixel dimensions are known, so every gesture closure
// captures stable numbers. The photo is scaled to *cover* a square frame at
// zoom 1; drag to reposition, pinch (native) or slide to zoom in.
function CropCanvas({
  uri,
  imgW,
  imgH,
  frame,
  onReady,
}: {
  uri: string;
  imgW: number;
  imgH: number;
  frame: number;
  onReady: (getCrop: () => CropRect) => void;
}) {
  // Source-px → screen-px factor that makes the shorter side exactly fill the
  // square frame (so the photo always covers it, never letterboxed).
  const base = frame / Math.min(imgW, imgH);
  const w0 = imgW * base; // displayed width at zoom 1 (>= frame)
  const h0 = imgH * base; // displayed height at zoom 1 (>= frame)

  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  // Live numeric mirrors of the Animated values, for clamping + final crop math.
  const s = useRef(1);
  const pos = useRef({ x: 0, y: 0 });
  const [trackW, setTrackW] = useState(0);

  // How far the (centered) image may travel before an edge would expose the
  // frame — half the overflow on each axis.
  const boundX = (sc: number) => Math.max(0, (w0 * sc - frame) / 2);
  const boundY = (sc: number) => Math.max(0, (h0 * sc - frame) / 2);
  const clamp = (v: number, b: number) => Math.max(-b, Math.min(b, v));

  function applyPos() {
    pos.current.x = clamp(pos.current.x, boundX(s.current));
    pos.current.y = clamp(pos.current.y, boundY(s.current));
    tx.setValue(pos.current.x);
    ty.setValue(pos.current.y);
  }
  function applyScale(next: number) {
    s.current = Math.max(1, Math.min(MAX_ZOOM, next));
    scale.setValue(s.current);
    applyPos(); // tighter/looser bounds after a zoom change
  }

  const g = useRef({
    mode: 'none' as 'none' | 'pan' | 'pinch',
    posX: 0,
    posY: 0,
    scale: 1,
    dist: 0,
    anchorX: 0,
    anchorY: 0,
    dx0: 0,
    dy0: 0,
  }).current;

  const twoFingerDist = (touches: { pageX: number; pageY: number }[]) =>
    Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        g.mode = 'none';
      },
      onPanResponderMove: (e, gs) => {
        const touches = e.nativeEvent.touches;
        if (touches.length >= 2) {
          // Pinch — (re)baseline whenever we enter this mode.
          if (g.mode !== 'pinch') {
            g.mode = 'pinch';
            g.scale = s.current;
            g.dist = twoFingerDist(touches);
          }
          const ratio = twoFingerDist(touches) / (g.dist || 1);
          applyScale(g.scale * ratio);
          return;
        }
        // Pan — track the finger (native) or the mouse via gesture state (web).
        if (g.mode !== 'pan') {
          g.mode = 'pan';
          g.posX = pos.current.x;
          g.posY = pos.current.y;
          g.anchorX = touches.length ? touches[0].pageX : 0;
          g.anchorY = touches.length ? touches[0].pageY : 0;
          g.dx0 = gs.dx;
          g.dy0 = gs.dy;
        }
        const dx = touches.length ? touches[0].pageX - g.anchorX : gs.dx - g.dx0;
        const dy = touches.length ? touches[0].pageY - g.anchorY : gs.dy - g.dy0;
        pos.current.x = g.posX + dx;
        pos.current.y = g.posY + dy;
        applyPos();
      },
      onPanResponderRelease: () => {
        g.mode = 'none';
      },
      onPanResponderTerminate: () => {
        g.mode = 'none';
      },
    })
  ).current;

  // Zoom slider — the universal control (web has no pinch). Dragging anywhere on
  // the track maps its x to a zoom level.
  const slider = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setZoomFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setZoomFromX(e.nativeEvent.locationX),
    })
  ).current;
  function setZoomFromX(x: number) {
    if (trackW <= 0) return;
    const f = Math.max(0, Math.min(1, x / trackW));
    applyScale(1 + f * (MAX_ZOOM - 1));
  }

  function computeCrop(): CropRect {
    const sc = s.current;
    const S = base * sc; // source-px → screen-px at the current zoom
    // Screen-px offset of the frame's top-left inside the displayed image.
    const offX = (w0 * sc) / 2 - frame / 2 - pos.current.x;
    const offY = (h0 * sc) / 2 - frame / 2 - pos.current.y;
    let originX = Math.round(offX / S);
    let originY = Math.round(offY / S);
    let cropW = Math.round(frame / S);
    let cropH = Math.round(frame / S);
    originX = Math.max(0, Math.min(imgW - 1, originX));
    originY = Math.max(0, Math.min(imgH - 1, originY));
    cropW = Math.max(1, Math.min(cropW, imgW - originX));
    cropH = Math.max(1, Math.min(cropH, imgH - originY));
    return { originX, originY, width: cropW, height: cropH };
  }

  useEffect(() => {
    onReady(computeCrop);
    // computeCrop closes over stable refs/props; register once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const thumbSize = 26;
  const thumbLeft = scale.interpolate({
    inputRange: [1, MAX_ZOOM],
    outputRange: [0, Math.max(0, trackW - thumbSize)],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.canvasWrap}>
      <View
        style={[styles.frame, { width: frame, height: frame }]}
        {...pan.panHandlers}
      >
        <Animated.Image
          source={{ uri }}
          resizeMode="cover"
          style={{
            width: w0,
            height: h0,
            transform: [{ translateX: tx }, { translateY: ty }, { scale }],
          }}
        />
        {/* Rule-of-thirds guides + border, non-interactive. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={[styles.gridLineV, { left: '33.33%' }]} />
          <View style={[styles.gridLineV, { left: '66.66%' }]} />
          <View style={[styles.gridLineH, { top: '33.33%' }]} />
          <View style={[styles.gridLineH, { top: '66.66%' }]} />
          <View style={styles.frameBorder} />
        </View>
      </View>

      <Text style={styles.hint}>
        Drag to reposition{Platform.OS === 'web' ? '' : ' · pinch'} · slide to zoom
      </Text>

      <View style={styles.sliderRow}>
        <Text style={styles.sliderIcon}>🔍</Text>
        <View
          style={styles.track}
          onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
          {...slider.panHandlers}
        >
          <View style={styles.trackFill} />
          <Animated.View style={[styles.thumb, { transform: [{ translateX: thumbLeft }] }]} />
        </View>
      </View>
    </View>
  );
}

// ── The sheet shell ───────────────────────────────────────────────────────────
// Resolves pixel dimensions (measuring the URI when the picker didn't report
// them — e.g. web, or an already-uploaded cover) and hosts Cancel / Done.
export function ImageCropSheet({
  uri,
  width,
  height,
  busy,
  onCancel,
  onConfirm,
}: {
  uri: string;
  width?: number;
  height?: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (crop: CropRect) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(winH)).current;
  const nativeDriver = Platform.OS !== 'web';
  const getCrop = useRef<(() => CropRect) | null>(null);

  const [dims, setDims] = useState<{ w: number; h: number } | null>(
    width && height && width > 0 && height > 0 ? { w: width, h: height } : null
  );

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: nativeDriver,
      damping: 24,
      stiffness: 240,
    }).start();
  }, [translateY, nativeDriver]);

  useEffect(() => {
    if (dims) return;
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => alive && setDims({ w: Math.max(1, w), h: Math.max(1, h) }),
      () => alive && setDims({ w: 1, h: 1 })
    );
    return () => {
      alive = false;
    };
  }, [uri, dims]);

  function dismiss() {
    if (busy) return;
    Animated.timing(translateY, {
      toValue: winH,
      duration: 180,
      useNativeDriver: nativeDriver,
    }).start(() => onCancel());
  }

  function done() {
    const crop = getCrop.current?.();
    if (crop) onConfirm(crop);
  }

  // Leave room for the header, hint, slider and safe areas.
  const frame = Math.max(
    200,
    Math.min(winW - spacing.lg * 2, winH - insets.top - insets.bottom - 260, 420)
  );

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      <Animated.View
        style={[
          styles.sheet,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={dismiss} hitSlop={10} disabled={busy}>
            <Text style={[styles.cancelText, busy && styles.disabledText]}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Adjust cover</Text>
          <Pressable onPress={done} hitSlop={10} disabled={busy || !dims} style={styles.doneBtn}>
            {busy ? (
              <ActivityIndicator size="small" color="#141210" />
            ) : (
              <Text style={styles.doneText}>Done</Text>
            )}
          </Pressable>
        </View>

        {dims && frame > 0 ? (
          <CropCanvas
            uri={uri}
            imgW={dims.w}
            imgH={dims.h}
            frame={frame}
            onReady={(fn) => (getCrop.current = fn)}
          />
        ) : (
          <View style={[styles.loading, { height: frame > 0 ? frame : 260 }]}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    zIndex: 70,
  },
  sheet: {
    backgroundColor: PANEL,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: { ...uiText(17, '800'), color: '#fff' },
  cancelText: { ...uiText(16, '600'), color: 'rgba(255,255,255,0.75)' },
  disabledText: { opacity: 0.4 },
  doneBtn: {
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 9,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { ...uiText(15, '600'), color: '#141210' },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasWrap: {
    alignItems: 'center',
  },
  frame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  hint: {
    ...uiText(13, '500'),
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  sliderIcon: {
    fontSize: 15,
  },
  track: {
    flex: 1,
    height: 26,
    justifyContent: 'center',
  },
  trackFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
  },
});
