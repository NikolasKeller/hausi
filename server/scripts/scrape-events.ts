import bcrypt from 'bcryptjs';
import { db } from '../src/lib/db.js';
import { makeSlug } from '../src/lib/slug.js';
import { CITIES } from './scrape/cities.js';
import { scrapeLuma } from './scrape/luma.js';
import { scrapeRa } from './scrape/ra.js';
import { scrapeEventbrite } from './scrape/eventbrite.js';
import type { ScrapedEvent } from './scrape/types.js';
import { classify, dedupeKey, isValidEvent, RA_CLASSIFIED, sleep } from './scrape/util.js';

// Scrapes hyped lifestyle/social events (run clubs, coffee meetups, dating
// events, raves, rooftop parties, yoga/pilates, social sports …) for European
// capitals from real public sources — lu.ma, Resident Advisor, Eventbrite —
// and inserts them as public events into the app DB.
//
// Guarantees:
// - NOTHING is invented: every title/date/venue/description/image comes
//   verbatim from the source; the source URL is appended to the description.
// - Idempotent: re-runs skip events that already exist (same title + city +
//   calendar day), so it can run on a schedule and only add new events.
//
// Usage (from server/):
//   DATABASE_URL="file:/…/dev.db" npm run scrape             # all cities
//   DATABASE_URL="file:/…/dev.db" npm run scrape -- Berlin   # one city
//
// The description limit lives in app/shared/types.ts (LIMITS.description=4000).

const MAX_PER_CITY_PER_RUN = 35;
const HORIZON_DAYS = 60;
const DESCRIPTION_LIMIT = 4000;

async function ensureHost() {
  const email = 'scout@hausi.app';
  let host = await db.user.findFirst({ where: { email } });
  if (!host) {
    host = await db.user.create({
      data: {
        name: 'Hausi City Scout',
        email,
        passwordHash: await bcrypt.hash('iykyk123', 10),
        avatarEmoji: '🌍',
        city: 'Berlin',
        isOrganization: true,
      },
    });
    console.log('created host org account (Hausi City Scout)');
  }
  return host;
}

// Existing (title, city, day) keys so re-runs never insert duplicates, even
// when a source re-lists the same event under a fresh URL.
async function loadExistingKeys(): Promise<Set<string>> {
  const rows = await db.event.findMany({ select: { title: true, city: true, date: true } });
  return new Set(rows.map((r) => dedupeKey(r.title, r.city, r.date)));
}

function buildDescription(e: ScrapedEvent): string {
  const parts: string[] = [];
  if (e.description) parts.push(e.description);
  const sourceLabel = { luma: 'lu.ma', ra: 'Resident Advisor', eventbrite: 'Eventbrite', allevents: 'allevents.in' }[e.source];
  parts.push(`—\nSource: ${sourceLabel}\n${e.sourceUrl}`);
  return parts.join('\n\n').slice(0, DESCRIPTION_LIMIT);
}

function buildLocation(e: ScrapedEvent): string {
  // Location column is capped at 200 chars app-side; keep venue + address,
  // but don't repeat the venue when the address already starts with it.
  const addressHasVenue =
    e.venueName && e.address.toLowerCase().includes(e.venueName.toLowerCase());
  const loc = addressHasVenue ? e.address : [e.venueName, e.address].filter(Boolean).join(', ');
  return (loc || e.city).slice(0, 200);
}

async function scrapeCity(cityName?: string) {
  const host = await ensureHost();
  const existing = await loadExistingKeys();
  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86400_000);

  const cities = cityName
    ? CITIES.filter((c) => c.name.toLowerCase() === cityName.toLowerCase())
    : CITIES;
  if (!cities.length) {
    console.error(`unknown city "${cityName}" — known: ${CITIES.map((c) => c.name).join(', ')}`);
    process.exit(1);
  }

  const report: { city: string; added: number; skipped: number; bySource: Record<string, number> }[] = [];

  for (const config of cities) {
    console.log(`\n=== ${config.name} ===`);
    const collected: ScrapedEvent[] = [];
    try {
      const [luma, ra, eb] = [
        await scrapeLuma(config).catch((e) => (console.warn('  luma failed:', e), [] as ScrapedEvent[])),
        await scrapeRa(config).catch((e) => (console.warn('  ra failed:', e), [] as ScrapedEvent[])),
        await scrapeEventbrite(config).catch((e) => (console.warn('  eventbrite failed:', e), [] as ScrapedEvent[])),
      ];
      console.log(`  scraped: luma=${luma.length} ra=${ra.length} eventbrite=${eb.length}`);
      collected.push(...luma, ...ra, ...eb);
    } catch (e) {
      console.warn(`  scrape error for ${config.name}:`, e);
    }

    // Rank hyped-first within each source group, then interleave sources so a
    // city page isn't 30 techno events followed by nothing else.
    const valid = collected.filter((e) => isValidEvent(e, now, horizon));
    const bySource = new Map<string, ScrapedEvent[]>();
    for (const e of valid) {
      const list = bySource.get(e.source) ?? [];
      list.push(e);
      bySource.set(e.source, list);
    }
    for (const list of bySource.values()) list.sort((a, b) => b.hype - a.hype);
    const interleaved: ScrapedEvent[] = [];
    const lists = [...bySource.values()];
    for (let i = 0; interleaved.length < valid.length; i++) {
      let pushed = false;
      for (const list of lists) {
        if (i < list.length) {
          interleaved.push(list[i]);
          pushed = true;
        }
      }
      if (!pushed) break;
    }

    let added = 0;
    let skipped = 0;
    const sourceCounts: Record<string, number> = {};
    for (const e of interleaved) {
      if (added >= MAX_PER_CITY_PER_RUN) break;
      const key = dedupeKey(e.title, e.city, e.startAt);
      if (existing.has(key)) {
        skipped++;
        continue;
      }
      const cls = e.source === 'ra' ? RA_CLASSIFIED : classify(e.title, e.description);
      if (!cls) {
        skipped++;
        continue;
      }
      await db.event.create({
        data: {
          slug: makeSlug(e.title),
          title: e.title.slice(0, 120),
          description: buildDescription(e),
          coverTheme: cls.coverTheme,
          coverImage: e.imageUrl.startsWith('http') ? e.imageUrl : '',
          date: e.startAt,
          location: buildLocation(e),
          city: e.city,
          category: cls.category,
          isPublic: true,
          hostId: host.id,
        },
      });
      existing.add(key);
      added++;
      sourceCounts[e.source] = (sourceCounts[e.source] ?? 0) + 1;
    }
    console.log(`  inserted ${added}, skipped ${skipped} (dupes/off-topic)  ${JSON.stringify(sourceCounts)}`);
    report.push({ city: config.name, added, skipped, bySource: sourceCounts });
    await sleep(1000);
  }

  console.log('\n=== SUMMARY ===');
  for (const r of report) {
    const gap = r.added < 20 ? '  ⚠ <20 new this run' : '';
    console.log(`${r.city.padEnd(12)} +${String(r.added).padStart(3)}  ${JSON.stringify(r.bySource)}${gap}`);
  }
  const total = report.reduce((s, r) => s + r.added, 0);
  console.log(`total inserted: ${total}`);
}

scrapeCity(process.argv[2])
  .catch((e) => {
    console.error('scrape-events failed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
