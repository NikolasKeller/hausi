import { db } from '../src/lib/db.js';
import { makeSlug } from '../src/lib/slug.js';

// Additive, idempotent seed of the curated Social-Run events (from a running
// club portal). Mirrors add-events.ts: NEVER deletes anything — it only
// creates events that don't already exist (matched by title) and ensures the
// host org account exists. Safe to re-run (re-runs are no-ops).
//
// Cover images are the route-map crops placed in the uploads dir as
// run-*-map.png (dev: server/uploads/, prod: /data/uploads on the volume).
// The "/uploads/x.png" paths resolve against the API origin via mediaUrl().

// A wall-clock local time on the given calendar day (month is 1-based).
function at(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

type RunEvent = {
  title: string;
  description: string;
  coverImage: string;
  coverTheme: string;
  date: Date;
  location: string;
  city: string;
};

const RUN_EVENTS: RunEvent[] = [
  {
    title: 'MADRID SOCIAL RUN',
    description: 'Lauf · Social · 5,0 km',
    // No route map in the source material — theme-only cover.
    coverImage: '',
    coverTheme: 'sunset',
    date: at(2026, 7, 12, 10, 0),
    location: 'Paseo Fernan Núñez, 30, 28009 Madrid, Spain',
    city: 'Madrid',
  },
  {
    title: 'BERLIN: MOVE . Social Run w/ Salty Sports Club & New York Bagel Bar',
    description: 'Lauf · Social · 6,0 km · Gemischt',
    coverImage: '/uploads/run-berlin-map.png',
    coverTheme: 'cloud',
    date: at(2026, 7, 18, 15, 0),
    location: 'Rosenthaler Straße 72, Berlin, Deutschland',
    city: 'Berlin',
  },
  {
    title: 'VIENNA SOCIAL RUN',
    description: 'Lauf · Social · Straße',
    coverImage: '/uploads/run-vienna-map.png',
    coverTheme: 'cloud',
    date: at(2026, 7, 12, 9, 0),
    location: 'Universitätsring 2, 1010 Vienna, Austria',
    city: 'Vienna',
  },
  {
    title: 'HAMBURG SOCIAL RUN',
    description: 'Lauf · Social · Gemischt',
    coverImage: '/uploads/run-hamburg-map.png',
    coverTheme: 'cloud',
    date: at(2026, 7, 12, 10, 0),
    location: 'Krugkoppelbrücke, Hamburg, Deutschland',
    city: 'Hamburg',
  },
  {
    title: 'MUNICH WOMENS RUN',
    description: 'Lauf · Social · Nur Frauen',
    coverImage: '/uploads/run-munich-womens-map.png',
    coverTheme: 'cloud',
    date: at(2026, 7, 8, 17, 30),
    location: 'Maistraße 73, 80337 Munich, Germany',
    city: 'Munich',
  },
  {
    title: 'MUNICH SOCIAL RUN',
    description: 'Lauf · Social · 5,0 km · Gemischt',
    coverImage: '/uploads/run-munich-social-map.png',
    coverTheme: 'cloud',
    date: at(2026, 7, 11, 9, 30),
    location: 'Leopoldstraße 17, 80802 Munich, Germany',
    city: 'Munich',
  },
];

async function main() {
  // Org host account for the running-club events (isOrganization => never
  // counts as a "mutual"). No password: not a login account.
  const email = 'events@social-run.club';
  let club = await db.user.findFirst({ where: { email } });
  if (!club) {
    club = await db.user.create({
      data: {
        name: 'Social Run Club',
        email,
        avatarEmoji: '🏃',
        city: 'Munich',
        isOrganization: true,
      },
    });
    console.log('add-run-events: created host org account (Social Run Club)');
  }

  let added = 0;
  let skipped = 0;
  for (const e of RUN_EVENTS) {
    // Match by title, not slug: makeSlug() appends a random suffix, so it
    // isn't a stable key. Title uniquely identifies each curated event.
    const existing = await db.event.findFirst({ where: { title: e.title } });
    if (existing) {
      skipped += 1;
      continue;
    }
    const created = await db.event.create({
      data: {
        slug: makeSlug(e.title),
        title: e.title,
        description: e.description,
        coverTheme: e.coverTheme,
        coverImage: e.coverImage,
        titleFont: 'classic',
        effect: 'none',
        date: e.date,
        location: e.location,
        city: e.city,
        category: 'sports',
        isPublic: true,
        hostId: club.id,
      },
    });
    console.log(`add-run-events: created "${created.title}" (${created.slug})`);
    added += 1;
  }

  console.log(`add-run-events: added ${added}, skipped ${skipped} existing (no data deleted).`);
}

main()
  .catch((e) => {
    console.error('add-run-events failed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
