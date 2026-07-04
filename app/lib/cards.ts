import type { CardTheme, CoverTheme } from '../shared/types';

// Cover gradient + emoji + label for each card theme. Shared by the card
// composer (send-card) and the shared-card viewer (card/[id]).
export const CARD_META: Record<CardTheme, { cover: CoverTheme; emoji: string; label: string }> = {
  confetti: { cover: 'disco', emoji: '🎊', label: 'Confetti' },
  birthday: { cover: 'candy', emoji: '🎂', label: 'Birthday' },
  thanks: { cover: 'sunset', emoji: '🙏', label: 'Thanks' },
  'miss-you': { cover: 'ocean', emoji: '🥺', label: 'Miss you' },
  congrats: { cover: 'forest', emoji: '🏆', label: 'Congrats' },
};
