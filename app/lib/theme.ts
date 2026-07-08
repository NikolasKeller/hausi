// iykyk design system — black + liquid chrome. A pure-black nocturnal canvas
// (matching the molten-silver wordmark artwork), near-white silver for text and
// primary actions, dark glass cards with silver hairlines, and dim greys for
// everything secondary. Minimal, metallic, if-you-know-you-know.

// ── App palette (black canvas) ────────────────────────────────────────────────
export const colors = {
  // Surfaces
  bg: '#000000',        // pure black canvas (the chrome artwork's ground)
  card: '#121212',      // elevated near-black card
  cardBorder: 'rgba(255,255,255,0.14)', // silver hairline on black
  inputBg: 'rgba(255,255,255,0.07)',    // translucent field fill
  // Type
  text: '#F5F5F5',      // near-white silver ink
  muted: 'rgba(245,245,245,0.55)',      // dimmed silver
  // Brand / accent — polished silver (the chrome look's bright pole)
  accent: '#D6D6D6',
  accentDark: '#9A9A9A',
  violet: '#B8B8B8',    // kept name for back-compat — now a light silver
  helio: '#8F8F8F',     // dim silver secondary (headlines, subtle glows)
  // High-contrast solid fill (a bright silver pill on the black canvas)
  ink: '#F2F2F2',
  // Text on the silver/gradient accent fill
  onAccent: '#0A0A0A',
  // Text on an ink solid fill
  onInk: '#0A0A0A',
  // Semantics
  danger: '#FF5A5F',
  success: '#4ADE80',
  warning: '#FACC15',
};

// ── Elevated surfaces (kept under the `light` name for back-compat) ───────────
export const light = {
  // Surfaces
  bg: '#000000', // black canvas
  paper: '#121212', // near-black card / panel
  // Ink & type ramp (near-white → dim)
  ink: '#F2F2F2',
  text: '#F5F5F5',
  text2: 'rgba(245,245,245,0.80)', // strong secondary
  text3: 'rgba(245,245,245,0.60)', // tertiary
  muted: 'rgba(245,245,245,0.45)', // faint
  disabled: 'rgba(245,245,245,0.30)',
  border: 'rgba(255,255,255,0.16)', // structural hairline
  hairline: 'rgba(255,255,255,0.10)', // soft divider
  inputBg: 'rgba(255,255,255,0.07)',
  // Accents
  sand: '#8F8F8F', // dim silver (kept for active nav highlights)
  midnight: '#C9C9C9', // bright silver accent
  onInk: '#0A0A0A', // text on an ink solid fill
};

// ── Neutral brand gradients (the chrome surface) ─────────────────────────────
// A molten-silver ramp for hero backgrounds.
export const dusk = ['#3A3A3A', '#2B2B2B', '#1C1C1C', '#0E0E0E', '#000000'] as const;

export const brand = {
  // The signature gradient — polished chrome: bright silver → steel.
  party: ['#F5F5F5', '#C0C0C0', '#8A8A8A'] as const,
  // Soft dark washes for section backgrounds.
  partyPink: ['#1A1A1A', '#0E0E0E'] as const,
  periwinkle: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)'] as const,
  spearmint: ['#0E0E0E', '#1A1A1A'] as const,
  // Chrome ramp — the primary action gradient (silver pill, dark text).
  glow: ['#EDEDED', '#B9B9B9'] as const,
  // The liquid-metal edge — used for gradient hairline borders on glass cards.
  chromeEdge: ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.28)'] as const,
};

// Kept for back-compat (the primary action gradient).
export const brandGradient = brand.glow;

// RSVP / semantic pills (shared across schemes).
export const rsvp = {
  going: { bg: '#1E9E52', text: '#FFFFFF' },
  maybe: { bg: '#E4B23C', text: '#231A05' },
  no: { bg: '#D93036', text: '#FFFFFF' },
  waitlist: { bg: 'rgba(255,255,255,0.12)', text: '#F5F5F5' },
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

// Glassmorphism radii — generous squircles like the reference dashboards.
export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  milkySm: 28,
  milky: 36,
  milkyLg: 44,
  pill: 999,
};

// Milky frosted-glass tokens — the "frosted pane" look on the black canvas.
export const glass = {
  fill: 'rgba(255,255,255,0.16)',
  fillStrong: 'rgba(255,255,255,0.24)',
  fillLite: 'rgba(255,255,255,0.11)',
  border: 'rgba(255,255,255,0.28)',
  borderSoft: 'rgba(255,255,255,0.12)',
  blur: 48,
  blurNav: 40,
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.55)',
  textFaint: 'rgba(255,255,255,0.38)',
};

// Layered elevation. On the black canvas shadows read as soft darkness under
// silver-edged surfaces; separation comes mostly from the hairline borders.
export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  float: {
    shadowColor: '#000000',
    shadowOpacity: 0.7,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  milky: {
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
};
