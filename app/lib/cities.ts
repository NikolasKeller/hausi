// Common cities offered in search suggestions. Free-text entry is always
// allowed on top of these — this list is convenience, not a constraint.
export const COMMON_CITIES = [
  'Amsterdam',
  'Athens',
  'Atlanta',
  'Austin',
  'Bangkok',
  'Barcelona',
  'Beijing',
  'Berlin',
  'Bogotá',
  'Boston',
  'Brussels',
  'Budapest',
  'Buenos Aires',
  'Cairo',
  'Cape Town',
  'Chicago',
  'Cologne',
  'Copenhagen',
  'Dallas',
  'Delhi',
  'Denver',
  'Detroit',
  'Dubai',
  'Dublin',
  'Frankfurt',
  'Geneva',
  'Hamburg',
  'Helsinki',
  'Hong Kong',
  'Houston',
  'Istanbul',
  'Jakarta',
  'Johannesburg',
  'Kyoto',
  'Lagos',
  'Las Vegas',
  'Lisbon',
  'London',
  'Los Angeles',
  'Madrid',
  'Manila',
  'Melbourne',
  'Mexico City',
  'Miami',
  'Milan',
  'Minneapolis',
  'Montreal',
  'Moscow',
  'Mumbai',
  'Munich',
  'Nairobi',
  'Nashville',
  'New Orleans',
  'New York',
  'Osaka',
  'Oslo',
  'Paris',
  'Philadelphia',
  'Phoenix',
  'Portland',
  'Prague',
  'Rio de Janeiro',
  'Rome',
  'San Diego',
  'San Francisco',
  'Santiago',
  'São Paulo',
  'Seattle',
  'Seoul',
  'Shanghai',
  'Singapore',
  'Stockholm',
  'Sydney',
  'Taipei',
  'Tel Aviv',
  'Tokyo',
  'Toronto',
  'Vancouver',
  'Vienna',
  'Warsaw',
  'Washington DC',
  'Zurich',
] as const;

// Merge server-known cities (those that actually have events) with the
// common list, deduped, and filter by a search query.
export function citySuggestions(known: string[], query: string): string[] {
  const seen = new Set<string>();
  const all: string[] = [];
  for (const c of [...known, ...COMMON_CITIES]) {
    const key = c.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      all.push(c);
    }
  }
  const q = query.trim().toLowerCase();
  const filtered = q ? all.filter((c) => c.toLowerCase().includes(q)) : all;
  return filtered.sort((a, b) => a.localeCompare(b)).slice(0, 30);
}
