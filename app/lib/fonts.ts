import type { TextStyle } from 'react-native';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { Bungee_400Regular } from '@expo-google-fonts/bungee';
import { Archivo_700Bold, Archivo_800ExtraBold, Archivo_900Black } from '@expo-google-fonts/archivo';
import type { TitleFont } from '../shared/types';

export const FONTS_TO_LOAD = {
  PlayfairDisplay_700Bold,
  Pacifico_400Regular,
  Bungee_400Regular,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_900Black,
};

// The app's display voice — a clean grotesque (Archivo), the "Known"-style
// quiet-luxury sans. Wordmarks and big titles get ExtraBold; section headings
// step down to Bold so they read confident but calm (not shouty). Archivo Black
// is reserved for poster-grade cover titles. Playfair stays loaded only as the
// opt-in "literary" event-title face — it's no longer the app's default voice.
export const DISPLAY_FONT = 'Archivo_800ExtraBold'; // wordmarks / big display
export const DISPLAY_FONT_MID = 'Archivo_700Bold'; // section headings (quieter)
export const DISPLAY_FONT_HEAVY = 'Archivo_900Black'; // poster/cover weight
export const SERIF_FONT = 'PlayfairDisplay_700Bold'; // opt-in "literary" title only
export const displayTitle: TextStyle = { fontFamily: DISPLAY_FONT, fontWeight: 'normal' };

// Clean sans statement type at tight negative tracking and compressed
// line-height. letterSpacing is absolute px in RN, so it scales with the size.
export function display(
  size: number,
  opts?: { weight?: 'black' | 'heavy' | 'serif'; lineHeight?: number; tracking?: number }
): TextStyle {
  // 'black'/'heavy' = Archivo Black (poster), 'serif' = Playfair (opt-in), else
  // a clean grotesque: ExtraBold for wordmark-scale, Bold for section headings.
  let family: string;
  if (opts?.weight === 'black' || opts?.weight === 'heavy') family = DISPLAY_FONT_HEAVY;
  else if (opts?.weight === 'serif') family = SERIF_FONT;
  else family = size >= 34 ? DISPLAY_FONT : DISPLAY_FONT_MID;
  const tracking = opts?.tracking ?? -0.02;
  const lh = opts?.lineHeight ?? (size >= 56 ? 0.95 : size >= 32 ? 1.04 : 1.15);
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

// Style for big event titles per font choice. `classic` is the clean grotesque
// (the app default); `literary` is the opt-in Playfair serif. The loaded faces
// carry their weight in the family name, so fontWeight resets to normal —
// otherwise browsers on web synthesize a faux-bold on top.
export const TITLE_FONT_STYLES: Record<TitleFont, TextStyle> = {
  classic: { fontFamily: DISPLAY_FONT, fontWeight: 'normal', letterSpacing: -0.5 },
  literary: { fontFamily: SERIF_FONT, fontWeight: 'normal', letterSpacing: 0 },
  fancy: { fontFamily: 'Pacifico_400Regular', fontWeight: 'normal', letterSpacing: 0 },
  eclectic: { fontFamily: 'Bungee_400Regular', fontWeight: 'normal', letterSpacing: 0 },
};

export function titleFontStyle(font: string): TextStyle {
  return TITLE_FONT_STYLES[font as TitleFont] ?? TITLE_FONT_STYLES.classic;
}
