import bcrypt from 'bcryptjs';
import { DATABASE_URL, db } from '../src/lib/db.js';
import { makeSlug } from '../src/lib/slug.js';

// Demo data is for local development only. A real database (e.g. Supabase
// Postgres) must never receive it — real users populate mutuals, badges and
// trending organically, since all of those are computed from live tables.
// Seeding starts by DELETING every row, so it must also refuse to run inside
// the production container (the Railway sqlite volume is a real database).
const looksLikeProduction =
  !DATABASE_URL.startsWith('file:') || process.env.NODE_ENV === 'production';
if (looksLikeProduction && process.env.SEED_FORCE !== '1') {
  console.error(
    `Refusing to seed what looks like a real/production database (${DATABASE_URL.split('@').pop()}).\n` +
      'Seeding WIPES ALL DATA first. Set SEED_FORCE=1 to override.'
  );
  process.exit(1);
}

function daysFromNow(days: number, hour = 19): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  await db.comment.deleteMany();
  await db.rsvp.deleteMany();
  await db.eventCohost.deleteMany();
  await db.crush.deleteMany();
  await db.event.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash('hausi123', 10);
  const SF = 'San Francisco';

  const userSpecs = [
    { name: 'Demo Host', email: 'demo@hausi.app', phone: '+14155550100', avatarEmoji: '🎉', city: SF },
    { name: 'Mia', email: 'mia@hausi.app', phone: '+14155550101', avatarEmoji: '🦄', city: SF },
    { name: 'Leo', email: 'leo@hausi.app', phone: '+14155550102', avatarEmoji: '🕺', city: SF },
    { name: 'Zoe', email: 'zoe@hausi.app', phone: '+14155550103', avatarEmoji: '🌸', city: SF },
    { name: 'Noah', email: 'noah@hausi.app', phone: '+14155550104', avatarEmoji: '🛹', city: SF },
    { name: 'Ava', email: 'ava@hausi.app', phone: '+14155550105', avatarEmoji: '🎷', city: SF },
    { name: 'Kai', email: 'kai@hausi.app', phone: '+14155550106', avatarEmoji: '🌊', city: SF },
    { name: 'Luna', email: 'luna@hausi.app', phone: '+14155550107', avatarEmoji: '🌙', city: 'Berlin' },
    { name: 'Max', email: 'max@hausi.app', phone: '+14155550108', avatarEmoji: '🍕', city: 'Berlin' },
    { name: 'Iris', email: 'iris@hausi.app', phone: '+14155550109', avatarEmoji: '🎨', city: 'New York' },
  ];
  const users = [] as Awaited<ReturnType<typeof db.user.create>>[];
  for (const u of userSpecs) {
    users.push(await db.user.create({ data: { ...u, passwordHash } }));
  }
  const [demo, mia, leo, zoe, noah, ava, kai, luna, max, iris] = users;

  // A GOING rsvp, optionally bringing a named +1. The plusOnes count and the
  // PlusOne rows are created together so the invariant (count == row count)
  // holds from the first seed.
  const going = (
    userIds: string[],
    plusOnes: Record<string, { name: string; phone?: string }> = {}
  ) =>
    userIds.map((userId) => {
      const guest = plusOnes[userId];
      return {
        userId,
        status: 'GOING',
        plusOnes: guest ? 1 : 0,
        ...(guest
          ? { plusOneGuests: { create: [{ name: guest.name, phone: guest.phone ?? null }] } }
          : {}),
      };
    });
  const maybe = (userIds: string[]) => userIds.map((userId) => ({ userId, status: 'MAYBE' }));

  // ——— Private events for the demo user (calendar / my events) ———
  await db.event.create({
    data: {
      slug: makeSlug('Rooftop Sunset Sessions'),
      title: 'Rooftop Sunset Sessions',
      description:
        'Golden hour, good people, better playlists. Bring a bottle and your best summer energy. 🌇',
      coverTheme: 'sunset',
      titleFont: 'literary',
      effect: 'sparkles',
      date: daysFromNow(5, 18),
      location: 'Rooftop, 12 Miller St',
      city: SF,
      category: 'community',
      hostId: demo.id,
      maxGuests: 30,
      plusOneLimit: 2,
      cohosts: { create: [{ userId: mia.id }] },
      rsvps: {
        create: [
          ...going([demo.id, mia.id, zoe.id, noah.id], {
            [mia.id]: { name: 'Sam (Mia’s +1)', phone: '+14155550190' },
          }),
          ...maybe([leo.id]),
        ],
      },
      comments: {
        create: [
          { userId: mia.id, text: 'is going with +1 🎉', type: 'system' },
          { userId: mia.id, text: 'Bringing my famous sangria 🍹' },
          { userId: leo.id, text: 'might come 🤔', type: 'system' },
          { userId: zoe.id, text: 'is going 🎉', type: 'system' },
          { userId: demo.id, text: 'Doors open at 6 — sunset is at 7:30 sharp 🌅' },
        ],
      },
    },
  });

  await db.event.create({
    data: {
      slug: makeSlug('Pasta Night'),
      title: 'Pasta Night 🍝',
      description: 'Handmade pasta, three sauces, zero rules. Vegetarian friendly.',
      coverTheme: 'forest',
      titleFont: 'fancy',
      date: daysFromNow(2, 19),
      location: "Leo's place, 4 Garden St",
      city: SF,
      category: 'food',
      hostId: leo.id,
      maxGuests: 2,
      plusOneLimit: 0,
      rsvps: {
        create: [
          ...going([leo.id, demo.id]),
          { userId: mia.id, status: 'WAITLIST', waitlistedAt: new Date() },
        ],
      },
      comments: {
        create: [
          { userId: demo.id, text: 'is going 🎉', type: 'system' },
          { userId: mia.id, text: 'joined the waitlist ⏳', type: 'system' },
          { userId: leo.id, text: 'Send allergies my way before Friday!' },
        ],
      },
    },
  });

  await db.event.create({
    data: {
      slug: makeSlug('Balcony Aperitivo'),
      title: 'Balcony Aperitivo 🍊',
      description: 'Spritz o’clock. Thanks for coming everyone!',
      coverTheme: 'ocean',
      date: daysFromNow(-9, 18),
      location: "Zoe's balcony, 21 Sun Alley",
      city: SF,
      category: 'food',
      hostId: zoe.id,
      rsvps: { create: [...going([zoe.id, demo.id, kai.id])] },
      comments: {
        create: [{ userId: demo.id, text: 'That was such a good evening 🧡' }],
      },
    },
  });

  // ——— Public events: trending in SF ———
  await db.event.create({
    data: {
      slug: makeSlug('Midnight Disco'),
      title: 'MIDNIGHT DISCO 🪩',
      description:
        'Strictly disco. Dress code: something that sparkles. Free entry before midnight.',
      coverTheme: 'disco',
      titleFont: 'eclectic',
      effect: 'confetti',
      date: daysFromNow(12, 23),
      location: 'Basement Bar, backyard left',
      city: SF,
      category: 'music',
      isPublic: true,
      dressCode: 'Something that sparkles ✨',
      hostId: mia.id,
      rsvps: {
        create: [
          ...going([mia.id, demo.id, noah.id, ava.id, kai.id], {
            [ava.id]: { name: 'Jordan (Ava’s +1)', phone: '+14155550191' },
          }),
          ...maybe([zoe.id, leo.id]),
        ],
      },
      comments: {
        create: [{ userId: demo.id, text: 'Already picked out my sequin shirt ✨' }],
      },
    },
  });

  await db.event.create({
    data: {
      slug: makeSlug('Sunrise Run Club'),
      title: 'Sunrise Run Club 🏃',
      description: '5k along the water, coffee after. All paces welcome.',
      coverTheme: 'ocean',
      date: daysFromNow(3, 7),
      location: 'Marina Green',
      city: SF,
      category: 'sports',
      isPublic: true,
      hostId: kai.id,
      rsvps: { create: [...going([kai.id, noah.id, zoe.id]), ...maybe([ava.id])] },
    },
  });

  await db.event.create({
    data: {
      slug: makeSlug('Open Decks Night'),
      title: 'Open Decks Night 🎧',
      description: 'Bring a USB, play 20 minutes. Warm crowd, warmer subwoofer.',
      coverTheme: 'midnight',
      titleFont: 'eclectic',
      effect: 'sparkles',
      date: daysFromNow(7, 21),
      location: 'The Loft, 3rd floor',
      city: SF,
      category: 'music',
      isPublic: true,
      costPerPerson: '$5 at the door',
      hostId: ava.id,
      rsvps: {
        create: [...going([ava.id, mia.id, noah.id, kai.id, leo.id]), ...maybe([demo.id])],
      },
    },
  });

  await db.event.create({
    data: {
      slug: makeSlug('Gallery Crawl'),
      title: 'Gallery Crawl 🖼️',
      description: 'Three tiny galleries, one great evening. Meet at the first one.',
      coverTheme: 'candy',
      titleFont: 'literary',
      date: daysFromNow(9, 18),
      location: 'Mission District',
      city: SF,
      category: 'arts',
      isPublic: true,
      hostId: iris.id,
      rsvps: { create: [...going([iris.id, zoe.id, ava.id]), ...maybe([mia.id])] },
    },
  });

  await db.event.create({
    data: {
      slug: makeSlug('Dumpling Marathon'),
      title: 'Dumpling Marathon 🥟',
      description: 'We fold until we can’t. Then we eat until we can’t. BYO rolling pin.',
      coverTheme: 'forest',
      titleFont: 'fancy',
      date: daysFromNow(6, 17),
      location: 'Community Kitchen, Pier 9',
      city: SF,
      category: 'food',
      isPublic: true,
      hostId: noah.id,
      rsvps: { create: [...going([noah.id, kai.id, demo.id, mia.id])] },
    },
  });

  // ——— Public events elsewhere (Explore city picker) ———
  await db.event.create({
    data: {
      slug: makeSlug('Warehouse Rave'),
      title: 'WAREHOUSE RAVE',
      description: 'Concrete, lasers, sunrise. You know the drill.',
      coverTheme: 'midnight',
      titleFont: 'eclectic',
      effect: 'sparkles',
      date: daysFromNow(8, 23),
      location: 'Ostbahnhof area',
      city: 'Berlin',
      category: 'music',
      isPublic: true,
      hostId: luna.id,
      rsvps: { create: [...going([luna.id, max.id])] },
    },
  });

  await db.event.create({
    data: {
      slug: makeSlug('Pizza & Chess'),
      title: 'Pizza & Chess ♟️',
      description: 'Blitz rounds, grandma slices. Winner takes the last slice.',
      coverTheme: 'candy',
      date: daysFromNow(4, 19),
      location: 'Kreuzberg',
      city: 'Berlin',
      category: 'community',
      isPublic: true,
      hostId: max.id,
      rsvps: { create: [...going([max.id, luna.id])] },
    },
  });

  await db.event.create({
    data: {
      slug: makeSlug('Poetry Basement'),
      title: 'Poetry Basement 📖',
      description: 'Open mic, dim lights, loud hearts.',
      coverTheme: 'sunset',
      titleFont: 'literary',
      date: daysFromNow(10, 20),
      location: 'Lower East Side',
      city: 'New York',
      category: 'arts',
      isPublic: true,
      hostId: iris.id,
      rsvps: { create: [...going([iris.id])] },
    },
  });

  // ——— Crushes ———
  await db.crush.create({ data: { fromId: zoe.id, toId: demo.id } });

  console.log(`Seeded ${users.length} users and 11 events (7 public, 3 cities).`);
  console.log('Login: demo@hausi.app / hausi123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
