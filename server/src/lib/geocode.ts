import { COMMON_CITY_BY_KEY } from '../../../app/shared/cities.js';

// Server-side "is this a real city?" check, used to keep made-up city names out
// of the Explore city list. Backed by Open-Meteo's key-free geocoding API and
// memoized (positives AND negatives) so Explore can filter its whole city list
// without hammering the geocoder on every request.

const ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
const TIMEOUT_MS = 4000;

// Lowercased city name -> canonical real name, or null when the geocoder has
// confirmed it isn't a real place. Populated only with definitive answers;
// fail-open passthroughs (geocoder unreachable) are never cached.
const cache = new Map<string, string | null>();

type Lookup =
  | { kind: 'resolved'; canonical: string | null } // geocoder answered definitively
  | { kind: 'error' }; // transient failure — caller should fail open

async function lookup(name: string): Promise<Lookup> {
  const url = `${ENDPOINT}?name=${encodeURIComponent(name)}&count=10&language=en&format=json`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return { kind: 'error' };
    const data = (await res.json()) as { results?: { name?: unknown }[] };
    const results = Array.isArray(data.results) ? data.results : [];
    const key = name.toLowerCase();
    // Require an exact name match (case-insensitive) among the hits — the
    // geocoder also returns loosely-related places, so "New York" must resolve
    // to a result literally named "New York", not to "York".
    const match = results.find(
      (r) => typeof r.name === 'string' && r.name.toLowerCase() === key
    );
    return { kind: 'resolved', canonical: match ? (match.name as string) : null };
  } catch {
    return { kind: 'error' };
  } finally {
    clearTimeout(timer);
  }
}

// Resolve a user-entered city to its canonical real-world name, or null if it
// isn't a real place. On geocoder failure it fails open (returns the name
// as-is) so an outage never empties Explore — the client picker still prevents
// bad cities from being created in the first place.
export async function resolveCity(raw: string): Promise<string | null> {
  const name = raw.trim();
  if (!name) return null;
  const key = name.toLowerCase();

  // Curated allowlist first: instant, and covers naming-convention gaps the
  // geocoder spells differently (e.g. "Washington DC").
  const allowed = COMMON_CITY_BY_KEY.get(key);
  if (allowed) return allowed;

  if (cache.has(key)) return cache.get(key) ?? null;

  const result = await lookup(name);
  if (result.kind === 'error') return name; // fail open, don't cache
  cache.set(key, result.canonical);
  return result.canonical;
}

// Resolve many cities with a bounded number of concurrent geocoder requests,
// so a cold cache with lots of distinct cities can't fire an unbounded burst
// of outbound calls. Allowlist/cache hits resolve instantly without a request.
export async function resolveCities(names: string[]): Promise<(string | null)[]> {
  const CONCURRENCY = 8;
  const out: (string | null)[] = new Array(names.length);
  let next = 0;
  async function worker() {
    while (next < names.length) {
      const i = next++;
      out[i] = await resolveCity(names[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, names.length) }, worker));
  return out;
}
