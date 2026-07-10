import type { TextStyle } from 'react-native';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { Bungee_400Regular } from '@expo-google-fonts/bungee';
import {
  Inter_100Thin_Italic,
  Inter_200ExtraLight_Italic,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import type { TitleFont } from '../shared/types';

// Interface text is set in Inter — a compact, modern grotesque with real
// weights, so body copy reads regular/medium instead of everything-bold.
// Reglo Bold (Sebastien Sanfilippo, OFL) stays as the statement/display voice
// for big event titles.
const REGLO = 'Reglo-Bold';

// Inter is metrically normal — no size compensation needed.
const TEXT_SCALE = 1.0;
const DISPLAY_SCALE = 1.0;
const MIN_UI_SIZE = 12;

export const FONTS_TO_LOAD = {
  'Reglo-Bold': require('../assets/fonts/Reglo-Bold.otf'),
  // Ultra-thin italic cuts for the glass-dashboard display numerals
  // (the rondesignlab reference's hairline "88"-style figures).
  Inter_100Thin_Italic,
  Inter_200ExtraLight_Italic,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  // Kept for the opt-in per-event title fonts (Literary / Fancy / Eclectic).
  PlayfairDisplay_700Bold,
  Pacifico_400Regular,
  Bungee_400Regular,
};

// Map a requested weight onto the nearest loaded Inter cut.
function uiFamily(weight?: TextStyle['fontWeight']): string {
  const w = typeof weight === 'string' ? parseInt(weight, 10) || 400 : (weight ?? 400);
  if (w >= 800) return 'Inter_800ExtraBold';
  if (w >= 700) return 'Inter_700Bold';
  if (w >= 600) return 'Inter_600SemiBold';
  if (w >= 500) return 'Inter_500Medium';
  return 'Inter_400Regular';
}

// Display/headline voice: bold Inter for section headers; Reglo stays the
// poster face for event titles (see TITLE_FONT_STYLES).
export const DISPLAY_FONT = 'Inter_800ExtraBold';
export const DISPLAY_FONT_HEAVY = 'Inter_800ExtraBold';
export const SERIF_FONT = 'PlayfairDisplay_700Bold'; // opt-in literary title only
export const displayTitle: TextStyle = { fontFamily: DISPLAY_FONT, fontWeight: 'normal' };

// Statement type: bold Inter at tight negative tracking. The `weight` opt is
// kept for call-site compatibility. letterSpacing is absolute px in RN, so it
// scales with the font size.
export function display(
  rawSize: number,
  opts?: { weight?: 'black' | 'heavy'; lineHeight?: number; tracking?: number }
): TextStyle {
  const size = Math.round(rawSize * DISPLAY_SCALE);
  const family = opts?.weight ? DISPLAY_FONT_HEAVY : DISPLAY_FONT;
  const tracking = opts?.tracking ?? -0.02;
  const lh = opts?.lineHeight ?? (size >= 56 ? 0.98 : size >= 32 ? 1.05 : 1.12);
  return {
    fontFamily: family,
    fontWeight: 'normal',
    fontSize: size,
    letterSpacing: Math.round(size * tracking * 100) / 100,
    lineHeight: Math.round(size * lh),
    includeFontPadding: false,
  } as TextStyle;
}

// Interface text — Inter at the requested weight.
export function uiText(
  rawSize: number,
  weight: TextStyle['fontWeight'] = '400',
  opts?: { tracking?: number; lineHeight?: number }
): TextStyle {
  const size = Math.max(Math.round(rawSize * TEXT_SCALE), MIN_UI_SIZE);
  const tracking = opts?.tracking ?? 0;
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
    fontSize: Math.round(12 * TEXT_SCALE),
    fontWeight: 'normal',
    letterSpacing: 1.2,
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

// Style for big event titles per font choice. `classic` is Reglo Bold (the
// poster default); Literary/Fancy/Eclectic stay as opt-in decorative faces.
// The loaded faces carry their weight in the family name, so fontWeight resets.
export const TITLE_FONT_STYLES: Record<TitleFont, TextStyle> = {
  classic: { fontFamily: REGLO, fontWeight: 'normal', letterSpacing: -1 },
  literary: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: 'normal', letterSpacing: 0 },
  fancy: { fontFamily: 'Pacifico_400Regular', fontWeight: 'normal', letterSpacing: 0 },
  eclectic: { fontFamily: 'Bungee_400Regular', fontWeight: 'normal', letterSpacing: 0 },
};

export function titleFontStyle(font: string): TextStyle {
  return TITLE_FONT_STYLES[font as TitleFont] ?? TITLE_FONT_STYLES.classic;
}
