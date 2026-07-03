import bcrypt from 'bcryptjs';
import { db } from '../src/lib/db.js';
import { makeSlug } from '../src/lib/slug.js';

function daysFromNow(days: number, hour = 19): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  await db.comment.deleteMany();
  await db.rsvp.deleteMany();
  await db.event.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash('hausi123', 10);

  const [demo, mia, leo, zoe] = await Promise.all(
    [
      { name: 'Demo Host', email: 'demo@hausi.app', avatarEmoji: '🎉' },
      { name: 'Mia', email: 'mia@hausi.app', avatarEmoji: '🦄' },
      { name: 'Leo', email: 'leo@hausi.app', avatarEmoji: '🕺' },
      { name: 'Zoe', email: 'zoe@hausi.app', avatarEmoji: '🌸' },
    ].map((u) => db.user.create({ data: { ...u, passwordHash } }))
  );

  const rooftop = await db.event.create({
    data: {
      slug: makeSlug('Rooftop Sunset Sessions'),
      title: 'Rooftop Sunset Sessions',
      description:
        'Golden hour, good people, better playlists. Bring a bottle and your best summer energy. 🌇',
      coverTheme: 'sunset',
      date: daysFromNow(5, 18),
      location: 'Dachterrasse, Müllerstraße 12',
      hostId: demo.id,
      maxGuests: 30,
      rsvps: {
        create: [
          { userId: demo.id, status: 'GOING' },
          { userId: mia.id, status: 'GOING', plusOnes: 1 },
          { userId: leo.id, status: 'MAYBE' },
          { userId: zoe.id, status: 'GOING' },
        ],
      },
      comments: {
        create: [
          { userId: mia.id, text: 'is going with +1 🎉', type: 'system' },
          { userId: mia.id, text: 'Bringing my famous sangria 🍹' },
          { userId: leo.id, text: 'might come 🤔', type: 'system' },
          { userId: leo.id, text: 'Might be late, save me a spot on the couch!' },
          { userId: zoe.id, text: 'is going 🎉', type: 'system' },
          { userId: demo.id, text: 'Doors open at 6 — sunset is at 7:30 sharp 🌅' },
        ],
      },
    },
  });

  await db.event.create({
    data: {
      slug: makeSlug('Midnight Disco'),
      title: 'Midnight Disco 🪩',
      description: 'Strictly disco. Dress code: something that sparkles.',
      coverTheme: 'disco',
      date: daysFromNow(12, 23),
      location: 'Kellerbar, Hinterhof links',
      hostId: mia.id,
      rsvps: {
        create: [
          { userId: mia.id, status: 'GOING' },
          { userId: demo.id, status: 'GOING' },
          { userId: zoe.id, status: 'MAYBE' },
          { userId: leo.id, status: 'CANT' },
        ],
      },
      comments: {
        create: [
          { userId: demo.id, text: 'Already picked out my sequin shirt ✨' },
          { userId: zoe.id, text: 'What time does the DJ start?' },
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
      date: daysFromNow(2, 19),
      location: 'Bei Leo, Gartenstraße 4',
      hostId: leo.id,
      maxGuests: 8,
      rsvps: {
        create: [
          { userId: leo.id, status: 'GOING' },
          { userId: demo.id, status: 'MAYBE' },
        ],
      },
      comments: {
        create: [{ userId: leo.id, text: 'Send allergies my way before Friday!' }],
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
      location: 'Bei Zoe, Sonnenallee 21',
      hostId: zoe.id,
      rsvps: {
        create: [
          { userId: zoe.id, status: 'GOING' },
          { userId: demo.id, status: 'GOING' },
          { userId: mia.id, status: 'CANT' },
        ],
      },
      comments: {
        create: [
          { userId: demo.id, text: 'is going 🎉', type: 'system' },
          { userId: mia.id, text: "can't make it 😢", type: 'system' },
          { userId: demo.id, text: 'That was such a good evening 🧡' },
        ],
      },
    },
  });

  console.log('Seeded 4 users and 4 events (incl. one past).');
  console.log('Login: demo@hausi.app / hausi123');
  console.log(`Example invite slug: ${rooftop.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
