// iykyk design system — nightlife edition. A midnight-blue canvas with soft
// out-of-focus city/stage lights (the generated bokeh backdrop), silver-white
// ink, dark translucent cards with hairlines, and the chrome gradient for
// large headlines. Neutral, metallic, after-dark.

// ── App palette (midnight canvas) ─────────────────────────────────────────────
export const colors = {
  // Surfaces — bg is the flat fallback under the bokeh backdrop image.
  bg: '#080B16',        // midnight blue-black (matches the backdrop's average)
  // Dark translucent card over the bokeh — loose enough that the scene
  // shimmers through (solid-looking cards read flat/"vibe-coded").
  card: 'rgba(20,25,40,0.72)',
  cardBorder: 'rgba(255,255,255,0.10)', // hairline on dark
  inputBg: 'rgba(255,255,255,0.08)',    // translucent field fill
  // Type — silver-white (metallic feel, high contrast on midnight)
  text: '#F2F4F8',      // silver-white ink
  muted: '#9AA1AD',     // mid silver
  // Brand / accent — bright silver (the chrome look's light pole on dark)
  accent: '#E9ECF1',
  accentDark: '#C4C9D2',
  violet: '#AEB4BE',    // kept name for back-compat — a light silver grey
  helio: '#C9CED6',     // lighter silver for headline fallbacks
  // High-contrast solid fill (a light pill on the midnight canvas)
  ink: '#F2F4F8',
  // Text on the silver/gradient accent fill
  onAccent: '#101319',
  // Text on an ink solid fill
  onInk: '#101319',
  // Semantics
  danger: '#FF5A60',
  success: '#3DC97A',
  warning: '#E8B23C',
};

// The chrome gradient for large headlines (MaskedView), top-lit steel.
export const chrome = ['#E8EBEF', '#AEB4BC', '#5B616B', '#B9BFC7', '#868C96'] as const;

// ── Elevated surfaces (kept under the `light` name for back-compat) ───────────
export const light = {
  // Surfaces
  bg: '#080B16', // midnight canvas
  paper: 'rgba(22,27,42,0.92)', // dark card / panel
  // Ink & type ramp (silver-white → dim silver)
  ink: '#F2F4F8',
  text: '#F2F4F8',
  text2: '#C6CBD4', // strong secondary
  text3: '#9AA1AD', // tertiary
  muted: '#7C838F', // faint silver
  disabled: 'rgba(242,244,248,0.30)',
  border: 'rgba(255,255,255,0.14)', // structural hairline
  hairline: 'rgba(255,255,255,0.09)', // soft divider
  inputBg: 'rgba(255,255,255,0.08)',
  // Accents
  sand: '#E0B36A', // warm amber (bokeh's warm pole, for active highlights)
  midnight: '#AEB4BE', // silver accent
  onInk: '#101319', // text on an ink solid fill
};

// ── Neutral brand gradients (the chrome surface) ─────────────────────────────
// A steel dusk ramp for hero backgrounds.
export const dusk = ['#3A4152', '#2C3242', '#222736', '#1A1E2B', '#131623'] as const;

export const brand = {
  // The signature gradient — polished chrome: light silver → steel.
  party: ['#EFECE6', '#C2BBB0', '#8F887D'] as const,
  // Soft dark washes for section backgrounds.
  partyPink: ['#1C2233', '#141928'] as const,
  periwinkle: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)'] as const,
  spearmint: ['#141928', '#1C2233'] as const,
  // Silver ramp — the primary action gradient (a bright pill on midnight).
  glow: ['#F4F6F9', '#C9CED6'] as const,
};

// Kept for back-compat (the primary action gradient).
export const brandGradient = brand.glow;

// RSVP / semantic pills (shared across schemes).
export const rsvp = {
  going: { bg: '#1E9E52', text: '#FFFFFF' },
  maybe: { bg: '#E4B23C', text: '#231A05' },
  no: { bg: '#D93036', text: '#FFFFFF' },
  waitlist: { bg: 'rgba(255,255,255,0.14)', text: '#F2F4F8' },
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

// Layered elevation. On the midnight canvas shadows are deep and cool;
// surfaces are mostly separated by their hairline border, with a soft black
// shadow to ground floating elements (RSVP bar, sheets).
export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  float: {
    shadowColor: '#000000',
    shadowOpacity: 0.6,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
};
