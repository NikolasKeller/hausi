// Hausi design system — a faithful clone of Partiful's look: a near-black
// (#111) canvas, white type in a tight neo-grotesque (Inter ≈ TWK Lausanne),
// translucent white surfaces/hairlines, and a vibrant pink→violet→blue party
// gradient as the signature accent. Dark, playful, nightlife-flavored.

// ── App palette (dark "midnight" canvas) ─────────────────────────────────────
export const colors = {
  // Surfaces
  bg: '#111111',        // Partiful near-black canvas
  card: '#1C1C1E',      // elevated dark card
  cardBorder: 'rgba(255,255,255,0.10)', // hairline on dark
  inputBg: 'rgba(255,255,255,0.07)',    // translucent field fill
  // Type
  text: '#FFFFFF',      // white ink
  muted: 'rgba(255,255,255,0.56)',      // dimmed white
  // Brand / accent — Partiful hot pink
  accent: '#FF3B9A',
  accentDark: '#D42177',
  violet: '#B15CFF',    // party violet
  helio: '#FF3B9A',     // same as accent
  // High-contrast solid fill (a white pill on the dark canvas)
  ink: '#FFFFFF',
  // Text on the pink/gradient accent fill
  onAccent: '#FFFFFF',
  // Text on a white solid fill
  onInk: '#111111',
  // Semantics
  danger: '#FF5A5F',
  success: '#31C46B',
  warning: '#FFB020',
};

// ── Elevated dark surfaces (was the "paper" light palette) ────────────────────
// Kept under the `light` name for back-compat with the many callers, but now a
// dark-on-dark surface scheme so "paper" cards read as Partiful's dark panels.
export const light = {
  // Surfaces
  bg: '#111111', // dark canvas
  paper: '#1C1C1E', // elevated dark card / panel
  // Ink & type ramp (white → dim)
  ink: '#FFFFFF',
  text: '#FFFFFF',
  text2: 'rgba(255,255,255,0.80)', // bright secondary
  text3: 'rgba(255,255,255,0.60)', // tertiary
  muted: 'rgba(255,255,255,0.45)', // faint
  disabled: 'rgba(255,255,255,0.30)',
  border: 'rgba(255,255,255,0.14)', // structural hairline
  hairline: 'rgba(255,255,255,0.10)', // soft divider
  inputBg: 'rgba(255,255,255,0.07)',
  // Accents
  sand: '#D9C58B', // warm sand (kept for active nav highlights)
  midnight: '#4F7BFF', // electric blue accent
  onInk: '#111111', // text on a white solid fill
};

// ── Vibrant brand gradients (the festive party surface) ──────────────────────
// A dusk→night ramp for dark hero backgrounds.
export const dusk = ['#E8927C', '#B76E9B', '#6E4E8E', '#3B2E5E', '#241B3A'] as const;

export const brand = {
  // The signature Partiful party gradient — heliotrope → hot pink → electric blue.
  party: ['#D241FA', '#FF4FD8', '#4B7BFF'] as const,
  // Soft pastel washes for light section backgrounds.
  partyPink: ['#F8C4FF', '#F0B6E0'] as const,
  periwinkle: ['rgba(150,196,255,0.28)', 'rgba(255,255,255,0)'] as const,
  spearmint: ['#85DADC', '#C0E2E2'] as const,
  // Neon pink → violet — the primary action gradient.
  glow: ['#FF4FD8', '#8B5CF6'] as const,
};

// Kept for back-compat (the primary action gradient).
export const brandGradient = brand.glow;

// RSVP / semantic pills (shared across schemes).
export const rsvp = {
  going: { bg: '#31C431', text: '#0A1A0A' },
  maybe: { bg: '#FFAE00', text: '#1A1022' },
  no: { bg: '#E5484D', text: '#FFFFFF' },
  waitlist: { bg: 'rgba(255,255,255,0.16)', text: '#FFFFFF' },
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

// Layered elevation. On the dark canvas shadows read faintly; surfaces are
// mostly separated by their translucent hairline border, with a soft shadow to
// ground floating elements (RSVP bar, sheets).
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  float: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
};
