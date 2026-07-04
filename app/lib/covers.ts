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

export const COVERS: Record<CoverTheme, CoverSpec> = {
  sunset: { key: 'sunset', label: 'Sunset', colors: ['#FF9966', '#FF5E62', '#8F4BDE'], emoji: '🌅', category: 'trending', mood: 'dark' },
  ocean: { key: 'ocean', label: 'Ocean', colors: ['#2E3192', '#1BAFD0', '#1BFFFF'], emoji: '🌊', category: 'trending', mood: 'dark' },
  candy: { key: 'candy', label: 'Candy', colors: ['#FF6EC4', '#A78BFA', '#7873F5'], emoji: '🍬', category: 'fun', mood: 'dark' },
  midnight: { key: 'midnight', label: 'Midnight', colors: ['#0F0C29', '#302B63', '#24243E'], emoji: '🌙', category: 'dark', mood: 'dark' },
  forest: { key: 'forest', label: 'Forest', colors: ['#134E5E', '#3D8B63', '#71B280'], emoji: '🌿', category: 'seasonal', mood: 'dark' },
  disco: { key: 'disco', label: 'Disco', colors: ['#B721FF', '#6B4EFF', '#21D4FD'], emoji: '🪩', category: 'fun', mood: 'dark' },
  cloud: { key: 'cloud', label: 'Cloud', colors: ['#AEC3E8', '#C9C2E6', '#E8C6D0', '#F5D9BE'], emoji: '☁️', category: 'light', mood: 'light' },
  lava: { key: 'lava', label: 'Lava', colors: ['#7A2E10', '#C2410C', '#E8763A'], emoji: '🌋', category: 'trending', mood: 'dark' },
  aurora: { key: 'aurora', label: 'Aurora', colors: ['#02111B', '#0E4D64', '#1FA98C'], emoji: '🌌', category: 'dark', mood: 'dark' },
  noir: { key: 'noir', label: 'Noir', colors: ['#0A0A0A', '#1A1A1A', '#2B2B2B'], emoji: '🖤', category: 'dark', mood: 'dark' },
  cottoncandy: { key: 'cottoncandy', label: 'Cotton Candy', colors: ['#FBC2EB', '#A6C1EE', '#C2E9FB'], emoji: '🍭', category: 'fun', mood: 'light' },
  peach: { key: 'peach', label: 'Peach', colors: ['#FFE5D9', '#FFCFC0', '#FFB89E'], emoji: '🍑', category: 'light', mood: 'light' },
  lavender: { key: 'lavender', label: 'Lavender', colors: ['#ECE6FA', '#D8CCF0', '#C3B1E1'], emoji: '💜', category: 'light', mood: 'light' },
  matcha: { key: 'matcha', label: 'Matcha', colors: ['#E4EED0', '#B7D19A', '#8FB56A'], emoji: '🍵', category: 'light', mood: 'light' },
  gold: { key: 'gold', label: 'Gold', colors: ['#2E2408', '#8A6D1F', '#D4AF37'], emoji: '🏆', category: 'trending', mood: 'dark' },
  berry: { key: 'berry', label: 'Berry', colors: ['#2A0A2E', '#6A1B4D', '#B0306E'], emoji: '🫐', category: 'dark', mood: 'dark' },
  storm: { key: 'storm', label: 'Storm', colors: ['#1C2331', '#3A4A63', '#6B7A99'], emoji: '⛈️', category: 'dark', mood: 'dark' },
  blossom: { key: 'blossom', label: 'Blossom', colors: ['#FFF0F5', '#FBD3E0', '#F7A8C4'], emoji: '🌸', category: 'seasonal', mood: 'light' },
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
