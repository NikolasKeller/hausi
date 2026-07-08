// Pre-insert validation checklist for scraped events. Every event must pass
// EVERY check or it is dropped (with the failed checks logged by the caller).
//
// This module is deliberately self-contained (no imports, constants inlined)
// so it can be copied verbatim next to out-of-repo import scripts (e.g. the
// production import in /tmp/hausi-crops/) and behave identically there.

// Mirrors app/shared/cities.ts naming for the 24 scraper target cities — the
// DB convention is the English name ("Munich", not "München").
export const TARGET_CITIES = [
  'London', 'Paris', 'Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt',
  'Vienna', 'Zurich', 'Amsterdam', 'Brussels', 'Madrid', 'Barcelona', 'Lisbon',
  'Rome', 'Milan', 'Copenhagen', 'Stockholm', 'Oslo', 'Prague', 'Warsaw',
  'Budapest', 'Dublin', 'Athens',
] as const;

// Mirrors CATEGORIES in app/shared/types.ts.
const VALID_CATEGORIES = new Set(['music', 'community', 'arts', 'food', 'sports', 'other']);

// lu.ma is a free-signup redirect the user explicitly rejects: a buy link on
// lu.ma means "register for free", not a real ticket purchase, so any ticketUrl
// on lu.ma is rejected. Eventbrite and Resident Advisor ARE accepted — they are
// real paid-ticket checkouts.
const FORBIDDEN_TICKET_DOMAINS = [/(^|\.)lu\.ma$/, /(^|\.)luma\.com$/];

const TITLE_PLACEHOLDERS = /^(tba|tbd|untitled|test|placeholder|coming soon|n\/a|-+)$/i;

// Free-signup / recurring-community / drop-in-class style events that you don't
// really "buy a ticket" for — you just register/sign up (often with only a
// nominal fee). The user wants these OUT even when a pseudo-price is attached
// (running clubs, Strava runs, meetups, language exchanges, tech mixers,
// coffee/matcha socials, yoga/pilates/wellness classes …). Real ticketed
// nightlife/shows (club nights, raves, concerts, parties, comedy, speed dating)
// are NOT matched and stay. Word-boundaried and specific to avoid nuking
// nightlife titles (e.g. "club" alone is not a signal — "run club" is).
const SIGNUP_PATTERNS = [
  /\b(run|running|runners?)\s*club\b/i,
  /\bsocial\s*run\b/i,
  /\bwomen'?s\s*run\b/i,
  /\bpark\s*run\b/i,
  /\bstrava\b/i,
  /\bmarathon\b/i,
  /\b\d{1,3}\s*k\s*(run|walk)\b/i,
  /\bbootcamp\b/i,
  /\bwork\s*out\b/i,
  /\bfull body\b/i,
  /\byoga\b/i,
  /\bpilates\b/i,
  /\bsound\s*bath\b/i,
  /\bbreath\s*work\b/i,
  /meditation/i,
  /\bsauna\b/i,
  /\b(meet\s*-?\s*up)\b/i,
  /\blanguage exchange\b/i,
  /\bmake new friends\b/i,
  /\bnew friends\b/i,
  /\b(tech|social|networking)\s*mixer\b/i,
  /\bnetworking\b/i,
  /\bsocial club\b/i,
  /\bsocial (and|&) language\b/i,
  /\bexpat\b/i,
  /\bcoffee club\b/i,
  /\bmatcha\b/i,
  /\beat (&|and) meet\b/i,
  /\bcommunity class\b/i,
  /\bshala\b/i,
  /\b(hike|hiking)\b/i,
  /\bfree (entry|registration|signup|sign[- ]?up)\b/i,
  /\bregister for free\b/i,
  /\brsvp\b/i,
];

// Clearly-ticketed show formats that are real paid events even if their name
// happens to contain a signup-ish word (e.g. a "… Social Club Comedy Show").
// These override the signup patterns so genuine ticketed shows are kept.
const TICKETED_SHOW_OVERRIDE = /\b(stand[- ]?up|comedy|speed dating|drag (show|brunch|bingo))\b/i;

// True when the event looks like a free-signup / meetup / class rather than a
// real ticketed event. Exported so the production cleanup applies the same rule.
//
// Matches on the TITLE ONLY: these event types always announce themselves in
// the title ("… Run Club", "Yin Yoga Class", "Tech Mixer"). Scanning the
// description caused false positives — real club nights/festivals mention "yoga"
// or "meet-up" or "free entry (before 11pm)" in their copy without being
// signups. The `description` param is kept for signature/compat but unused.
export function isFreeSignupStyle(title: string, _description = ''): boolean {
  if (TICKETED_SHOW_OVERRIDE.test(title)) return false;
  return SIGNUP_PATTERNS.some((re) => re.test(title));
}

export const HORIZON_DAYS_DEFAULT = 60;

export type CheckId =
  | 'future-date'      // starts after "now", within the horizon
  | 'real-start-time'  // has a real clock time, not a 00:00 placeholder
  | 'title'            // 3–120 chars, not a placeholder
  | 'city'             // exactly one of the 24 target cities
  | 'location'         // venue/address present, more than just the city name
  | 'category'         // valid app category
  | 'image-url'        // coverImage (when set) is a sane http(s) URL
  | 'paid-ticket'      // costPerPerson parses to an amount > 0
  | 'ticket-url'       // real paid-ticket URL present, https, NOT lu.ma
  | 'no-source-in-desc' // visible description must not leak a URL/source line
  | 'non-ticket-signup' // free-signup / meetup / class style, not a real ticket
  | 'dedupe';          // (title, city, calendar day) not already in the DB

export interface EventCandidate {
  title: string;
  description: string;
  date: Date;
  location: string;
  city: string;
  category: string;
  coverImage: string;
  costPerPerson: string;
  // Real paid-ticket URL (buy-button target); must not be a lu.ma link.
  ticketUrl: string;
}

export interface ValidationOptions {
  now?: Date;
  horizonDays?: number;
  // IANA timezone of the venue, for the midnight-placeholder check; when
  // omitted the check runs against UTC wall time.
  timeZone?: string;
  // Existing (title|city|day) keys; when provided the dedupe check runs.
  existingKeys?: Set<string>;
}

export interface ValidationResult {
  ok: boolean;
  failures: CheckId[];
}

export function dedupeKey(title: string, city: string, startAt: Date): string {
  const day = startAt.toISOString().slice(0, 10);
  return `${title.trim().toLowerCase()}|${city.toLowerCase()}|${day}`;
}

// Parse a costPerPerson label ("15 EUR", "From 17 EUR", "£12", "12.50 GBP")
// into a numeric amount, or null when no positive amount can be read.
export function parsePriceAmount(label: string): number | null {
  const m = label.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const amount = Number(m[1]);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function wallTimeInZone(instant: Date, timeZone: string | undefined): { h: number; m: number; s: number } {
  if (!timeZone) return { h: instant.getUTCHours(), m: instant.getUTCMinutes(), s: instant.getUTCSeconds() };
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(instant);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
    return { h: get('hour') % 24, m: get('minute'), s: get('second') };
  } catch {
    return { h: instant.getUTCHours(), m: instant.getUTCMinutes(), s: instant.getUTCSeconds() };
  }
}

// The buy link must be a real https ticket URL that is NOT a lu.ma redirect.
function ticketUrlOk(ticketUrl: string): boolean {
  try {
    const u = new URL(ticketUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    return !!host && !FORBIDDEN_TICKET_DOMAINS.some((re) => re.test(host));
  } catch {
    return false;
  }
}

// The visible description must not leak any URL/source line — the ticket link
// lives in its own field now.
function descriptionHasUrl(description: string): boolean {
  return /https?:\/\/\S+/i.test(description);
}

export function validateEvent(e: EventCandidate, opts: ValidationOptions = {}): ValidationResult {
  const now = opts.now ?? new Date();
  const horizonDays = opts.horizonDays ?? HORIZON_DAYS_DEFAULT;
  const failures: CheckId[] = [];

  // 1. Future date within the horizon, checked at insert time.
  const horizon = new Date(now.getTime() + horizonDays * 86400_000);
  if (!(e.date instanceof Date) || Number.isNaN(e.date.getTime()) || e.date <= now || e.date >= horizon) {
    failures.push('future-date');
  }

  // 1b. Real start time — a wall-clock of exactly 00:00:00 in the venue's
  // timezone is a date-only placeholder, not a real published start time.
  const wall = wallTimeInZone(e.date, opts.timeZone);
  if (wall.h === 0 && wall.m === 0 && wall.s === 0) failures.push('real-start-time');

  // 2. Title present, 3–120 chars, no placeholder.
  const title = e.title.trim();
  if (title.length < 3 || title.length > 120 || TITLE_PLACEHOLDERS.test(title)) failures.push('title');

  // 3. City is exactly one of the target cities (DB naming convention).
  if (!TARGET_CITIES.some((c) => c === e.city)) failures.push('city');

  // 4. Location present and more than just the city name.
  const location = e.location.trim();
  if (!location || location.toLowerCase() === e.city.trim().toLowerCase()) failures.push('location');

  // 5. Description must not leak a source/URL line (the ticket link lives in
  //    its own field). Empty is allowed — some listings have no description and
  //    inventing one would be a fabrication.
  if (descriptionHasUrl(e.description)) failures.push('no-source-in-desc');

  // 6. Valid app category.
  if (!VALID_CATEGORIES.has(e.category)) failures.push('category');

  // 7. Image URL, when set, must be a plausible http(s) URL (no data: URIs).
  if (e.coverImage) {
    let ok = false;
    try {
      const u = new URL(e.coverImage);
      ok = (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname;
    } catch {
      ok = false;
    }
    if (!ok) failures.push('image-url');
  }

  // 8. Paid ticket required: costPerPerson must parse to an amount > 0.
  if (parsePriceAmount(e.costPerPerson) == null) failures.push('paid-ticket');

  // 8b. Buy link must be a real paid-ticket URL, never a lu.ma free-signup.
  if (!ticketUrlOk(e.ticketUrl)) failures.push('ticket-url');

  // 8c. Not a free-signup / meetup / drop-in-class style event (run clubs,
  //     Strava, language exchanges, yoga classes …) — you don't buy a ticket
  //     for those, you just register, so they don't belong in a ticketed feed.
  if (isFreeSignupStyle(e.title, e.description)) failures.push('non-ticket-signup');

  // 9. Dedupe against the DB (when the caller provides the key set).
  if (opts.existingKeys && opts.existingKeys.has(dedupeKey(e.title, e.city, e.date))) {
    failures.push('dedupe');
  }

  return { ok: failures.length === 0, failures };
}

// Running tally of rejections, for the end-of-run report.
export class ValidationStats {
  total = 0;
  passed = 0;
  byReason = new Map<CheckId, number>();

  record(result: ValidationResult): void {
    this.total += 1;
    if (result.ok) {
      this.passed += 1;
      return;
    }
    for (const f of result.failures) {
      this.byReason.set(f, (this.byReason.get(f) ?? 0) + 1);
    }
  }

  summary(): string {
    const dropped = this.total - this.passed;
    const reasons = [...this.byReason.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([reason, n]) => `  ${reason}: ${n}`)
      .join('\n');
    return `validation: ${this.passed}/${this.total} passed, ${dropped} dropped${reasons ? `\nfailed checks (events can fail several):\n${reasons}` : ''}`;
  }
}
