import type { TextStyle } from 'react-native';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { Bungee_400Regular } from '@expo-google-fonts/bungee';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import type { TitleFont } from '../shared/types';

// Partiful's real typography is TWK Lausanne — a tight neo-grotesque — with a
// custom "Partiful Display" for titles. Those faces are proprietary, so we
// substitute Inter, the closest freely-licensable neo-grotesque, across the
// whole UI. Weights map 1:1 to Inter's optical weights so nothing renders as a
// browser-synthesized faux-bold.
export const FONTS_TO_LOAD = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  PlayfairDisplay_700Bold,
  Pacifico_400Regular,
  Bungee_400Regular,
};

// Map a react-native fontWeight to the matching Inter family, so every weight
// picks the real cut instead of a synthesized one.
const UI_FAMILY: Record<string, string> = {
  '300': 'Inter_400Regular',
  '400': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  bold: 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_900Black',
};

function uiFamily(weight?: TextStyle['fontWeight']): string {
  return UI_FAMILY[String(weight ?? '400')] ?? 'Inter_400Regular';
}

// The app's display voice — Inter at its heaviest cut, standing in for TWK
// Lausanne 850. Titles are set tight (negative tracking) and near-solid
// line-height, exactly like Partiful's big grotesque headlines.
export const DISPLAY_FONT = 'Inter_800ExtraBold';
export const DISPLAY_FONT_HEAVY = 'Inter_900Black'; // poster/cover weight
export const SERIF_FONT = 'PlayfairDisplay_700Bold'; // opt-in literary title only
export const displayTitle: TextStyle = { fontFamily: DISPLAY_FONT, fontWeight: 'normal' };

// Statement type: heavy Inter grotesque at tight negative tracking. Pass
// weight:'heavy'/'black' for poster/cover-grade Inter Black. letterSpacing is
// absolute px in RN, so it scales with the font size.
export function display(
  size: number,
  opts?: { weight?: 'black' | 'heavy'; lineHeight?: number; tracking?: number }
): TextStyle {
  const family = opts?.weight ? DISPLAY_FONT_HEAVY : DISPLAY_FONT;
  const tracking = opts?.tracking ?? -0.03;
  const lh = opts?.lineHeight ?? (size >= 56 ? 0.92 : size >= 32 ? 1.0 : 1.1);
  return {
    fontFamily: family,
    fontWeight: 'normal',
    fontSize: size,
    letterSpacing: Math.round(size * tracking * 100) / 100,
    lineHeight: Math.round(size * lh),
    includeFontPadding: false,
  } as TextStyle;
}

// Interface text — Inter, the neo-grotesque UI voice (≈ TWK Lausanne). Slight
// negative tracking, generous line-height. The weight also selects the real
// Inter cut so it never renders as a faux-bold.
export function uiText(
  size: number,
  weight: TextStyle['fontWeight'] = '400',
  opts?: { tracking?: number; lineHeight?: number }
): TextStyle {
  const tracking = opts?.tracking ?? -0.01;
  return {
    fontFamily: uiFamily(weight),
    fontSize: size,
    fontWeight: 'normal',
    letterSpacing: Math.round(size * tracking * 100) / 100,
    lineHeight: Math.round(size * (opts?.lineHeight ?? 1.4)),
  };
}

// A small kicker/eyebrow label — uppercase, tracked out, bold. Sits above
// display headlines the way Partiful labels its sections.
export function kicker(color?: string): TextStyle {
  return {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    fontWeight: 'normal',
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

// Style for big event titles per font choice. `classic` is the heavy Inter
// grotesque (Partiful's default title look). The loaded faces carry their
// weight in the family name, so fontWeight resets to normal.
export const TITLE_FONT_STYLES: Record<TitleFont, TextStyle> = {
  classic: { fontFamily: DISPLAY_FONT, fontWeight: 'normal', letterSpacing: -1 },
  literary: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: 'normal', letterSpacing: 0 },
  fancy: { fontFamily: 'Pacifico_400Regular', fontWeight: 'normal', letterSpacing: 0 },
  eclectic: { fontFamily: 'Bungee_400Regular', fontWeight: 'normal', letterSpacing: 0 },
};

export function titleFontStyle(font: string): TextStyle {
  return TITLE_FONT_STYLES[font as TitleFont] ?? TITLE_FONT_STYLES.classic;
}
