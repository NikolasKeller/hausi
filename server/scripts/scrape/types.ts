// Shared shapes for the event scraper (server/scripts/scrape-events.ts).

export type SourceName = 'luma' | 'ra' | 'eventbrite' | 'allevents';

// One real event as scraped from a source. Every field is taken verbatim from
// the source (or derived mechanically, e.g. timezone conversion) — nothing is
// ever invented. `sourceUrl` always points back to the original listing.
export interface ScrapedEvent {
  source: SourceName;
  sourceUrl: string;
  title: string;
  // Verbatim description from the source ('' when the source has none — the
  // inserter then falls back to a purely factual venue/source line).
  description: string;
  startAt: Date;
  venueName: string;
  address: string;
  // Canonical app city name (e.g. "Munich", matching app/shared/cities.ts).
  city: string;
  imageUrl: string;
  // Source-specific popularity signal (RA "attending", luma guest count,
  // 0 when the source exposes none). Only used for ranking, never stored.
  hype: number;
  // Ticket price as shown to guests, following the app's costPerPerson
  // convention ("15 EUR", "From 17 EUR", see prisma/featuredEvents.ts).
  // '' means the source reports no paid ticket — such events are rejected by
  // the paid-ticket validation check and never inserted.
  priceLabel: string;
  // The real paid-ticket URL (buy-button target): the source's own event/
  // checkout page (Eventbrite/RA/venue). lu.ma links are dropped upstream.
  ticketUrl: string;
}

export interface CityConfig {
  // Canonical name from app/shared/cities.ts (COMMON_CITIES) so events surface
  // on Explore without geocoder round trips.
  name: string;
  // IANA timezone for converting venue-local times to UTC.
  timeZone: string;
  // lu.ma discover place id (discplace-…), null when the city has no lu.ma page.
  lumaPlaceId: string | null;
  // Resident Advisor GraphQL area id.
  raAreaId: number | null;
  // eventbrite.com /d/<slug>/ city slug, null when eventbrite.com 404s for it.
  eventbriteSlug: string | null;
  // allevents.in/<slug> city slug.
  alleventsSlug: string | null;
}
