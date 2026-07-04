// Hausi design system — a Partiful-inspired "physical party surface": stark
// black ink and heavy structure layered over vibrant, festive gradients.
//
// The app runs two schemes:
//   • LIGHT  — public / marketing surfaces (welcome, auth, shared invites,
//              cards). Black ink on a paper canvas with pastel gradient washes,
//              tilted sticker cards, and starburst accents.
//   • DARK   — the logged-in app. Keeps the moody "dusk" base but adopts the
//              same Partiful structure: heavy borders, big tight-tracked display
//              type, scattered stickers, pill badges, high negative space.
//
// Pure black (`ink`) is the action/structure color everywhere; the vibrant
// `brand` gradients are the festive surface it sits on.

// ── DARK app palette ("dusk") ────────────────────────────────────────────────
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
  helio: '#D241FA',
  // Pure black — the Partiful action/structure ink. Used for heavy borders and
  // dark-mode structural lines.
  ink: '#000000',
  // Ink for text/icons sitting on the pink accent fill.
  onAccent: '#1A1022',
  // Semantics
  danger: '#FF6B81',
  success: '#5EE6A8',
  warning: '#FFD166',
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
