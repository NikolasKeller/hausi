import type { ScrapedEvent } from './types.js';
import { fetchText, sleep } from './util.js';
import { localityToCity, type ClubShop } from './clubs.js';

// Generic parser for a ticket.io shop page. ticket.io embeds one schema.org
// MusicEvent JSON-LD block per upcoming event, carrying name, image, start/end
// (with timezone offset — no manual conversion needed), location (venue +
// address), an offers object with price/currency and — crucially — the buy URL
// on the club's own ticket.io subdomain. Nothing is invented: an event is only
// emitted when it has a real title, a future-parseable start, a positive price
// and a buy URL.

interface LdOffer {
  price?: number | string | null;
  priceCurrency?: string | null;
  url?: string | null;
}
interface LdEvent {
  '@type'?: string;
  name?: string;
  image?: string | string[];
  startDate?: string;
  description?: string;
  url?: string;
  location?: {
    name?: string;
    address?: {
      streetAddress?: string | null;
      postalCode?: string | null;
      addressLocality?: string | null;
      addressCountry?: string | null;
    };
  };
  offers?: LdOffer | LdOffer[];
}

function extractLdEvents(html: string): LdEvent[] {
  const out: LdEvent[] = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const it of items) {
      if (it && typeof it === 'object' && /Event$/.test(String((it as LdEvent)['@type']))) {
        out.push(it as LdEvent);
      }
    }
  }
  return out;
}

function firstOffer(offers: LdEvent['offers']): LdOffer | null {
  if (!offers) return null;
  return Array.isArray(offers) ? offers[0] ?? null : offers;
}

// "15 EUR" / "From 15 EUR" — always the cheapest tier the shop exposes for the
// event (ticket.io's offers.price is the entry price). '' when not > 0.
function priceLabel(offer: LdOffer | null): string {
  if (!offer) return '';
  const amount = typeof offer.price === 'string' ? Number(offer.price) : offer.price;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return '';
  const currency = (offer.priceCurrency ?? 'EUR').toUpperCase();
  const label = amount.toFixed(Number.isInteger(amount) ? 0 : 2);
  return `${label} ${currency}`;
}

function buildAddress(loc: LdEvent['location']): { venueName: string; address: string } {
  const venueName = loc?.name?.trim() ?? '';
  const a = loc?.address ?? {};
  const parts = [a.streetAddress, [a.postalCode, a.addressLocality].filter(Boolean).join(' ')]
    .map((p) => (p ?? '').trim())
    .filter(Boolean);
  return { venueName, address: parts.join(', ') };
}

export async function scrapeTicketioShop(shop: ClubShop): Promise<ScrapedEvent[]> {
  const html = await fetchText(`https://${shop.slug}.ticket.io/?lang=en`);
  await sleep(500);
  if (!html) return [];

  const out: ScrapedEvent[] = [];
  for (const ev of extractLdEvents(html)) {
    if (!ev.name || !ev.startDate) continue;
    const startAt = new Date(ev.startDate);
    if (Number.isNaN(startAt.getTime())) continue;

    const city = localityToCity(ev.location?.address?.addressLocality);
    if (!city) continue; // not one of our target cities → skip

    const offer = firstOffer(ev.offers);
    const price = priceLabel(offer);
    if (!price) continue; // free / no priced ticket → skip (paid events only)

    const ticketUrl = (offer?.url ?? ev.url ?? '').trim();
    if (!/^https?:\/\//.test(ticketUrl)) continue;

    const image = Array.isArray(ev.image) ? ev.image[0] : ev.image;
    const { venueName, address } = buildAddress(ev.location);
    // ticket.io often stores "N/A" or empty descriptions — keep '' rather than
    // storing a placeholder; never fabricate copy.
    const rawDesc = (ev.description ?? '').trim();
    const description = /^n\/?a$/i.test(rawDesc) ? '' : rawDesc;

    out.push({
      source: 'ticketio',
      sourceUrl: ticketUrl,
      title: ev.name.trim(),
      description,
      startAt,
      venueName,
      address,
      city,
      imageUrl: typeof image === 'string' ? image : '',
      hype: 0,
      priceLabel: price,
      ticketUrl,
    });
  }
  return out;
}
