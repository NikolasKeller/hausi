// Shared shapes for the event scraper (server/scripts/scrape-events.ts).

// 'ticketio' is the current source: organiser/club shops on ticket.io, whose
// buy links stay on the club's own domain. The aggregator sources (luma/ra/
// eventbrite) are kept in the type for the legacy discovery modules but are no
// longer inserted — their ticket links point at aggregators (forbidden).
export type SourceName = 'ticketio' | 'luma' | 'ra' | 'eventbrite' | 'allevents';

// One real event as scraped from a source. Every field is taken verbatim from
// the source (or derived mechanically, e.g. timezone conversion) — nothing is
// ever invented.
export interface ScrapedEvent {
  source: SourceName;
  sourceUrl: string;
  title: string;
  // Verbatim description from the source ('' when the source has none — we
  // store '' rather than inventing copy).
  description: string;
  startAt: Date;
  venueName: string;
  address: string;
  // Canonical app city name (e.g. "Munich", matching app/shared/cities.ts).
  city: string;
  imageUrl: string;
  // Source-specific popularity signal (0 when the source exposes none).
  hype: number;
  // Ticket price as shown to guests, following the app's costPerPerson
  // convention ("15 EUR", "From 17 EUR"). '' means no paid ticket → rejected.
  priceLabel: string;
  // The organiser's/club's own ticket-shop URL (buy-button target). Must not be
  // an aggregator; enforced by the validation checklist.
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
