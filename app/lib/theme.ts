// iykyk design system — a warm cream canvas (matching the chrome wordmark
// artwork), near-black ink for text and primary actions, white cards with
// subtle hairlines, and silvery greys for everything secondary. Neutral,
// metallic, print-like.

// ── App palette (cream canvas) ────────────────────────────────────────────────
export const colors = {
  // Surfaces
  bg: '#CFC7BD',        // warm cream/greige canvas (sampled from the artwork)
  card: '#F4F1EB',      // elevated warm-white card
  cardBorder: 'rgba(0,0,0,0.08)',       // hairline on light
  inputBg: 'rgba(255,255,255,0.55)',    // translucent field fill
  // Type
  text: '#171717',      // near-black ink
  muted: 'rgba(23,23,23,0.55)',         // dimmed ink
  // Brand / accent — anthracite (the chrome look's dark pole)
  accent: '#1F1F1F',
  accentDark: '#000000',
  violet: '#4A4A4A',    // kept name for back-compat — now a dark grey
  helio: '#6B6B6B',     // silvery secondary (headlines, subtle glows)
  // High-contrast solid fill (a dark pill on the cream canvas)
  ink: '#171717',
  // Text on the anthracite/gradient accent fill
  onAccent: '#FFFFFF',
  // Text on an ink solid fill
  onInk: '#FFFFFF',
  // Semantics
  danger: '#D93036',
  success: '#1E9E52',
  warning: '#B87A00',
};

// ── Elevated surfaces (kept under the `light` name for back-compat) ───────────
export const light = {
  // Surfaces
  bg: '#CFC7BD', // cream canvas
  paper: '#F4F1EB', // warm-white card / panel
  // Ink & type ramp (near-black → dim)
  ink: '#171717',
  text: '#171717',
  text2: 'rgba(23,23,23,0.80)', // strong secondary
  text3: 'rgba(23,23,23,0.60)', // tertiary
  muted: 'rgba(23,23,23,0.45)', // faint
  disabled: 'rgba(23,23,23,0.30)',
  border: 'rgba(0,0,0,0.12)', // structural hairline
  hairline: 'rgba(0,0,0,0.08)', // soft divider
  inputBg: 'rgba(255,255,255,0.55)',
  // Accents
  sand: '#B4A88F', // warm sand (kept for active nav highlights)
  midnight: '#3A3A3A', // dark grey accent (was electric blue)
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
