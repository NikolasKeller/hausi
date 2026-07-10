import type { ScrapedEvent } from './types.js';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Polite fetch: browser UA, timeout, and a couple of retries with backoff for
// transient failures (429/5xx/network). Returns null when the resource stays
// unreachable so a flaky source degrades gracefully instead of killing the run.
export async function politeFetch(
  url: string,
  init: RequestInit = {},
  { retries = 2, timeoutMs = 20000 }: { retries?: number; timeoutMs?: number } = {}
): Promise<Response | null> {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: ctrl.signal,
        headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) },
      });
      if (res.ok) return res;
      if (attempt >= retries || (res.status < 500 && res.status !== 429)) {
        if (res.status !== 404) console.warn(`  fetch ${res.status}: ${url}`);
        return null;
      }
      // 429s (Eventbrite throttles bursts hard) need a much longer cool-down
      // than transient 5xx blips.
      await sleep(
        res.status === 429
          ? 15000 * (attempt + 1) + Math.random() * 5000
          : 1500 * (attempt + 1) + Math.random() * 500
      );
      continue;
    } catch {
      if (attempt >= retries) {
        console.warn(`  fetch failed: ${url}`);
        return null;
      }
    } finally {
      clearTimeout(timer);
    }
    await sleep(1500 * (attempt + 1) + Math.random() * 500);
  }
}

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T | null> {
  const res = await politeFetch(url, init);
  if (!res) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchText(url: string): Promise<string | null> {
  const res = await politeFetch(url);
  if (!res) return null;
  try {
    return await res.text();
  } catch {
    return null;
  }
}

// Interpret a wall-clock time ("2026-07-11T10:00") in an IANA timezone and
// return the corresponding UTC Date. Node's Date can't parse zoned wall times
// directly, so probe with Intl: format a candidate UTC instant in the zone and
// correct by the difference (two passes handle DST edges).
export function zonedTimeToUtc(wallTime: string, timeZone: string): Date {
  const naive = new Date(`${wallTime}Z`);
  let utc = naive;
  for (let i = 0; i < 2; i++) {
    const seen = wallClockInZone(utc, timeZone);
    utc = new Date(utc.getTime() + (naive.getTime() - seen.getTime()));
  }
  return utc;
}

function wallClockInZone(instant: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);
}

// Strip HTML tags / entities from source descriptions into plain text.
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Lifestyle filter + category mapping
// ---------------------------------------------------------------------------

// Keyword groups describing the "hyped lifestyle/social" scene the app wants:
// run clubs, coffee meetups, dating events, raves, rooftop parties, comedy,
// dance socials, tastings, social sports … Each group maps to an app category
// AND a `bucket` — a finer event-type label the inserter uses to cap and
// interleave, so no single format (e.g. speed dating) dominates a city feed.
const KEYWORD_CATEGORIES: { bucket: string; category: string; theme: string; words: RegExp }[] = [
  { bucket: 'active',    category: 'sports', theme: 'forest',   words: /\b(run(ning)? ?club|run club|social run|city runners?|morning run|sunset run|5k|10k|parkrun|trail run)\b/i },
  { bucket: 'wellness',  category: 'sports', theme: 'matcha',   words: /\b(yoga|pilates|breathwork|meditation|wellness|sound ?bath|cold ?plunge|ice ?bath|sauna|hyrox|bootcamp|workout|fitness|calisthenics)\b/i },
  { bucket: 'active',    category: 'sports', theme: 'ocean',    words: /\b(spikeball|roundnet|padel|volleyball|beach ?volley|basketball|pickleball|bouldern?|bouldering|climbing|skate|surfskate|hike|hiking|bike ride|cycling|swim)\b/i },
  { bucket: 'comedy',    category: 'arts',   theme: 'gold',     words: /\b(comedy|stand[- ]?up|improv|roast battle|open mic night)\b/i },
  { bucket: 'dance',     category: 'music',  theme: 'disco',    words: /\b(salsa|bachata|kizomba|zouk|swing dance|lindy hop|tango|dance (class|social|party|night)|ecstatic dance)\b/i },
  { bucket: 'food',      category: 'food',   theme: 'matcha',   words: /\b(matcha|coffee ?(meetup|rave|club|social|morning)|café hopping|cafe crawl|brunch(?! business)|supper ?club|dinner (club|party)|(wine|gin|whisk(e)?y|beer|cheese|chocolate) ?tasting|tasting|brew|barista|picnic|pop[- ]?up)\b/i },
  { bucket: 'dating',    category: 'community', theme: 'candy', words: /\b(dating|singles?|speed ?dating|blind date|mixer|match ?making|matchmaking|crush|first dates?|hinge|bumble|tinder)\b/i },
  { bucket: 'games',     category: 'community', theme: 'peach', words: /\b(karaoke|pub ?quiz|quiz night|trivia (night|show)|bingo|game show)\b/i },
  { bucket: 'social',    category: 'community', theme: 'peach', words: /\b(meetup|social club|networking|new in town|make friends|community|language exchange|expat|erasmus|international people|board ?games?|book ?club|walking club|creative club)\b/i },
  { bucket: 'nightlife', category: 'music',  theme: 'midnight', words: /\b(techno|rave|club ?night|house music|dj set|open air|day ?party|rooftop|boat party|afterparty|warehouse|disco|hard ?groove|melodic|trance|drum ?& ?bass|dnb|hip ?hop night|r&b night)\b/i },
  { bucket: 'arts',      category: 'arts',   theme: 'lavender', words: /\b(life drawing|paint (&|and) sip|sip (&|and) paint|pottery|ceramics|art class|craft|figure drawing|gallery|vernissage|open mic|poetry|journaling)\b/i },
];

// Words that mark clearly non-lifestyle events (b2b conferences, webinars…),
// applied after the positive match so "Founders Running Club" still passes.
const EXCLUDE = /\b(webinar|online course|zoom|conference|summit|bootcamp for|b2b|SEO|real estate|crypto trading|forex|MLM|insurance|tax)\b/i;

export interface Classified {
  category: string;
  coverTheme: string;
  // Event-type bucket (finer than category) used by the inserter to cap and
  // interleave formats so one type never dominates a city feed.
  bucket: string;
}

// Decide whether an event belongs in the lifestyle feed and classify it.
// Returns null for events outside the scene (they are skipped, not inserted).
// The TITLE is matched first on its own: a "Stand-Up Comedy Night" whose
// description mentions "singles welcome" must land in the comedy bucket, not
// dating — only when the title alone matches nothing does the description
// join the text.
export function classify(title: string, description: string): Classified | null {
  for (const text of [title, `${title}\n${description.slice(0, 600)}`]) {
    for (const k of KEYWORD_CATEGORIES) {
      if (k.words.test(text)) {
        if (EXCLUDE.test(title)) return null;
        return { category: k.category, coverTheme: k.theme, bucket: k.bucket };
      }
    }
  }
  return null;
}

// RA events are club/techno by construction — no keyword filter needed.
export const RA_CLASSIFIED: Classified = { category: 'music', coverTheme: 'midnight', bucket: 'nightlife' };

export function isValidEvent(e: ScrapedEvent, now: Date, horizon: Date): boolean {
  return (
    e.title.trim().length > 2 &&
    e.startAt.getTime() > now.getTime() &&
    e.startAt.getTime() < horizon.getTime() &&
    e.sourceUrl.startsWith('http')
  );
}
