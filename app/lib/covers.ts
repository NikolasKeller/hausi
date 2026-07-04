import type { CoverTheme } from '../shared/types';

export interface CoverSpec {
  key: CoverTheme;
  label: string;
  colors: [string, string, ...string[]];
  emoji: string;
}

export const COVERS: Record<CoverTheme, CoverSpec> = {
  sunset: {
    key: 'sunset',
    label: 'Sunset',
    colors: ['#FF9966', '#FF5E62', '#8F4BDE'],
    emoji: '🌅',
  },
  ocean: {
    key: 'ocean',
    label: 'Ocean',
    colors: ['#2E3192', '#1BAFD0', '#1BFFFF'],
    emoji: '🌊',
  },
  candy: {
    key: 'candy',
    label: 'Candy',
    colors: ['#FF6EC4', '#A78BFA', '#7873F5'],
    emoji: '🍬',
  },
  midnight: {
    key: 'midnight',
    label: 'Midnight',
    colors: ['#0F0C29', '#302B63', '#24243E'],
    emoji: '🌙',
  },
  forest: {
    key: 'forest',
    label: 'Forest',
    colors: ['#134E5E', '#3D8B63', '#71B280'],
    emoji: '🌿',
  },
  disco: {
    key: 'disco',
    label: 'Disco',
    colors: ['#B721FF', '#6B4EFF', '#21D4FD'],
    emoji: '🪩',
  },
};

export const COVER_LIST: CoverSpec[] = Object.values(COVERS);

export function coverFor(key: string): CoverSpec {
  return COVERS[key as CoverTheme] ?? COVERS.sunset;
}
