import bcrypt from 'bcryptjs';
import { db } from '../src/lib/db.js';
import { makeSlug } from '../src/lib/slug.js';
import { CITIES } from './scrape/cities.js';
import { CLUB_SHOPS } from './scrape/clubs.js';
import { scrapeTicketioShop } from './scrape/ticketio.js';
import { translateToEnglish } from './scrape/translate.js';
import type { ScrapedEvent } from './scrape/types.js';
import { sleep } from './scrape/util.js';
import {
  dedupeKey,
  validateEvent,
  ValidationStats,
  type EventCandidate,
} from './scrape/validate.js';

// Scrapes real nightlife/club events from the OWN ticket shops of a curated set
// of clubs/promoters (ticket.io storefronts) and inserts them as public events.
//
// Why club shops instead of aggregators: the app's buy-ticket button must open
// the organiser's/club's own ticket page — never lu.ma / Eventbrite / Resident
// Advisor. ticket.io shops are the club's own branded storefront, so the stored
// ticketUrl always stays on the club's domain.
//
// Guarantees:
// - NOTHING is invented: title, date, venue, price, image and buy URL all come
//   verbatim from the club's ticket.io JSON-LD. Missing description → stored ''.
// - The source/ticket URL is NEVER written into the visible description; it goes
//   into the dedicated Event.ticketUrl column (the buy button reads it).
// - Descriptions are stored in English: non-English text is translated
//   (best-effort, key-less); on translation failure the original is kept.
// - Paid events only: costPerPerson must be a real price > 0.
// - Every event passes the validation checklist (scrape/validate.ts) right
//   before insert, or it's dropped with the reason logged.
// - Idempotent: re-runs skip (title + city + calendar day) already present.
//
// Usage (from server/):
//   DATABASE_URL="file:/…/dev.db" npm run scrape                    # all clubs
//   DATABASE_URL="file:/…/dev.db" npm run scrape -- Munich          # one city
//   DATABASE_URL="file:/…/dev.db" npm run scrape -- --validate-only # audit only

const HORIZON_DAYS = 60;
const DESCRIPTION_LIMIT = 4000;
// Club nights are music/nightlife by construction.
const CATEGORY = 'music';
const COVER_THEME = 'midnight';

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

async function loadExistingKeys(): Promise<Set<string>> {
  const rows = await db.event.findMany({ select: { title: true, city: true, date: true } });
  return new Set(rows.map((r) => dedupeKey(r.title, r.city, r.date)));
}

function buildLocation(e: ScrapedEvent): string {
  const addressHasVenue =
    e.venueName && e.address.toLowerCase().includes(e.venueName.toLowerCase());
  const loc = addressHasVenue ? e.address : [e.venueName, e.address].filter(Boolean).join(', ');
  return (loc || e.city).slice(0, 200);
}

async function run(cityFilter?: string) {
  const host = await ensureHost();
  const existing = await loadExistingKeys();
  const timeZoneByCity = new Map(CITIES.map((c) => [c.name, c.timeZone]));
  const stats = new ValidationStats();

  // 1) Scrape every curated club shop.
  const collected: ScrapedEvent[] = [];
  for (const shop of CLUB_SHOPS) {
    let events: ScrapedEvent[] = [];
    try {
      events = await scrapeTicketioShop(shop);
    } catch (e) {
      console.warn(`  ${shop.name}: scrape failed:`, (e as Error).message);
    }
    if (cityFilter) {
      events = events.filter((ev) => ev.city.toLowerCase() === cityFilter.toLowerCase());
    }
    console.log(`${shop.name.padEnd(26)} (${shop.slug}.ticket.io): ${events.length} events`);
    collected.push(...events);
  }

  // 2) Translate + validate + insert.
  let translatedCount = 0;
  const addedByCity: Record<string, number> = {};
  const addedByClub: Record<string, number> = {};
  let added = 0;
  let skipped = 0;

  for (const e of collected) {
    // English descriptions only. Empty stays empty (no fabrication).
    let description = '';
    if (e.description) {
      const t = await translateToEnglish(e.description);
      await sleep(200);
      if (t.translated) translatedCount++;
      description = t.text.slice(0, DESCRIPTION_LIMIT);
    }

    const candidate: EventCandidate = {
      title: e.title.slice(0, 120),
      description,
      date: e.startAt,
      location: buildLocation(e),
      city: e.city,
      category: CATEGORY,
      coverImage: e.imageUrl.startsWith('http') ? e.imageUrl : '',
      costPerPerson: e.priceLabel,
      ticketUrl: e.ticketUrl,
    };
    const result = validateEvent(candidate, {
      horizonDays: HORIZON_DAYS,
      timeZone: timeZoneByCity.get(e.city),
      existingKeys: existing,
    });
    stats.record(result);
    if (!result.ok) {
      skipped++;
      if (!(result.failures.length === 1 && result.failures[0] === 'dedupe')) {
        console.log(`  ✗ dropped "${candidate.title.slice(0, 55)}" (${e.city}): ${result.failures.join(', ')}`);
      }
      continue;
    }
    await db.event.create({
      data: {
        slug: makeSlug(candidate.title),
        title: candidate.title,
        description: candidate.description,
        coverTheme: COVER_THEME,
        coverImage: candidate.coverImage,
        date: candidate.date,
        location: candidate.location,
        city: candidate.city,
        category: candidate.category,
        costPerPerson: candidate.costPerPerson,
        ticketUrl: candidate.ticketUrl,
        isPublic: true,
        hostId: host.id,
      },
    });
    existing.add(dedupeKey(candidate.title, candidate.city, candidate.date));
    added++;
    addedByCity[e.city] = (addedByCity[e.city] ?? 0) + 1;
    addedByClub[e.venueName || e.city] = (addedByClub[e.venueName || e.city] ?? 0) + 1;
  }

  console.log('\n=== SUMMARY ===');
  console.log(`scraped candidates: ${collected.length}`);
  console.log(`inserted: ${added}, skipped: ${skipped}`);
  console.log(`descriptions translated to English: ${translatedCount}`);
  console.log('per city:', JSON.stringify(addedByCity, null, 1));
  console.log(stats.summary());
}

// Audit mode: run the checklist over existing DB events (read-only).
async function validateOnly() {
  const events = await db.event.findMany({
    include: { host: { select: { name: true, email: true } } },
    orderBy: [{ city: 'asc' }, { date: 'asc' }],
  });
  console.log(`validate-only: checking ${events.length} existing events (read-only)\n`);

  const timeZoneByCity = new Map(CITIES.map((c) => [c.name, c.timeZone]));
  const statsByHost = new Map<string, ValidationStats>();
  const examples: string[] = [];

  for (const e of events) {
    const result = validateEvent(
      {
        title: e.title,
        description: e.description,
        date: e.date,
        location: e.location,
        city: e.city,
        category: e.category,
        coverImage: e.coverImage,
        costPerPerson: e.costPerPerson,
        ticketUrl: e.ticketUrl,
      },
      { timeZone: timeZoneByCity.get(e.city) }
    );
    const hostLabel = e.host.name || e.host.email || e.hostId;
    let stats = statsByHost.get(hostLabel);
    if (!stats) statsByHost.set(hostLabel, (stats = new ValidationStats()));
    stats.record(result);
    if (!result.ok && examples.length < 15) {
      examples.push(`  ✗ [${hostLabel}] "${e.title.slice(0, 55)}" (${e.city}): ${result.failures.join(', ')}`);
    }
  }

  for (const [host, stats] of statsByHost) {
    console.log(`--- host: ${host} ---`);
    console.log(stats.summary());
    console.log();
  }
  console.log('sample failures:');
  for (const line of examples) console.log(line);
}

const arg = process.argv[2];
(arg === '--validate-only' ? validateOnly() : run(arg))
  .catch((e) => {
    console.error('scrape-events failed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
