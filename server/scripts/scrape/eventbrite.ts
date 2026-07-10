import type { CityConfig, ScrapedEvent } from './types.js';
import { pickOrganizerName } from './organizer.js';
import { classify, politeFetch, sleep, zonedTimeToUtc } from './util.js';

// Eventbrite public search pages (https://www.eventbrite.com/d/<city>/<term>/)
// embed the full result set as window.__SERVER_DATA__ — name, summary, local
// start date/time, timezone, venue and image, no API key needed.
// Eventbrite rate-limits hard (429 after bursts), so searches are spaced out
// and kept to lifestyle keywords per city.
//
// Term selection (2026-07-10): the set is deliberately spread across event
// TYPES so a city feed isn't dominated by one format (Berlin used to end up
// mostly speed-dating). Former terms run-club / yoga / coffee-meetup were
// dropped: their results are free-signup style and always die at the
// non-ticket-signup validation check, so those searches were pure waste.
const SEARCH_TERMS = [
  // dating (kept, but the inserter caps each category bucket per run)
  'speed-dating',
  // nightlife / parties
  'rooftop-party',
  // comedy & shows
  'comedy',
  // arts & crafts
  'paint-and-sip',
  'pottery',
  'life-drawing',
  // food & drink
  'wine-tasting',
  'supper-club',
  // dance & music participation
  'salsa',
  'karaoke',
  // games & social formats
  'pub-quiz',
  // active social
  'social-sports',
];

interface EbResult {
  name: string;
  summary?: string;
  start_date?: string; // "2026-07-11" local
  start_time?: string; // "10:00" local
  timezone?: string;
  url?: string;
  is_online_event?: boolean;
  is_cancelled?: boolean;
  image?: { url?: string; original?: { url?: string } };
  primary_venue?: {
    name?: string;
    address?: {
      city?: string;
      localized_address_display?: string;
    };
  };
}

// The search results carry no price/organizer data, so each candidate needs one
// event-page fetch: the page embeds a schema.org AggregateOffer with the real
// ticket price range, plus the organizer as {"@type":"Organization","name":…}.
// price is '' for free/priceless events; the whole result is null when the page
// couldn't be fetched (so the caller may retry under a later search term).
// lowPrice/highPrice appear both quoted ("11.83") and as bare JSON numbers.
export async function fetchEventPage(
  eventUrl: string
): Promise<{ price: string; organizerName: string } | null> {
  const res = await politeFetch(eventUrl, {}, { retries: 2, timeoutMs: 20000 });
  if (!res) return null;
  let html = '';
  try {
    html = await res.text();
  } catch {
    return null;
  }
  const organizerName =
    html.match(/"organizer"\s*:\s*\{\s*"@type"\s*:\s*"Organization"\s*,\s*"name"\s*:\s*"([^"]{1,120})"/)?.[1] ?? '';

  const low = html.match(/"lowPrice"\s*:\s*"?([\d.]+)"?/)?.[1];
  const currency = html.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/)?.[1];
  const high = html.match(/"highPrice"\s*:\s*"?([\d.]+)"?/)?.[1];
  const amount = Number(low);
  // No positive lowPrice ⇒ the event is free (its offer shows 0.00) or has no
  // published price; either way it fails the paid-only rule.
  if (!low || !currency || !Number.isFinite(amount) || amount <= 0) {
    return { price: '', organizerName };
  }
  const label = amount.toFixed(Number.isInteger(amount) ? 0 : 2);
  const price =
    high && Number(high) > amount ? `From ${label} ${currency}` : `${label} ${currency}`;
  return { price, organizerName };
}

function extractServerData(html: string): EbResult[] {
  const m = html.match(/window\.__SERVER_DATA__\s*=\s*(\{.*?\});\s*\n/s);
  if (!m) return [];
  try {
    const data = JSON.parse(m[1]) as {
      search_data?: { events?: { results?: EbResult[] } };
    };
    return data.search_data?.events?.results ?? [];
  } catch {
    return [];
  }
}

// Accepted events per search term: keeps the per-candidate page fetches (the
// slow, rate-limited part) bounded now that the term list is longer, and stops
// a single prolific term from flooding the city's candidate pool.
const MAX_ACCEPTED_PER_TERM = 8;

export async function scrapeEventbrite(config: CityConfig): Promise<ScrapedEvent[]> {
  if (!config.eventbriteSlug) return [];
  const out: ScrapedEvent[] = [];
  const seenUrls = new Set<string>();

  for (const term of SEARCH_TERMS) {
    const url = `https://www.eventbrite.com/d/${config.eventbriteSlug}/${term}/`;
    const res = await politeFetch(url, {}, { retries: 3, timeoutMs: 25000 });
    await sleep(2000 + Math.random() * 1000);
    if (!res) continue;
    let results: EbResult[] = [];
    try {
      results = extractServerData(await res.text());
    } catch {
      continue;
    }

    let acceptedForTerm = 0;
    for (const r of results) {
      if (acceptedForTerm >= MAX_ACCEPTED_PER_TERM) break;
      if (!r.url || seenUrls.has(r.url)) continue;
      if (r.is_online_event || r.is_cancelled) continue;
      if (!r.start_date || !r.start_time || !r.timezone) continue;
      // Search results can bleed into neighbouring towns; require the venue
      // city to match (Eventbrite uses the English name on .com). Cities whose
      // Eventbrite spelling differs (Washington DC → "Washington", NYC
      // boroughs, "Ciudad de México" …) list accepted aliases in their config.
      const venueCity = r.primary_venue?.address?.city?.trim().toLowerCase() ?? '';
      const acceptedCities = [
        config.name.toLowerCase(),
        ...(config.eventbriteCityAliases ?? []),
      ];
      if (venueCity && !acceptedCities.includes(venueCity)) continue;
      const cls = classify(r.name, r.summary ?? '');
      if (!cls) continue;
      // Paid events only: one extra page fetch per candidate for price+organizer.
      const page = await fetchEventPage(r.url);
      await sleep(1500 + Math.random() * 1000);
      // null = fetch failed — leave the URL unmarked so a later search term
      // gets another shot; price '' = definitively free/priceless — mark & skip.
      if (page == null) continue;
      seenUrls.add(r.url);
      if (!page.price) continue;
      acceptedForTerm++;
      const description = (r.summary ?? '').trim();
      out.push({
        source: 'eventbrite',
        sourceUrl: r.url,
        title: r.name.trim(),
        description,
        startAt: zonedTimeToUtc(`${r.start_date}T${r.start_time}:00`, r.timezone),
        venueName: r.primary_venue?.name ?? '',
        address: r.primary_venue?.address?.localized_address_display ?? '',
        city: config.name,
        imageUrl: r.image?.original?.url ?? r.image?.url ?? '',
        hype: 0,
        priceLabel: page.price,
        // Eventbrite's own event page is a real paid checkout — accepted.
        ticketUrl: r.url,
        organizerName: pickOrganizerName({
          promoterName: page.organizerName,
          venueName: r.primary_venue?.name,
          title: r.name,
          description,
          // Scraped from the event's own page (its organizer account).
          authoritative: true,
        }),
      });
    }
  }
  return out;
}
