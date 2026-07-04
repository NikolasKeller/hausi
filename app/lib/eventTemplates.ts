import type { Category, CoverTheme, Effect, TitleFont } from '../shared/types';

// Curated "party starter" ideas shown on the Home tab. Tapping one opens the
// create-event form pre-filled with these values, so people can spin up a fun
// event without staring at a blank page. Only cosmetic/copy fields are set —
// date, location, city and guest limits stay on their defaults for the host.
export interface EventTemplate {
  id: string; // stable slug, passed to /new-event as ?template=
  emoji: string; // big glyph shown on the card
  name: string; // short card label
  vibe: string; // one-line hook shown under the name
  title: string; // pre-filled event title
  description: string; // pre-filled description
  category: Category;
  coverTheme: CoverTheme;
  titleFont: TitleFont;
  effect: Effect;
  dressCode?: string;
  costPerPerson?: string;
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: 'pasta-party',
    emoji: '🍝',
    name: 'Pasta Party',
    vibe: 'Carbs + good company',
    title: 'Pasta Party 🍝',
    description:
      "We're making a mountain of pasta and eating it together. Bring your appetite (and maybe a bottle of red).",
    category: 'food',
    coverTheme: 'sunset',
    titleFont: 'literary',
    effect: 'confetti',
    dressCode: 'Elastic waistbands encouraged',
  },
  {
    id: 'mafia-night',
    emoji: '🕵️',
    name: 'Mafia Game Night',
    vibe: 'Trust no one',
    title: 'Mafia Night 🔪',
    description:
      'One town, a few secret killers, and a whole lot of accusations. Can you sniff out the mafia before they get you?',
    category: 'other',
    coverTheme: 'midnight',
    titleFont: 'fancy',
    effect: 'sparkles',
  },
  {
    id: 'run-club',
    emoji: '🏃',
    name: 'Run Club',
    vibe: 'Easy miles, good chats',
    title: 'Run Club 🏃',
    description:
      'Easy pace, good chats, and coffee after. All levels welcome — nobody gets left behind.',
    category: 'sports',
    coverTheme: 'forest',
    titleFont: 'classic',
    effect: 'none',
    dressCode: 'Athleisure',
  },
  {
    id: 'matcha-morning',
    emoji: '🍵',
    name: 'Matcha Morning',
    vibe: 'Slow, green mornings',
    title: 'Matcha Morning 🍵',
    description:
      'Slow morning, whisked matcha, good company. Come get your green and ease into the day.',
    category: 'food',
    coverTheme: 'forest',
    titleFont: 'fancy',
    effect: 'sparkles',
  },
  {
    id: 'fight-night',
    emoji: '🥊',
    name: 'MMA / Fight Night',
    vibe: 'Bring your game face',
    title: 'Fight Night 🥊',
    description:
      "We're heading out to train (or watch) some MMA. Bring your game face and leave the ego at the door.",
    category: 'sports',
    coverTheme: 'midnight',
    titleFont: 'eclectic',
    effect: 'none',
  },
  {
    id: 'movie-night',
    emoji: '🎬',
    name: 'Movie Night',
    vibe: 'Snacks + big screen',
    title: 'Movie Night 🎬',
    description:
      'Snacks, blankets, and a big screen. Come vote on what we watch and settle in.',
    category: 'arts',
    coverTheme: 'midnight',
    titleFont: 'classic',
    effect: 'none',
    dressCode: 'Pajamas welcome',
  },
  {
    id: 'board-games',
    emoji: '🎲',
    name: 'Board Game Night',
    vibe: 'Friendly rivalry',
    title: 'Board Game Night 🎲',
    description:
      'Bring a game or just bring yourself. Snacks, friendly rivalry, and at least one flipped table.',
    category: 'community',
    coverTheme: 'candy',
    titleFont: 'eclectic',
    effect: 'confetti',
  },
  {
    id: 'karaoke',
    emoji: '🎤',
    name: 'Karaoke Night',
    vibe: 'No talent required',
    title: 'Karaoke Night 🎤',
    description:
      'No talent required, just enthusiasm. Come sing your heart out — the worse, the better.',
    category: 'music',
    coverTheme: 'disco',
    titleFont: 'fancy',
    effect: 'balloons',
  },
  {
    id: 'potluck',
    emoji: '🥘',
    name: 'Potluck Dinner',
    vibe: 'Everyone brings a dish',
    title: 'Potluck Dinner 🥘',
    description:
      'Everyone brings a dish, everyone eats like royalty. Drop a note about what you’re making so we don’t end up with five salads.',
    category: 'food',
    coverTheme: 'sunset',
    titleFont: 'literary',
    effect: 'confetti',
  },
  {
    id: 'beach-day',
    emoji: '🏖️',
    name: 'Beach Day',
    vibe: 'Sun, sand & snacks',
    title: 'Beach Day 🏖️',
    description:
      "Sun, sand, and snacks. Let's claim a patch of beach for the day — bring a towel and something to share.",
    category: 'community',
    coverTheme: 'ocean',
    titleFont: 'classic',
    effect: 'none',
    dressCode: 'Swimwear + sunscreen',
  },
];

export function getEventTemplate(id: string): EventTemplate | undefined {
  return EVENT_TEMPLATES.find((t) => t.id === id);
}
