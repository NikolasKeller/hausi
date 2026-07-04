import type { TextStyle } from 'react-native';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { Bungee_400Regular } from '@expo-google-fonts/bungee';
import type { TitleFont } from '../shared/types';

export const FONTS_TO_LOAD = {
  PlayfairDisplay_700Bold,
  Pacifico_400Regular,
  Bungee_400Regular,
};

export const TITLE_FONT_LABELS: Record<TitleFont, string> = {
  classic: 'Classic',
  literary: 'Literary',
  fancy: 'Fancy',
  eclectic: 'Eclectic',
};

// Style for big event titles per font choice. `classic` uses the system font.
export const TITLE_FONT_STYLES: Record<TitleFont, TextStyle> = {
  classic: { fontWeight: '800', letterSpacing: -1 },
  literary: { fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: 0 },
  fancy: { fontFamily: 'Pacifico_400Regular', letterSpacing: 0 },
  eclectic: { fontFamily: 'Bungee_400Regular', letterSpacing: 0 },
};

export function titleFontStyle(font: string): TextStyle {
  return TITLE_FONT_STYLES[font as TitleFont] ?? TITLE_FONT_STYLES.classic;
}
