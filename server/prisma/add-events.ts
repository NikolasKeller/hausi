import bcrypt from 'bcryptjs';
import { db } from '../src/lib/db.js';
import { makeSlug } from '../src/lib/slug.js';
import { FEATURED_EVENTS } from './featuredEvents.js';

// Additive, idempotent seed of the curated YE Munich events. Unlike seed.ts,
// this NEVER deletes anything — it only creates events that don't already exist
// (matched by slug) and ensures the host org account exists. Safe to run
// against production (and safe to run on every deploy: re-runs are no-ops).
//
// The app is paid-events-only ("buy ticket" model): featured events without a
// real ticket price > 0 are skipped, so free events can't reappear on deploy.

// Same parse rule as scripts/scrape/validate.ts (parsePriceAmount): a
// costPerPerson like "15 EUR" / "From 17 EUR" must contain an amount > 0.
function hasPaidTicket(costPerPerson: string): boolean {
  const m = costPerPerson.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  return m != null && Number(m[1]) > 0;
}

async function main() {
  const email = 'events@ye-munich.com';
  let ye = await db.user.findFirst({ where: { email } });
  if (!ye) {
    const passwordHash = await bcrypt.hash('iykyk123', 10);
    ye = await db.user.create({
      data: {
        name: 'YE Munich',
        email,
        passwordHash,
        avatarEmoji: '🎧',
        city: 'Munich',
        isOrganization: true,
      },
    });
    console.log('add-events: created host org account (YE Munich)');
  }

  let added = 0;
  let skipped = 0;
  let skippedFree = 0;
  for (const e of FEATURED_EVENTS) {
    // Paid-only app: never (re)create featured events without a ticket price.
    if (!hasPaidTicket(e.costPerPerson)) {
      skippedFree += 1;
      continue;
    }
    // Match by title, not slug: makeSlug() appends a random suffix, so it isn't
    // a stable key. Title uniquely identifies each curated featured event.
    const existing = await db.event.findFirst({ where: { title: e.title } });
    if (existing) {
      skipped += 1;
      continue;
    }
    await db.event.create({
      data: {
        slug: makeSlug(e.title),
        title: e.title,
        description: e.description,
        coverTheme: e.coverTheme,
        coverImage: e.coverImage,
        titleFont: e.titleFont,
        effect: e.effect,
        date: e.date,
        location: e.location,
        city: e.city,
        category: e.category,
        isPublic: true,
        costPerPerson: e.costPerPerson,
        dressCode: e.dressCode,
        hostId: ye.id,
      },
    });
    added += 1;
  }

  console.log(
    `add-events: added ${added}, skipped ${skipped} existing, ${skippedFree} free/priceless (no data deleted).`
  );
}

main()
  .catch((e) => {
    console.error('add-events failed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
