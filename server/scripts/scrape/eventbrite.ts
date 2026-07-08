import type { CityConfig, ScrapedEvent } from './types.js';
import { classify, politeFetch, sleep, zonedTimeToUtc } from './util.js';

// Eventbrite public search pages (https://www.eventbrite.com/d/<city>/<term>/)
// embed the full result set as window.__SERVER_DATA__ — name, summary, local
// start date/time, timezone, venue and image, no API key needed.
// Eventbrite rate-limits hard (429 after bursts), so searches are spaced out
// and kept to a handful of lifestyle keywords per city.

const SEARCH_TERMS = [
  'run-club',
  'speed-dating',
  'yoga',
  'coffee-meetup',
  'rooftop-party',
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

    for (const r of results) {
      if (!r.url || seenUrls.has(r.url)) continue;
      if (r.is_online_event || r.is_cancelled) continue;
      if (!r.start_date || !r.start_time || !r.timezone) continue;
      // Search results can bleed into neighbouring towns; require the venue
      // city to match (Eventbrite uses the English name on .com).
      const venueCity = r.primary_venue?.address?.city?.trim().toLowerCase() ?? '';
      if (venueCity && venueCity !== config.name.toLowerCase()) continue;
      const cls = classify(r.name, r.summary ?? '');
      if (!cls) continue;
      seenUrls.add(r.url);
      out.push({
        source: 'eventbrite',
        sourceUrl: r.url,
        title: r.name.trim(),
        description: (r.summary ?? '').trim(),
        startAt: zonedTimeToUtc(`${r.start_date}T${r.start_time}:00`, r.timezone),
        venueName: r.primary_venue?.name ?? '',
        address: r.primary_venue?.address?.localized_address_display ?? '',
        city: config.name,
        imageUrl: r.image?.original?.url ?? r.image?.url ?? '',
        hype: 0,
      });
    }
  }
  return out;
}
