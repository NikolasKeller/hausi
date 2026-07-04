// Hausi corporate identity — "dusk" palette, derived from the onboarding
// aurora: peach horizon → violet dusk → deep plum water, with neon pink
// as the brand accent. Every screen styles itself from these tokens.

export const colors = {
  // Surfaces
  bg: '#171129',
  card: '#241B3A',
  cardBorder: '#3A2D5C',
  inputBg: '#1D1533',
  // Type
  text: '#F7F5FF',
  muted: '#A79BC8',
  // Brand
  accent: '#FF7AE0',
  accentDark: '#C13FA8',
  violet: '#8B5CF6',
  // Ink for text/icons sitting on the pink accent fill.
  onAccent: '#1A1022',
  // Semantics
  danger: '#FF6B81',
  success: '#5EE6A8',
  warning: '#FFD166',
};

// The signature dusk ramp (backgrounds, heroes).
export const dusk = ['#E8927C', '#B76E9B', '#6E4E8E', '#3B2E5E', '#241B3A'] as const;

// Primary action gradient — neon pink into violet.
export const brandGradient = ['#FF4FD8', '#8B5CF6'] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
};
