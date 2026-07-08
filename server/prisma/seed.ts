import bcrypt from 'bcryptjs';
import { DATABASE_URL, db } from '../src/lib/db.js';
import { makeSlug } from '../src/lib/slug.js';
import { FEATURED_EVENTS } from './featuredEvents.js';

// Seeds the featured, curated events shown to every new user on the discovery
// surfaces (Home / Explore). These are the real YE Munich events pulled from
// https://ye-munich.com/aktuelle-events/ - no placeholder/demo parties.
//
// Seeding WIPES ALL DATA first, so it must never run against a real/production
// database. The Railway sqlite volume is a real database.
const looksLikeProduction =
  !DATABASE_URL.startsWith('file:') || process.env.NODE_ENV === 'production';
if (looksLikeProduction && process.env.SEED_FORCE !== '1') {
  console.error(
    `Refusing to seed what looks like a real/production database (${DATABASE_URL.split('@').pop()}).\n` +
      'Seeding WIPES ALL DATA first. Set SEED_FORCE=1 to override.'
  );
  process.exit(1);
}

async function main() {
  // Full wipe first - removes the old placeholder/demo events entirely.
  await db.comment.deleteMany();
  await db.rsvp.deleteMany();
  await db.eventCohost.deleteMany();
  await db.crush.deleteMany();
  await db.partyConnection.deleteMany();
  await db.event.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash('iykyk123', 10);

  // The official curator account that hosts every featured event.
  const ye = await db.user.create({
    data: {
      name: 'YE Munich',
      email: 'events@ye-munich.com',
      passwordHash,
      avatarEmoji: '🎧',
      city: 'Munich',
      isOrganization: true,
    },
  });

  // A dev login so you can open the app and browse the featured events as a
  // regular guest (not the host). Real users sign up with their phone number.
  await db.user.create({
    data: {
      name: 'Demo',
      email: 'demo@iykyk.app',
      phone: '+14155550100',
      passwordHash,
      avatarEmoji: '🙂',
      city: 'Munich',
    },
  });

  for (const e of FEATURED_EVENTS) {
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
        // The host organizes the event and is not counted as a going guest.
      },
    });
  }

  console.log(`Seeded ${FEATURED_EVENTS.length} featured Munich events (all public).`);
  console.log('Dev login: demo@iykyk.app / iykyk123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
