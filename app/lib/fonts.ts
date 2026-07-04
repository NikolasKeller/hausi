import type { TextStyle } from 'react-native';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { Bungee_400Regular } from '@expo-google-fonts/bungee';
import { Archivo_800ExtraBold, Archivo_900Black } from '@expo-google-fonts/archivo';
import type { TitleFont } from '../shared/types';

export const FONTS_TO_LOAD = {
  PlayfairDisplay_700Bold,
  Pacifico_400Regular,
  Bungee_400Regular,
  Archivo_800ExtraBold,
  Archivo_900Black,
};

// The app's display voice — a clean grotesque sans (Archivo), for the calm
// "Known" quiet-luxury feel. NOTE: do NOT use Playfair as the default display
// face — it reads as dated/"1800s" here; serif is kept only as the opt-in
// `literary` event-title choice below.
export const DISPLAY_FONT = 'Archivo_800ExtraBold';
export const DISPLAY_FONT_HEAVY = 'Archivo_900Black'; // poster/cover weight
export const SERIF_FONT = 'PlayfairDisplay_700Bold'; // opt-in literary title only
export const displayTitle: TextStyle = { fontFamily: DISPLAY_FONT, fontWeight: 'normal' };

// Statement type: clean Archivo grotesque at tight negative tracking. Pass
// weight:'heavy'/'black' for poster/cover-grade Archivo Black. letterSpacing is
// absolute px in RN, so it scales with the font size.
export function display(
  size: number,
  opts?: { weight?: 'black' | 'heavy'; lineHeight?: number; tracking?: number }
): TextStyle {
  const family = opts?.weight ? DISPLAY_FONT_HEAVY : DISPLAY_FONT;
  const tracking = opts?.tracking ?? -0.03;
  const lh = opts?.lineHeight ?? (size >= 56 ? 0.94 : size >= 32 ? 1.02 : 1.12);
  return {
    fontFamily: family,
    fontWeight: 'normal',
    fontSize: size,
    letterSpacing: Math.round(size * tracking * 100) / 100,
    lineHeight: Math.round(size * lh),
    includeFontPadding: false,
  } as TextStyle;
}

// Interface text — the clean neo-grotesque voice (system font ≈ TWK Lausanne /
// SF Pro / Neue Haas Grotesk). Slight negative tracking, generous line-height.
export function uiText(
  size: number,
  weight: TextStyle['fontWeight'] = '400',
  opts?: { tracking?: number; lineHeight?: number }
): TextStyle {
  const tracking = opts?.tracking ?? -0.02;
  return {
    fontSize: size,
    fontWeight: weight,
    letterSpacing: Math.round(size * tracking * 100) / 100,
    lineHeight: Math.round(size * (opts?.lineHeight ?? 1.4)),
  };
}

// A small kicker/eyebrow label — uppercase, tracked out, bold. Sits above
// display headlines the way Partiful labels its sections.
export function kicker(color?: string): TextStyle {
  return {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    ...(color ? { color } : null),
  };
}

export const TITLE_FONT_LABELS: Record<TitleFont, string> = {
  classic: 'Classic',
  literary: 'Literary',
  fancy: 'Fancy',
  eclectic: 'Eclectic',
};

// Style for big event titles per font choice. `classic` uses the system font.
// The loaded faces carry their weight in the family name, so fontWeight resets
// to normal — otherwise browsers on web synthesize a faux-bold on top.
export const TITLE_FONT_STYLES: Record<TitleFont, TextStyle> = {
  classic: { fontFamily: DISPLAY_FONT, fontWeight: 'normal', letterSpacing: -1 },
  literary: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: 'normal', letterSpacing: 0 },
  fancy: { fontFamily: 'Pacifico_400Regular', fontWeight: 'normal', letterSpacing: 0 },
  eclectic: { fontFamily: 'Bungee_400Regular', fontWeight: 'normal', letterSpacing: 0 },
};

export function titleFontStyle(font: string): TextStyle {
  return TITLE_FONT_STYLES[font as TitleFont] ?? TITLE_FONT_STYLES.classic;
}
