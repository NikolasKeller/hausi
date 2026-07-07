import { storage } from './storage';

const KEY = 'now.recentEvents';
const MAX = 8;

export interface RecentEvent {
  slug: string;
  title: string;
  coverTheme: string;
  coverImage: string;
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

export async function removeRecentEvent(slug: string): Promise<void> {
  try {
    const list = await getRecentEvents();
    await storage.setItemAsync(KEY, JSON.stringify(list.filter((e) => e.slug !== slug)));
  } catch {
    // Best-effort.
  }
}

// Drop cached recents whose event no longer exists on the server (i.e. it was
// deleted). `existingSlugs` is the set the server confirms still exists.
// Returns the pruned list so callers can render it without a re-read.
export async function reconcileRecents(existingSlugs: string[]): Promise<RecentEvent[]> {
  const alive = new Set(existingSlugs);
  const list = await getRecentEvents();
  const next = list.filter((e) => alive.has(e.slug));
  if (next.length !== list.length) {
    try {
      await storage.setItemAsync(KEY, JSON.stringify(next));
    } catch {
      // Best-effort.
    }
  }
  return next;
}
