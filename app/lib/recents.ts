import { storage } from './storage';

const KEY = 'hausi.recentEvents';
const MAX = 8;

export interface RecentEvent {
  slug: string;
  title: string;
  coverTheme: string;
  titleFont: string;
  date: string;
}

export async function getRecentEvents(): Promise<RecentEvent[]> {
  try {
    const raw = await storage.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as RecentEvent[]) : [];
  } catch {
    return [];
  }
}

export async function recordRecentEvent(event: RecentEvent): Promise<void> {
  try {
    const list = await getRecentEvents();
    const next = [event, ...list.filter((e) => e.slug !== event.slug)].slice(0, MAX);
    await storage.setItemAsync(KEY, JSON.stringify(next));
  } catch {
    // Recents are best-effort.
  }
}
