import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../lib/theme';

const WORDMARK = require('../assets/wordmark-chrome-dark.png');

// The app-wide backdrop: pure black with the iykyk wordmark ghosted into the
// canvas (replacing the blurred-athlete photo from the reference dashboards).
// A faint silver bloom falls from the top so milky glass cards have depth to
// read against.
export function ScreenBackground({
  children,
  bloom = true,
  watermark = true,
}: {
  children?: React.ReactNode;
  bloom?: boolean;
  watermark?: boolean;
}) {
  return (
    <View style={styles.fill}>
      {watermark ? (
        <View pointerEvents="none" style={styles.watermarkWrap}>
          {Platform.OS === 'web' ? (
            <View style={styles.watermarkBlurWeb}>
              <Image source={WORDMARK} style={styles.watermark} resizeMode="contain" />
            </View>
          ) : (
            <BlurView intensity={28} tint="dark" style={styles.watermarkBlur}>
              <Image source={WORDMARK} style={styles.watermark} resizeMode="contain" />
            </BlurView>
          )}
        </View>
      ) : null}
      {bloom ? (
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0)']}
          locations={[0, 0.45, 1]}
          style={styles.bloom}
          pointerEvents="none"
        />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
        start={{ x: 0.5, y: 0.55 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

export function withScreenBackground<P extends object>(
  Screen: React.ComponentType<P>,
  opts?: { bloom?: boolean; watermark?: boolean }
): React.ComponentType<P> {
  function ScreenWithBackground(props: P) {
    return (
      <ScreenBackground bloom={opts?.bloom} watermark={opts?.watermark}>
        <Screen {...props} />
      </ScreenBackground>
    );
  }
  ScreenWithBackground.displayName = `withScreenBackground(${
    Screen.displayName || Screen.name || 'Screen'
  })`;
  return ScreenWithBackground;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  watermarkWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  watermarkBlur: {
    width: '140%',
    height: '50%',
    overflow: 'hidden',
    opacity: 0.22,
  },
  watermarkBlurWeb: {
    width: '140%',
    height: '50%',
    opacity: 0.18,
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(36px) brightness(1.2)' } as object)
      : null),
  },
  watermark: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  bloom: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 360,
  },
});
