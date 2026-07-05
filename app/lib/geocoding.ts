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
