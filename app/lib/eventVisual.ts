import type { Category, CoverTheme } from '../shared/types';

// A themed look for an event derived from what it IS: gradient theme for the
// page backdrop plus a small emoji banner for the hero. Keyword matches (in
// English and German) beat the category fallback, so a "Birthday Dinner"
// feels like a birthday, not a generic community event.
export interface EventVisual {
  theme: CoverTheme;
  emojis: [string, string, string];
}

const KEYWORD_VISUALS: { pattern: RegExp; visual: EventVisual }[] = [
  { pattern: /birthday|geburtstag|b-?day/i, visual: { theme: 'gold', emojis: ['🎈', '🎂', '🎉'] } },
  { pattern: /halloween/i, visual: { theme: 'halloween', emojis: ['🎃', '👻', '🕸️'] } },
  { pattern: /christmas|weihnacht|xmas/i, visual: { theme: 'forest', emojis: ['🎄', '✨', '🎁'] } },
  { pattern: /new year|silvester|nye/i, visual: { theme: 'gold', emojis: ['🎆', '🥂', '✨'] } },
  { pattern: /wedding|hochzeit/i, visual: { theme: 'blossom', emojis: ['💍', '🥂', '🌸'] } },
  { pattern: /karaoke/i, visual: { theme: 'disco', emojis: ['🎤', '🪩', '🎶'] } },
  { pattern: /techno|rave|club night|clubbing/i, visual: { theme: 'disco', emojis: ['🪩', '🔊', '⚡'] } },
  { pattern: /pool|beach|strand/i, visual: { theme: 'ocean', emojis: ['🏖️', '🌊', '🍹'] } },
  { pattern: /picnic|picknick/i, visual: { theme: 'matcha', emojis: ['🧺', '☀️', '🍉'] } },
  { pattern: /brunch|breakfast|frühstück/i, visual: { theme: 'peach', emojis: ['🥐', '🍳', '☕'] } },
  { pattern: /dinner|supper|abendessen/i, visual: { theme: 'peach', emojis: ['🍽️', '🥂', '🕯️'] } },
  { pattern: /wine|wein|tasting/i, visual: { theme: 'berry', emojis: ['🍷', '🧀', '🍇'] } },
  { pattern: /bbq|barbecue|grill/i, visual: { theme: 'lava', emojis: ['🔥', '🍔', '🌭'] } },
  { pattern: /paint|malen|sip ?& ?stroke/i, visual: { theme: 'blossom', emojis: ['🎨', '🖌️', '✨'] } },
  { pattern: /movie|film ?night|kino|cinema/i, visual: { theme: 'noir', emojis: ['🎬', '🍿', '🎞️'] } },
  { pattern: /game|spiele|trivia|quiz/i, visual: { theme: 'candy', emojis: ['🎲', '🃏', '🍿'] } },
  { pattern: /run|lauf|marathon|jog/i, visual: { theme: 'forest', emojis: ['🏃', '🌤️', '🏅'] } },
  { pattern: /hike|wander/i, visual: { theme: 'forest', emojis: ['🥾', '⛰️', '🌲'] } },
  { pattern: /yoga|meditation/i, visual: { theme: 'matcha', emojis: ['🧘', '🌿', '🕊️'] } },
  { pattern: /coffee|kaffee/i, visual: { theme: 'cloud', emojis: ['☕', '🥐', '📚'] } },
];

const CATEGORY_FALLBACK: Record<Category, EventVisual> = {
  music: { theme: 'disco', emojis: ['🎶', '🪩', '🎧'] },
  community: { theme: 'sunset', emojis: ['✨', '🫶', '🎉'] },
  food: { theme: 'peach', emojis: ['🍽️', '🥂', '😋'] },
  arts: { theme: 'blossom', emojis: ['🎨', '🖌️', '✨'] },
  sports: { theme: 'forest', emojis: ['🏃', '🔥', '🏅'] },
  other: { theme: 'midnight', emojis: ['✨', '🌙', '🎈'] },
};

export function eventVisual(
  title: string,
  description: string,
  category: Category
): EventVisual {
  const haystack = `${title} ${description}`;
  for (const { pattern, visual } of KEYWORD_VISUALS) {
    if (pattern.test(haystack)) return visual;
  }
  return CATEGORY_FALLBACK[category] ?? CATEGORY_FALLBACK.other;
}
