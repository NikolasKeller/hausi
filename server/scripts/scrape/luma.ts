import type { CityConfig, ScrapedEvent } from './types.js';
import { classify, fetchJson, htmlToText, sleep } from './util.js';

// lu.ma discover API (key-free, same endpoint the city pages use).
// List: https://api.lu.ma/discover/get-paginated-events?discover_place_api_id=…
// Detail: https://api.lu.ma/url?url=<event-slug> → data.description_mirror.

interface LumaGeo {
  city?: string;
  address?: string;
  country?: string;
  full_address?: string;
  city_state?: string;
}

interface LumaPrice {
  cents?: number | null;
  currency?: string | null;
}

interface LumaListEntry {
  event: {
    api_id: string;
    name: string;
    start_at: string; // UTC ISO
    cover_url?: string;
    url: string; // slug on lu.ma
    location_type?: string;
    geo_address_info?: LumaGeo | null;
  };
  guest_count?: number;
  ticket_count?: number;
  ticket_info?: {
    price?: LumaPrice | null;
    max_price?: LumaPrice | null;
    is_free?: boolean;
  } | null;
}

// "15 EUR" / "From 15 EUR" following the app's costPerPerson convention.
// '' when the event is free or exposes no price (dropped by validation).
function priceLabel(info: LumaListEntry['ticket_info']): string {
  if (!info || info.is_free) return '';
  const cents = info.price?.cents;
  if (!cents || cents <= 0) return '';
  const amount = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  const currency = (info.price?.currency ?? 'eur').toUpperCase();
  const hasRange = !!info.max_price?.cents && info.max_price.cents !== cents;
  return hasRange ? `From ${amount} ${currency}` : `${amount} ${currency}`;
}

interface LumaListResponse {
  entries?: LumaListEntry[];
  has_more?: boolean;
  next_cursor?: string;
}

// City names as lu.ma/Google may spell them (localized) → must match the
// canonical config city so region-wide noise on a city page is dropped.
const CITY_ALIASES: Record<string, string[]> = {
  Munich: ['münchen', 'munchen'],
  Cologne: ['köln', 'koln'],
  Vienna: ['wien'],
  Zurich: ['zürich', 'zuerich'],
  Brussels: ['bruxelles', 'brussel'],
  Lisbon: ['lisboa'],
  Rome: ['roma'],
  Milan: ['milano'],
  Warsaw: ['warszawa'],
  Prague: ['praha'],
  Copenhagen: ['københavn', 'kobenhavn'],
  Athens: ['athina', 'αθήνα'],
};

function cityMatches(config: CityConfig, geoCity: string | undefined): boolean {
  if (!geoCity) return false;
  const got = geoCity.trim().toLowerCase();
  if (got === config.name.toLowerCase()) return true;
  return (CITY_ALIASES[config.name] ?? []).includes(got);
}

// Flatten lu.ma's ProseMirror-style description_mirror doc to plain text.
function mirrorToText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(mirrorToText).join('');
  if (typeof node === 'object') {
    const n = node as { type?: string; text?: string; content?: unknown };
    if (typeof n.text === 'string') return n.text;
    const inner = mirrorToText(n.content ?? '');
    if (n.type === 'paragraph' || n.type === 'heading') return inner + '\n\n';
    if (n.type === 'hard_break') return '\n';
    if (n.type === 'list_item') return '• ' + inner;
    return inner;
  }
  return '';
}

async function fetchDescription(slug: string): Promise<string> {
  const detail = await fetchJson<{ data?: { description_mirror?: unknown } }>(
    `https://api.lu.ma/url?url=${encodeURIComponent(slug)}`
  );
  const mirror = detail?.data?.description_mirror;
  if (!mirror) return '';
  return htmlToText(mirrorToText(mirror)).slice(0, 2500).trim();
}

export async function scrapeLuma(config: CityConfig, maxPages = 4): Promise<ScrapedEvent[]> {
  if (!config.lumaPlaceId) return [];
  const entries: LumaListEntry[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      discover_place_api_id: config.lumaPlaceId,
      pagination_limit: '25',
    });
    if (cursor) params.set('pagination_cursor', cursor);
    const res = await fetchJson<LumaListResponse>(
      `https://api.lu.ma/discover/get-paginated-events?${params}`
    );
    if (!res?.entries?.length) break;
    entries.push(...res.entries);
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
    await sleep(400);
  }

  // Pre-filter before the (per-event) detail requests: offline, in this city,
  // paid (free events never make it into the app), and passing the lifestyle
  // keyword filter on the title alone.
  const candidates = entries.filter((e) => {
    const ev = e.event;
    if (ev.location_type && ev.location_type !== 'offline') return false;
    if (!cityMatches(config, ev.geo_address_info?.city)) return false;
    if (!priceLabel(e.ticket_info)) return false;
    return classify(ev.name, '') != null;
  });

  const out: ScrapedEvent[] = [];
  for (const entry of candidates) {
    const ev = entry.event;
    const description = await fetchDescription(ev.url);
    await sleep(350);
    const geo = ev.geo_address_info ?? {};
    out.push({
      source: 'luma',
      sourceUrl: `https://lu.ma/${ev.url}`,
      title: ev.name.trim(),
      description,
      startAt: new Date(ev.start_at),
      venueName: geo.address ?? '',
      address: geo.full_address ?? geo.city_state ?? '',
      city: config.name,
      imageUrl: ev.cover_url ?? '',
      hype: (entry.guest_count ?? 0) + (entry.ticket_count ?? 0),
      priceLabel: priceLabel(entry.ticket_info),
    });
  }
  return out;
}
