// iykyk design system — a light textured-paper canvas (the same stock the
// chrome wordmark is rendered on), graphite-silver ink, crisp white cards, and
// a real chrome gradient reserved for large headlines. Neutral, metallic,
// print-like.

// ── App palette (paper canvas) ────────────────────────────────────────────────
export const colors = {
  // Surfaces — bg is the flat fallback under the paper-texture image.
  bg: '#F1F1F1',        // near-white paper (matches the texture's average)
  card: '#FFFFFF',      // crisp white card, lifts off the texture via shadow
  cardBorder: 'rgba(0,0,0,0.07)',       // hairline on light
  inputBg: 'rgba(255,255,255,0.65)',    // translucent field fill
  // Type — graphite silver (metallic feel, still high contrast on paper)
  text: '#2B2E33',      // graphite ink
  muted: '#6A6E75',     // mid graphite-silver
  // Brand / accent — near-black graphite (the chrome look's dark pole)
  accent: '#20242A',
  accentDark: '#0E1013',
  violet: '#4A4E55',    // kept name for back-compat — a graphite grey
  helio: '#565B63',     // darker silver for headline fallbacks
  // High-contrast solid fill (a dark pill on the paper canvas)
  ink: '#20242A',
  // Text on the graphite/gradient accent fill
  onAccent: '#FFFFFF',
  // Text on an ink solid fill
  onInk: '#FFFFFF',
  // Semantics
  danger: '#D93036',
  success: '#1E9E52',
  warning: '#B87A00',
};

// The chrome gradient for large headlines (MaskedView), top-lit steel.
export const chrome = ['#E8EBEF', '#AEB4BC', '#5B616B', '#B9BFC7', '#868C96'] as const;

// ── Elevated surfaces (kept under the `light` name for back-compat) ───────────
export const light = {
  // Surfaces
  bg: '#F1F1F1', // paper canvas
  paper: '#FFFFFF', // white card / panel
  // Ink & type ramp (graphite → dim silver)
  ink: '#2B2E33',
  text: '#2B2E33',
  text2: '#4A4E55', // strong secondary
  text3: '#6A6E75', // tertiary
  muted: '#868C94', // faint silver
  disabled: 'rgba(43,46,51,0.30)',
  border: 'rgba(0,0,0,0.10)', // structural hairline
  hairline: 'rgba(0,0,0,0.07)', // soft divider
  inputBg: 'rgba(255,255,255,0.65)',
  // Accents
  sand: '#B4A88F', // warm sand (kept for active nav highlights)
  midnight: '#3A3E45', // graphite accent
  onInk: '#FFFFFF', // text on an ink solid fill
};

// ── Neutral brand gradients (the chrome surface) ─────────────────────────────
// A silver dawn ramp for hero backgrounds.
export const dusk = ['#E6E2DB', '#CFC7BD', '#AFA79C', '#8D867B', '#6E675D'] as const;

export const brand = {
  // The signature gradient — polished chrome: light silver → steel.
  party: ['#EFECE6', '#C2BBB0', '#8F887D'] as const,
  // Soft neutral washes for section backgrounds.
  partyPink: ['#EDE9E2', '#DCD6CC'] as const,
  periwinkle: ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)'] as const,
  spearmint: ['#DCD6CC', '#EFECE6'] as const,
  // Anthracite ramp — the primary action gradient.
  glow: ['#3A3A3A', '#111111'] as const,
};

// Kept for back-compat (the primary action gradient).
export const brandGradient = brand.glow;

// RSVP / semantic pills (shared across schemes).
export const rsvp = {
  going: { bg: '#1E9E52', text: '#FFFFFF' },
  maybe: { bg: '#E4B23C', text: '#231A05' },
  no: { bg: '#D93036', text: '#FFFFFF' },
  waitlist: { bg: 'rgba(0,0,0,0.10)', text: '#171717' },
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

// Layered elevation. On the cream canvas shadows stay soft and warm; surfaces
// are mostly separated by their hairline border, with a gentle shadow to
// ground floating elements (RSVP bar, sheets).
export const shadow = {
  card: {
    shadowColor: '#4A4438',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  float: {
    shadowColor: '#4A4438',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
};
