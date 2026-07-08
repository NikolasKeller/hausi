import type { CityConfig, ScrapedEvent } from './types.js';
import { htmlToText, politeFetch, zonedTimeToUtc } from './util.js';

// Resident Advisor public GraphQL (same endpoint the ra.co event listings use).
// Sorted by "attending" so the most hyped club nights come first; `content`
// carries the promoter's real event description.

const RA_ENDPOINT = 'https://ra.co/graphql';

const LISTINGS_QUERY = `query GET_EVENT_LISTINGS($filters: FilterInputDtoInput, $page: Int, $pageSize: Int, $sort: SortInputDtoInput) {
  eventListings(filters: $filters, page: $page, pageSize: $pageSize, sort: $sort) {
    data {
      event {
        id
        title
        content
        attending
        startTime
        contentUrl
        images { filename }
        venue { name address }
      }
    }
    totalResults
  }
}`;

interface RaEvent {
  id: string;
  title: string;
  content: string | null;
  attending: number | null;
  startTime: string | null; // venue-local wall time, e.g. 2026-07-10T23:00:00.000
  contentUrl: string;
  images: { filename: string }[];
  venue: { name: string; address: string | null } | null;
}

export async function scrapeRa(config: CityConfig, take = 30, horizonDays = 30): Promise<ScrapedEvent[]> {
  if (config.raAreaId == null) return [];
  const gte = new Date().toISOString().slice(0, 10);
  const lte = new Date(Date.now() + horizonDays * 86400_000).toISOString().slice(0, 10);
  const body = JSON.stringify({
    query: LISTINGS_QUERY,
    variables: {
      filters: { areas: { eq: config.raAreaId }, listingDate: { gte, lte } },
      pageSize: take,
      page: 1,
      sort: { attending: { order: 'DESCENDING' } },
    },
  });
  const res = await politeFetch(RA_ENDPOINT, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      Referer: `https://ra.co/events`,
    },
  });
  if (!res) return [];
  let listings: { event: RaEvent }[] = [];
  try {
    const json = (await res.json()) as {
      data?: { eventListings?: { data?: { event: RaEvent }[] } };
    };
    listings = json.data?.eventListings?.data ?? [];
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const out: ScrapedEvent[] = [];
  for (const { event: ev } of listings) {
    if (!ev?.startTime || seen.has(ev.id)) continue;
    seen.add(ev.id);
    // RA startTime is venue-local; treating it in the city's timezone.
    const startAt = zonedRaTime(ev.startTime, config.timeZone);
    out.push({
      source: 'ra',
      sourceUrl: `https://ra.co${ev.contentUrl}`,
      title: ev.title.trim(),
      description: ev.content ? htmlToText(ev.content).slice(0, 2500) : '',
      startAt,
      venueName: ev.venue?.name ?? '',
      address: ev.venue?.address ?? '',
      city: config.name,
      imageUrl: ev.images?.[0]?.filename ?? '',
      hype: ev.attending ?? 0,
    });
  }
  return out;
}

function zonedRaTime(startTime: string, timeZone: string): Date {
  // "2026-07-10T23:00:00.000" (no offset) → interpret in the venue timezone.
  return zonedTimeToUtc(startTime.replace(/\.\d+$/, '').slice(0, 19), timeZone);
}
