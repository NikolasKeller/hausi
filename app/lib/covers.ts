import type { CoverTheme } from '../shared/types';

// Theme categories drive the tabs in the theme picker (mirrors Partiful:
// All / Trending / Light / Fun / Dark / Seasonal).
export type ThemeCategory = 'trending' | 'light' | 'fun' | 'dark' | 'seasonal';

export const THEME_CATEGORIES: { key: ThemeCategory; label: string; emoji: string }[] = [
  { key: 'trending', label: 'Trending', emoji: '🔥' },
  { key: 'light', label: 'Light', emoji: '💡' },
  { key: 'fun', label: 'Fun', emoji: '🎉' },
  { key: 'dark', label: 'Dark', emoji: '🌑' },
  { key: 'seasonal', label: 'Seasonal', emoji: '🍁' },
];

export interface CoverSpec {
  key: CoverTheme;
  label: string;
  colors: [string, string, ...string[]];
  emoji: string;
  category: ThemeCategory;
  // 'dark' surfaces want white content + dark glass; 'light' want ink content.
  mood: 'light' | 'dark';
}

// Curated, premium, ALL-DARK theme set. Every palette is a rich multi-stop
// gradient that reads white-on-dark (mood: 'dark'), tuned to sit next to the
// warm orange accent. Keys are STABLE for backwards compatibility — seed data
// and existing events reference them — so we only refine the palettes/labels.
export const COVERS: Record<CoverTheme, CoverSpec> = {
  sunset: { key: 'sunset', label: 'Ember', colors: ['#0B0603', '#3A1206', '#8A2E10', '#D6541C', '#160A05'], emoji: '🌅', category: 'trending', mood: 'dark' },
  ocean: { key: 'ocean', label: 'Abyss', colors: ['#010A12', '#052430', '#0A4C5E', '#0E7C86', '#02101A'], emoji: '🌊', category: 'trending', mood: 'dark' },
  candy: { key: 'candy', label: 'Neon', colors: ['#0C0518', '#2A0C40', '#5E1C6E', '#B02C7A', '#0A0410'], emoji: '🍬', category: 'fun', mood: 'dark' },
  midnight: { key: 'midnight', label: 'Midnight', colors: ['#04050E', '#0D1130', '#20264F', '#3A3F72', '#04050C'], emoji: '🌙', category: 'dark', mood: 'dark' },
  forest: { key: 'forest', label: 'Pinewood', colors: ['#030F0A', '#092A1D', '#134C34', '#1F7A50', '#03100A'], emoji: '🌿', category: 'seasonal', mood: 'dark' },
  disco: { key: 'disco', label: 'Voltage', colors: ['#08041A', '#231052', '#5324A0', '#8E3AD6', '#0A0616'], emoji: '🪩', category: 'fun', mood: 'dark' },
  cloud: { key: 'cloud', label: 'Slate', colors: ['#070A10', '#141A26', '#28323F', '#44515F', '#070A10'], emoji: '☁️', category: 'light', mood: 'dark' },
  lava: { key: 'lava', label: 'Lava', colors: ['#0D0402', '#3E0E04', '#8A2408', '#D64A12', '#0E0402'], emoji: '🌋', category: 'trending', mood: 'dark' },
  aurora: { key: 'aurora', label: 'Aurora', colors: ['#02070F', '#052A34', '#0A5A54', '#159E7A', '#04121A'], emoji: '🌌', category: 'dark', mood: 'dark' },
  noir: { key: 'noir', label: 'Noir', colors: ['#000000', '#0A0A0A', '#161616', '#242424', '#050505'], emoji: '🖤', category: 'dark', mood: 'dark' },
  cottoncandy: { key: 'cottoncandy', label: 'Dusk', colors: ['#0A0714', '#241338', '#4E205C', '#9E3A72', '#0A0510'], emoji: '🍭', category: 'fun', mood: 'dark' },
  peach: { key: 'peach', label: 'Rosewood', colors: ['#0E0605', '#341210', '#6E2A1E', '#B85238', '#100604'], emoji: '🍑', category: 'light', mood: 'dark' },
  lavender: { key: 'lavender', label: 'Violet', colors: ['#08060F', '#1D1440', '#392574', '#5E42A6', '#08050E'], emoji: '💜', category: 'light', mood: 'dark' },
  matcha: { key: 'matcha', label: 'Evergreen', colors: ['#060E09', '#102A1A', '#1E4E30', '#367E4C', '#060E0A'], emoji: '🍵', category: 'light', mood: 'dark' },
  gold: { key: 'gold', label: 'Bullion', colors: ['#0C0802', '#2E2108', '#6E521A', '#C29434', '#0E0A03'], emoji: '🏆', category: 'trending', mood: 'dark' },
  berry: { key: 'berry', label: 'Berry', colors: ['#0E030B', '#33082A', '#661648', '#A82C6C', '#0C0309'], emoji: '🫐', category: 'dark', mood: 'dark' },
  storm: { key: 'storm', label: 'Storm', colors: ['#060810', '#141C2C', '#28374F', '#495A76', '#060810'], emoji: '⛈️', category: 'dark', mood: 'dark' },
  blossom: { key: 'blossom', label: 'Nightbloom', colors: ['#0E060C', '#320E28', '#661F4A', '#B03C74', '#0C0410'], emoji: '🌸', category: 'seasonal', mood: 'dark' },
  halloween: { key: 'halloween', label: 'Halloween', colors: ['#080410', '#280C3E', '#5E1C52', '#C2461A', '#070410'], emoji: '🎃', category: 'seasonal', mood: 'dark' },
};

export const COVER_LIST: CoverSpec[] = Object.values(COVERS);

export function coverFor(key: string): CoverSpec {
  return COVERS[key as CoverTheme] ?? COVERS.sunset;
}

// Content palette to use ON a theme surface, driven by its mood. Keeps text and
// glass readable whether the background is a dark lava or a light cloud.
export function themeInk(key: string) {
  const dark = coverFor(key).mood === 'dark';
  return {
    dark,
    text: dark ? '#FFFFFF' : '#0A0A0A',
    subtext: dark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.6)',
    faint: dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)',
    glassTint: (dark ? 'dark' : 'light') as 'dark' | 'light',
    // A hairline/border tuned to the surface.
    hairline: dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)',
  };
}
