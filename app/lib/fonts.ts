import type { TextStyle } from 'react-native';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { Bungee_400Regular } from '@expo-google-fonts/bungee';
import { LeagueGothic_400Regular } from '@expo-google-fonts/league-gothic';
import type { TitleFont } from '../shared/types';

// The app is set entirely in League Gothic (The League of Moveable Type) — a
// tall, tightly-condensed grotesque used as the single voice across every
// surface. It ships one optical cut, so all "weights" map to the same family.
const LEAGUE = 'LeagueGothic_400Regular';

export const FONTS_TO_LOAD = {
  LeagueGothic_400Regular,
  // Kept for the opt-in per-event title fonts (Literary / Fancy / Eclectic).
  PlayfairDisplay_700Bold,
  Pacifico_400Regular,
  Bungee_400Regular,
};

// League Gothic has a single cut, so every requested weight resolves to it.
function uiFamily(_weight?: TextStyle['fontWeight']): string {
  return LEAGUE;
}

// The app's one and only voice. Titles are set tight (negative tracking) and
// near-solid line-height.
export const DISPLAY_FONT = LEAGUE;
export const DISPLAY_FONT_HEAVY = LEAGUE; // poster/cover weight (same cut)
export const SERIF_FONT = 'PlayfairDisplay_700Bold'; // opt-in literary title only
export const displayTitle: TextStyle = { fontFamily: DISPLAY_FONT, fontWeight: 'normal' };

// Statement type: League Gothic at tight negative tracking. The `weight` opt is
// kept for call-site compatibility but resolves to the same cut. letterSpacing
// is absolute px in RN, so it scales with the font size.
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

// Interface text — League Gothic, the single UI voice. Slight negative
// tracking, generous line-height. The weight arg is accepted for compatibility
// but every value resolves to the one League Gothic cut.
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
    fontFamily: LEAGUE,
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

// Style for big event titles per font choice. `classic` is League Gothic (the
// app-wide default); Literary/Fancy/Eclectic stay as opt-in decorative faces.
// The loaded faces carry their weight in the family name, so fontWeight resets.
export const TITLE_FONT_STYLES: Record<TitleFont, TextStyle> = {
  classic: { fontFamily: DISPLAY_FONT, fontWeight: 'normal', letterSpacing: -1 },
  literary: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: 'normal', letterSpacing: 0 },
  fancy: { fontFamily: 'Pacifico_400Regular', fontWeight: 'normal', letterSpacing: 0 },
  eclectic: { fontFamily: 'Bungee_400Regular', fontWeight: 'normal', letterSpacing: 0 },
};

export function titleFontStyle(font: string): TextStyle {
  return TITLE_FONT_STYLES[font as TitleFont] ?? TITLE_FONT_STYLES.classic;
}
