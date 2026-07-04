// Hausi design system — warm cream + black ink, clean grotesque sans (Archivo).
// Inspired by the "Known" aesthetic: off-white linen backgrounds, near-black
// text, warm caramel accent, no purple or neon. Clean and quiet-luxury.

// ── App palette (warm cream / "linen") ───────────────────────────────────────
export const colors = {
  // Surfaces
  bg: '#EEEAE4',        // warm linen — replaces dark purple
  card: '#F9F6F1',      // warm white card
  cardBorder: '#DDD8D0', // soft warm hairline
  inputBg: '#F4F1EB',   // slightly warmer input bg
  // Type
  text: '#1A1714',      // near-black — replaces near-white
  muted: '#9A9088',     // warm gray — replaces cold purple-gray
  // Brand / accent — warm caramel/tan instead of neon pink
  accent: '#C4956A',
  accentDark: '#9A7050',
  violet: '#8A7060',    // warm taupe (keeps the name for compat)
  helio: '#C4956A',     // same as accent
  // Pure black — structural ink
  ink: '#000000',
  // Text on the caramel accent fill
  onAccent: '#FFFFFF',
  // Semantics
  danger: '#C0392B',
  success: '#2D6A4F',
  warning: '#C4956A',
};

// ── LIGHT public palette (the Partiful "paper" surface) ──────────────────────
export const light = {
  // Surfaces
  bg: '#FDFBF7', // warm paper canvas
  paper: '#FFFFFF', // cards / panels
  // Ink & type ramp (Midnight Ink → Ash)
  ink: '#000000',
  text: '#000000',
  text2: '#333333', // graphite
  text3: '#666666', // slate
  muted: '#999999', // ash
  disabled: '#B3B3B3', // fog
  border: '#000000', // heavy structural border = black
  hairline: '#CCCCCC', // silver — soft dividers
  inputBg: '#FFFFFF',
  // Accents
  sand: '#D9C58B', // warm sand (active nav)
  midnight: '#001666', // deep blue accent
  onInk: '#FFFFFF', // text on the black action fill
};

// ── Vibrant brand gradients (the festive party surface) ──────────────────────
// The signature dusk ramp (dark hero backgrounds).
export const dusk = ['#E8927C', '#B76E9B', '#6E4E8E', '#3B2E5E', '#241B3A'] as const;

export const brand = {
  // Bold, in-your-face party gradient — heliotrope → hot pink → electric blue.
  party: ['#D241FA', '#FF4FD8', '#4B7BFF'] as const,
  // Soft pastel washes for light section backgrounds.
  partyPink: ['#F8C4FF', '#F0B6E0'] as const,
  periwinkle: ['rgba(150,196,255,0.28)', 'rgba(255,255,255,0)'] as const,
  spearmint: ['#85DADC', '#C0E2E2'] as const,
  // Neon pink → violet — the legacy action gradient, kept for dark-mode CTAs.
  glow: ['#FF4FD8', '#8B5CF6'] as const,
};

// Kept for back-compat (was the primary action gradient).
export const brandGradient = brand.glow;

// RSVP / semantic pills (shared across schemes).
export const rsvp = {
  going: { bg: '#31C431', text: '#FFFFFF' },
  maybe: { bg: '#FFAE00', text: '#1A1022' },
  no: { bg: '#E5484D', text: '#FFFFFF' },
  waitlist: { bg: 'rgba(0,0,0,0.2)', text: '#FFFFFF' },
};

// Partiful spacing ramp: 4 6 8 10 12 16 20 24 40 60 80.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  huge: 60,
  section: 80,
};

// Partiful radii: nav 4, inputs/buttons 8, cards/images 12, modals 16, pill.
export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

// Layered card elevation (web box-shadow strings + native shadow props live in
// the primitives). Exposed here so screens can share the same depth language.
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  float: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
};
