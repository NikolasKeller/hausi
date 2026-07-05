import { LIMITS } from '../shared/types';

// Real-city lookup used by the event-creation City picker and the Explore
// city search. Backed by Open-Meteo's geocoding API — key-free, CORS-enabled
// (works from web and native alike), and returns only places that actually
// exist on the map, so made-up city names ("San Brancisco") never make it in.
const ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';

export interface CityResult {
  // Canonical city name to store/display, e.g. "San Francisco".
  name: string;
  // Human-readable context shown beneath the name, e.g. "California, United
  // States" — disambiguates same-named cities. null when there's nothing to add.
  region: string | null;
}

interface GeocodeHit {
  name?: unknown;
  admin1?: unknown;
  country?: unknown;
}

// Search real cities matching a partial name. Returns [] for queries under two
// characters (too broad to be useful). Throws on network/HTTP failure so the
// caller can decide how to surface it.
export async function searchCities(query: string, signal?: AbortSignal): Promise<CityResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${ENDPOINT}?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = (await res.json()) as { results?: GeocodeHit[] };
  const results = Array.isArray(data.results) ? data.results : [];

  const seen = new Set<string>();
  const out: CityResult[] = [];
  for (const r of results) {
    if (typeof r.name !== 'string') continue;
    const region =
      [r.admin1, r.country]
        .filter((p): p is string => typeof p === 'string' && Boolean(p) && p !== r.name)
        .join(', ') || null;
    // Collapse duplicates that share a name AND region (e.g. two "San Francisco"
    // entries in the same state); keep same-named cities in different regions.
    const key = `${r.name}|${region ?? ''}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: r.name, region });
  }
  return out;
}

// ── Full-address autocomplete ────────────────────────────────────────────────
// Open-Meteo only knows city/place names, so street-level search is backed by
// Photon (photon.komoot.io) — Komoot's key-free, CORS-enabled, search-as-you-
// type geocoder over OpenStreetMap. Used by the event Location picker.
const ADDRESS_ENDPOINT = 'https://photon.komoot.io/api/';

export interface AddressResult {
  id: string;
  // Primary line, e.g. "2940 Fillmore Street" or "Mission Dolores Park".
  title: string;
  // Secondary context line, e.g. "94123, San Francisco, California".
  subtitle: string | null;
  // Full address string stored on the event's location field.
  location: string;
  // City derived from the place, used for Explore grouping/filtering.
  city: string | null;
}

// Photon marks these osm_values as a place whose own name IS the city (for
// city-level hits, its `city` property is empty and `name` holds the city).
const PLACE_LEVELS = new Set([
  'city',
  'town',
  'village',
  'hamlet',
  'municipality',
  'suburb',
  'borough',
  'quarter',
  'locality',
]);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

// Search real-world addresses and places matching a partial query. Returns []
// for queries under three characters. Throws on network/HTTP failure.
export async function searchAddresses(query: string, signal?: AbortSignal): Promise<AddressResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${ADDRESS_ENDPOINT}?q=${encodeURIComponent(q)}&limit=6&lang=en`;
  const res = await fetch(url, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Address lookup failed (${res.status})`);
  const data = (await res.json()) as {
    features?: { properties?: Record<string, unknown> }[];
  };
  const features = Array.isArray(data.features) ? data.features : [];

  const seen = new Set<string>();
  const out: AddressResult[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const houseStreet = [str(p.housenumber), str(p.street)].filter(Boolean).join(' ');
    const name = str(p.name);
    const title = name || houseStreet || str(p.city) || str(p.county) || str(p.state);
    if (!title) continue;

    const isPlace = str(p.osm_key) === 'place' && PLACE_LEVELS.has(str(p.osm_value) ?? '');
    // Derive the city ONLY from a real city/place — never a county or state,
    // which would masquerade as a city and pollute Explore's grouping.
    const city = str(p.city) || (isPlace ? name : null) || null;

    // Build the muted context line in natural reading order (street, district,
    // city, state, postcode, country), skipping anything already in the title.
    const district = str(p.district);
    const cityLabel = str(p.city);
    const state = str(p.state);
    const postcode = str(p.postcode);
    const country = str(p.country);
    const parts: string[] = [];
    if (houseStreet && houseStreet !== title) parts.push(houseStreet);
    if (district && district !== title) parts.push(district);
    if (cityLabel && cityLabel !== title && cityLabel !== district) parts.push(cityLabel);
    if (state && state !== title && state !== cityLabel) parts.push(state);
    if (postcode) parts.push(postcode);
    if (country && country !== 'United States' && country !== title) parts.push(country);
    const subtitle = parts.join(', ') || null;

    // Keep the stored address within the server's location cap; degrade to a
    // compact form and hard-slice so a long pick can never reject the submit.
    const full = subtitle ? `${title}, ${subtitle}` : title;
    const location =
      full.length <= LIMITS.location
        ? full
        : [title, cityLabel, state].filter(Boolean).join(', ').slice(0, LIMITS.location);
    const key = location.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const osm = `${str(p.osm_type) ?? ''}${typeof p.osm_id === 'number' ? p.osm_id : ''}`;
    out.push({ id: osm || key, title, subtitle, location, city });
  }
  return out;
}
