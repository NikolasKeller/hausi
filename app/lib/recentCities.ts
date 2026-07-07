import { storage } from './storage';

const KEY = 'now.recentCities';
const MAX = 5;

export async function getRecentCities(): Promise<string[]> {
  try {
    const raw = await storage.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function recordRecentCity(city: string): Promise<string[]> {
  const trimmed = city.trim();
  if (!trimmed) return getRecentCities();
  try {
    const list = await getRecentCities();
    const next = [
      trimmed,
      ...list.filter((c) => c.toLowerCase() !== trimmed.toLowerCase()),
    ].slice(0, MAX);
    await storage.setItemAsync(KEY, JSON.stringify(next));
    return next;
  } catch {
    // Recents are best-effort.
    return [trimmed];
  }
}
