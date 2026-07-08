import bcrypt from 'bcryptjs';
import { db } from '../src/lib/db.js';
import { makeSlug } from '../src/lib/slug.js';
import { CITIES } from './scrape/cities.js';
import { scrapeRa } from './scrape/ra.js';
import { scrapeEventbrite } from './scrape/eventbrite.js';
import { translateToEnglish } from './scrape/translate.js';
import type { ScrapedEvent } from './scrape/types.js';
import { classify, isValidEvent, RA_CLASSIFIED, sleep } from './scrape/util.js';
import {
  dedupeKey,
  validateEvent,
  ValidationStats,
  type EventCandidate,
} from './scrape/validate.js';

// Scrapes hyped lifestyle/social/nightlife events (run clubs, raves, rooftop
// parties, yoga, dating, coffee socials …) for European capitals from real
// public sources — Resident Advisor and Eventbrite — and inserts them as
// public events into the app DB.
//
// Sourcing rule (user correction, 2026-07-08):
// - Keep the BROAD set from RA + Eventbrite (both are real PAID-ticket
//   checkouts, acceptable as buy targets).
// - lu.ma is dropped entirely: its links are free "register" signups, not
//   ticket purchases — exactly what we don't want.
// - Paid only: every event needs a real ticket price > 0 (free / RSVP-only /
//   non-ticket signup events fail this and are dropped).
//
// Guarantees:
// - NOTHING is invented: title/date/venue/price/image/ticket URL all come
//   verbatim from the source.
// - The ticket link is stored in Event.ticketUrl (the buy button reads it), and
//   is NEVER written into the visible description.
// - Descriptions are stored in English: non-English text is translated
//   best-effort (key-less); the original is kept on failure. Empty stays empty.
// - Every event passes the validation checklist before insert or is dropped
//   with the reason logged. Idempotent: re-runs skip existing (title+city+day).
//
// Usage (from server/):
//   DATABASE_URL="file:/…/dev.db" npm run scrape                    # all cities
//   DATABASE_URL="file:/…/dev.db" npm run scrape -- Berlin          # one city
//   DATABASE_URL="file:/…/dev.db" npm run scrape -- --validate-only # audit only
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

// English description, no source/URL line (the ticket link lives in ticketUrl).
// Non-English text is translated best-effort; the original is kept on failure,
// and an empty description stays empty (never fabricated).
async function buildDescription(
  e: ScrapedEvent
): Promise<{ text: string; translated: boolean }> {
  const raw = e.description.trim();
  if (!raw) return { text: '', translated: false };
  const t = await translateToEnglish(raw);
  return { text: t.text.slice(0, DESCRIPTION_LIMIT), translated: t.translated };
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
  const stats = new ValidationStats();
  let translatedCount = 0;

  for (const config of cities) {
    console.log(`\n=== ${config.name} ===`);
    const collected: ScrapedEvent[] = [];
    try {
      // lu.ma is intentionally NOT scraped: its links are free signups, not
      // ticket purchases. RA + Eventbrite are real paid-ticket checkouts.
      const [ra, eb] = [
        await scrapeRa(config).catch((e) => (console.warn('  ra failed:', e), [] as ScrapedEvent[])),
        await scrapeEventbrite(config).catch((e) => (console.warn('  eventbrite failed:', e), [] as ScrapedEvent[])),
      ];
      console.log(`  scraped: ra=${ra.length} eventbrite=${eb.length}`);
      collected.push(...ra, ...eb);
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
      const cls = e.source === 'ra' ? RA_CLASSIFIED : classify(e.title, e.description);
      if (!cls) {
        skipped++;
        continue;
      }
      // Early dedupe short-circuit BEFORE translating: on idempotent re-runs
      // most candidates already exist, and translation hits a rate-limited API
      // — don't spend that quota (or risk exhausting it before genuinely new
      // events) on rows that will only fail the dedupe check anyway.
      const title = e.title.slice(0, 120);
      if (existing.has(dedupeKey(title, e.city, e.startAt))) {
        skipped++;
        continue;
      }
      // Final checklist, evaluated on the exact row that would be inserted.
      const desc = await buildDescription(e);
      if (desc.translated) translatedCount++;
      const candidate: EventCandidate = {
        title,
        description: desc.text,
        date: e.startAt,
        location: buildLocation(e),
        city: e.city,
        category: cls.category,
        coverImage: e.imageUrl.startsWith('http') ? e.imageUrl : '',
        costPerPerson: e.priceLabel,
        ticketUrl: e.ticketUrl,
      };
      const result = validateEvent(candidate, {
        horizonDays: HORIZON_DAYS,
        timeZone: config.timeZone,
        existingKeys: existing,
      });
      stats.record(result);
      if (!result.ok) {
        skipped++;
        // Dupes are routine on re-runs; only spell out real quality failures.
        if (!(result.failures.length === 1 && result.failures[0] === 'dedupe')) {
          console.log(`  ✗ dropped "${candidate.title.slice(0, 60)}": ${result.failures.join(', ')}`);
        }
        continue;
      }
      await db.event.create({
        data: {
          slug: makeSlug(candidate.title),
          title: candidate.title,
          description: candidate.description,
          coverTheme: cls.coverTheme,
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
      sourceCounts[e.source] = (sourceCounts[e.source] ?? 0) + 1;
    }
    console.log(`  inserted ${added}, skipped ${skipped} (validation/dupes/off-topic)  ${JSON.stringify(sourceCounts)}`);
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
  console.log(`descriptions translated to English: ${translatedCount}`);
  console.log(stats.summary());
}

// Audit mode: run the checklist over the events already in the DB and report;
// never deletes or modifies anything. Only the scraper's own upcoming events
// are meaningfully covered by all checks, so the report separates the scout
// host from other hosts (hand-made / seeded events follow looser rules).
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
      // No existingKeys: the event IS in the DB — dedupe is meaningless here.
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
(arg === '--validate-only' ? validateOnly() : scrapeCity(arg))
  .catch((e) => {
    console.error('scrape-events failed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
