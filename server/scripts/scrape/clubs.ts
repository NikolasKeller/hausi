// Curated list of clubs / promoters that sell tickets through their OWN shop on
// ticket.io (a white-label ticketing platform — each shop is the organiser's
// own branded storefront on their own subdomain, NOT a discovery aggregator).
// Every shop below was verified live on 2026-07-08 to return schema.org
// MusicEvent JSON-LD with per-event prices and buy links on the club's shop.
//
// A shop can list events in several cities (promoter shops do), so the parser
// derives each event's city from its JSON-LD location and drops anything that
// isn't one of the 24 target cities — the `city` here is only documentation.
export interface ClubShop {
  // ticket.io subdomain: https://<slug>.ticket.io/?lang=en
  slug: string;
  // Human label for logs/report.
  name: string;
  // Primary city (documentation only; real city comes from each event).
  city: string;
}

export const CLUB_SHOPS: ClubShop[] = [
  { slug: 'blitzclub', name: 'Blitz', city: 'Munich' },
  { slug: 'dna-club', name: 'DNA', city: 'Munich' },
  { slug: 'rotesonne', name: 'Rote Sonne', city: 'Munich' },
  { slug: 'bootshaus', name: 'Bootshaus', city: 'Cologne' },
  { slug: 'robertjohnson', name: 'Robert Johnson', city: 'Frankfurt' },
  // Promoter shops running nights at Berlin's Club Gretchen.
  { slug: 'hollywoodtramp', name: 'Hollywood Tramp (Gretchen)', city: 'Berlin' },
  { slug: 'afrohaus', name: 'Afro Haus (Gretchen)', city: 'Berlin' },
];

// Locality strings (from ticket.io JSON-LD, often localized) → canonical target
// city. Offenbach is treated as the Frankfurt metro (Robert Johnson sits just
// across the river and the user lists it under Frankfurt).
export const CITY_BY_LOCALITY: Record<string, string> = {
  'münchen': 'Munich',
  'munchen': 'Munich',
  'munich': 'Munich',
  'köln': 'Cologne',
  'koln': 'Cologne',
  'cologne': 'Cologne',
  'berlin': 'Berlin',
  'hamburg': 'Hamburg',
  'frankfurt': 'Frankfurt',
  'frankfurt am main': 'Frankfurt',
  'offenbach': 'Frankfurt',
  'offenbach am main': 'Frankfurt',
  'wien': 'Vienna',
  'vienna': 'Vienna',
  'zürich': 'Zurich',
  'zurich': 'Zurich',
  'amsterdam': 'Amsterdam',
};

export function localityToCity(locality: string | undefined | null): string | null {
  if (!locality) return null;
  return CITY_BY_LOCALITY[locality.trim().toLowerCase()] ?? null;
}
