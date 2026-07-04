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

// The app's display voice — a heavy grotesque for poster-style headers and
// event titles (screen titles, profile name, the "Classic" event font). Weight
// is baked into the family, so reset fontWeight to avoid a synthesized bold.
export const DISPLAY_FONT = 'Archivo_900Black';
export const displayTitle: TextStyle = { fontFamily: DISPLAY_FONT, fontWeight: 'normal' };

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
