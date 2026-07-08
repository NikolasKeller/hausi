// Picking the real organizer/promoter for a scraped event, plausibility-checked
// against the event's own title/description ("check that with the description
// and website for context"). Never invents a name:
//  1. The source's promoter/organizer name, when corroborated by the title or
//     description (case-insensitive containment), is the host.
//  2. Otherwise the venue name (also verbatim from the source) is the fallback.
//  3. Otherwise '' — the caller keeps the neutral scout host.

const MAX_NAME = 80; // User.name column budget (see app/shared/types LIMITS)

function clean(name: string | null | undefined): string {
  return (name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}

// Loose containment: does `needle` (organizer) appear in `haystack` ignoring
// case and diacritics? Guards against trivially-short needles ("DJ", "e.V.").
function mentions(haystack: string, needle: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const n = norm(needle);
  return n.length >= 3 && norm(haystack).includes(n);
}

export function pickOrganizerName(input: {
  promoterName?: string | null;
  venueName?: string | null;
  title: string;
  description: string;
  // True when the promoter name comes from the event's own page/account (e.g.
  // Eventbrite's organizer object) — that IS the website context, so it's used
  // directly. RA promoter listings are looser, so they additionally need to be
  // corroborated by the title/description before beating the venue fallback.
  authoritative?: boolean;
}): string {
  const promoter = clean(input.promoterName);
  const venue = clean(input.venueName);
  const context = `${input.title}\n${input.description.slice(0, 600)}`;

  if (promoter && (input.authoritative || mentions(context, promoter))) return promoter;
  if (venue) return venue;
  // Uncorroborated promoter is still a real name from the source — better than
  // nothing when there is no venue to fall back to.
  if (promoter) return promoter;
  return '';
}

// Normalized dedupe key / email slug for an organizer org account
// ("PAPItutmirleid" → org-papitutmirleid@hausi.app).
export function organizerSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'organizer';
}
