import bcrypt from 'bcryptjs';
import { DATABASE_URL, db } from '../src/lib/db.js';
import { makeSlug } from '../src/lib/slug.js';

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

// A wall-clock local time on the given calendar day (month is 1-based).
function at(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

// The poster images are served straight from YE Munich's site; the app's
// mediaUrl() passes full https URLs through unchanged, so they render as covers.
type FeaturedEvent = {
  title: string;
  description: string;
  coverImage: string;
  coverTheme: string;
  titleFont: string;
  effect: string;
  date: Date;
  location: string;
  city: string;
  category: string;
  costPerPerson: string;
  dressCode: string;
};

const events: FeaturedEvent[] = [
  {
    title: 'Bahnwärter Thiel Sommerfest',
    description: [
      'The Bahnwärter Thiel Cultural Center invites you to a spectacular summer festival, with a music program across four stages - two open-air and two indoor.',
      '',
      'In cozy seating areas you can enjoy ice-cold drinks and treats from the food stand while the day\'s musicians delight your ears. And this time there\'s something for your eyes too: the Munich collective Isarseide enchants you with a breathtaking aerial performance on vertical silks and rope attached to the crane.',
      '',
      'Line-up (A–Z):',
      '- Atric [Tipping Point / Leipzig]',
      '- Basti Steinacker [Korajo / Munich]',
      '- Bonjour Ben [Freiland, It Works / Rostock]',
      '- Hutti [Munich]',
      '- Isarseide [Munich]',
      '- Karlo Kurbel [Bahnwärter Thiel, Flugmodus / Munich]',
      '- Nepobaby [Atoll Amore / Hamburg]',
      '- and many more',
      '',
      'From 0€ in advance, 15€ at the door. A safer space: no homophobia, no violence, no sexism, no racism, no hate.',
    ].join('\n'),
    coverImage:
      'https://imageflow.rausgegangen.de/url/https%3A//s3.eu-central-1.amazonaws.com/rausgegangen/pUr4EdnURNuVwrx1yEoj_26-07-11-sommerfest.jpg?width=800&height=1000&mode=crop',
    coverTheme: 'sunset',
    titleFont: 'classic',
    effect: 'confetti',
    date: at(2026, 7, 11, 14),
    location: 'Bahnwärter Thiel, Tumblingerstraße 45, 80337 München, Germany',
    city: 'Munich',
    category: 'music',
    costPerPerson: 'From 0 EUR',
    dressCode: '',
  },
  {
    title: 'PAPItutmirleid BIG ASS FESTIVAL #2',
    description: [
      'Papi is back at the Skatehalle - but this time with a huge outdoor festival.',
      '',
      'Food trucks, a huge stage, free flash tattoos, free braids and tooth gems. We always say "come naked", but this time please bring your most comfortable dancing shoes.',
      '',
      'Doors 3pm - 1am. Expect house and latin all day and night.',
    ].join('\n'),
    coverImage:
      'https://imageflow.rausgegangen.de/url/https%3A//s3.eu-central-1.amazonaws.com/rausgegangen/invRAbcNQVa3P8tkv5KO_bildschirmfoto-2026-07-01-um-135828.png?width=800&height=1000&mode=crop',
    coverTheme: 'disco',
    titleFont: 'eclectic',
    effect: 'sparkles',
    date: at(2026, 7, 11, 15),
    location: 'Skateschule München, Dachauerstraße 110c, 80636 München, Germany',
    city: 'Munich',
    category: 'music',
    costPerPerson: '15 EUR',
    dressCode: '',
  },
  {
    title: "YE's Magic Garden",
    description: [
      'For the very first time, YE is unveiling a completely new concept in the heart of Munich.',
      '',
      'Discover a hidden location unlike anything we have done before. Tucked away behind the city streets at Lenbachplatz, this extraordinary courtyard garden has never been used for an event before - and we are proud to be the first to transform it into something truly magical.',
      '',
      'For one special day, this secret oasis becomes a Garden of Dreams - a place where fantasy meets reality. Surrounded by nature, enchanting details and a playful atmosphere, expect beautiful summer energy, international artists and an intimate setting designed to spark imagination and connection.',
      '',
      'Highlights:',
      '- Brand-new YE concept in a hidden courtyard garden at Lenbachplatz',
      '- First-ever event at this location',
      '- 6 international DJs, finest electronic house music',
      '- Unique installations and special surprises',
      '',
      'Entry 18+ . Open doors 3pm - 10pm . Finest drinks.',
    ].join('\n'),
    coverImage:
      'https://ye-munich.com/wp-content/uploads/2026/06/WhatsApp-Image-2026-06-11-at-16.20.01-819x1024.jpeg',
    coverTheme: 'blossom',
    titleFont: 'fancy',
    effect: 'butterflies',
    date: at(2026, 7, 11, 15),
    location: '494 Jidai, Lenbachplatz 1, 80331 Munich, Germany',
    city: 'Munich',
    category: 'music',
    costPerPerson: 'From 17 EUR',
    dressCode: '',
  },
  {
    title: 'YE Open Air - Regensburg',
    description: [
      'For the very first time, YE is coming to Regensburg.',
      '',
      'After unforgettable events all across Bavaria, it is time to open a completely new chapter together. On July 18th, we bring the YE experience to Regensburg with our biggest open-air concept yet: a massive production, international headliners, breathtaking visuals and thousands of people coming together for one unforgettable day.',
      '',
      'For this special edition we chose one of the most unique locations in the region: the historic courtyard of Gutshof Puerkelgut. Surrounded by stunning architecture and open-air festival vibes, it is the perfect backdrop for a summer to remember.',
      '',
      'Highlights:',
      '- First YE event in Regensburg',
      '- Unique location: courtyard of Gutshof Puerkelgut',
      '- Headliner special, more headliners announcing soon',
      '- Massive festival production, 7+ international house DJs',
      '- Spectacular stage and crazy light concept',
      '- Up to 5,000 guests',
      '',
      'Shuttle service Munich to Regensburg available (departures 11am, 1pm, 2:30pm from Karl-Scharnagl-Ring 7, return around midnight).',
      '',
      'Entry 18+ . Open doors 12pm - 11:30pm . Finest drinks.',
      'Table reservations: +49 15561 745599 (WhatsApp) or reservation@ye-munich.com',
    ].join('\n'),
    coverImage:
      'https://ye-munich.com/wp-content/uploads/2026/06/WhatsApp-Image-2026-06-02-at-18.17.31-819x1024.jpeg',
    coverTheme: 'sunset',
    titleFont: 'eclectic',
    effect: 'none',
    date: at(2026, 7, 18, 12),
    location: 'Gutshof Puerkelgut, Einhauserstrasse 2, 93053 Regensburg, Germany',
    city: 'Regensburg',
    category: 'music',
    costPerPerson: 'From 23 EUR',
    dressCode: '',
  },
  {
    title: 'YE Goes Pavillon Beach',
    description: [
      'For the very first time, YE is coming to Fuerstenfeldbruck.',
      '',
      'Experience one of the most beautiful summer locations just outside Munich: Pavillon Beach. Surrounded by sand, palm trees and a stunning waterfront setting, it offers everything summer should feel like - laid-back beach vibes, beautiful sunsets and a spectacular stage production built especially for this event.',
      '',
      'One of the biggest highlights: we dance outdoors right on the beach until 1:00am. Outdoor events with music running this late are incredibly rare, which makes this day extra special. From relaxing by the water during the day to dancing under the stars at night, this is exactly what summer is all about.',
      '',
      'Line-up highlight: Liva K - one of the most anticipated names in dance music, known for his versatile, atmospheric house sound.',
      '',
      'Highlights:',
      '- First-ever YE event in Fuerstenfeldbruck',
      '- Beautiful beach and waterfront location',
      '- Huge open-air stage production',
      '- International headliner announcement',
      '',
      'Entry 18+ . Open doors 2pm - 1am . Finest drinks.',
      'Table reservations: +49 15561 745599 or reservation@ye-munich.com',
    ].join('\n'),
    coverImage:
      'https://ye-munich.com/wp-content/uploads/2026/06/WhatsApp-Image-2026-06-26-at-12.36.20-1-819x1024.jpeg',
    coverTheme: 'ocean',
    titleFont: 'classic',
    effect: 'bubbles',
    date: at(2026, 7, 25, 14),
    location: 'Pavillon Beach, Fuerstenfeldbruck, Germany',
    // Fuerstenfeldbruck sits in the Munich metro area; grouped under Munich so
    // it surfaces for people browsing the city (venue still shown in location).
    city: 'Munich',
    category: 'music',
    costPerPerson: '',
    dressCode: '',
  },
  {
    title: 'YE Goes Duesseldorf Weinzelt',
    description: [
      'For the very first time, YE is coming to Duesseldorf.',
      '',
      'Join us at one of the most iconic and unique locations of the entire Duesseldorf Rheinkirmes: the legendary Weinzelt. For one unforgettable day we take over our own stage inside the tent and create an atmosphere unlike anything the fair has seen before - from daytime sunshine sessions on the terrace to high-energy moments inside the Weinzelt.',
      '',
      'What you usually cannot find at traditional festival tents, we bring to Duesseldorf: a dedicated house music experience inside one of Germany\'s most famous fairgrounds. Our carefully selected DJs deliver the finest house soundtrack all day long, where tradition meets modern electronic culture.',
      '',
      'Highlights:',
      '- First-ever YE event in Duesseldorf',
      '- Exclusive stage host at Duesseldorf Rheinkirmes',
      '- Legendary Weinzelt location',
      '- Finest house music all day long',
      '- Terrace sessions overlooking the fair',
      '',
      'Entry 18+ . Open doors 11am - 12am . Finest drinks.',
      'Table reservations: +49 15561 745599 or reservation@ye-munich.com',
    ].join('\n'),
    coverImage:
      'https://ye-munich.com/wp-content/uploads/2026/06/WhatsApp-Image-2026-06-24-at-20.12.35-1-819x1024.jpeg',
    coverTheme: 'berry',
    titleFont: 'classic',
    effect: 'none',
    date: at(2026, 7, 26, 11),
    location: 'Duesseldorf Rheinkirmes, Weinzelt, Duesseldorf, Germany',
    city: 'Duesseldorf',
    category: 'music',
    costPerPerson: '',
    dressCode: '',
  },
  {
    title: 'YE Retreat in the Alps',
    description: [
      'For the very first time, YE is creating a completely new experience in the mountains.',
      '',
      'From Friday, July 31st to Sunday, August 2nd, we bring the YE energy to the Alps for an exclusive retreat surrounded by nature, mountain views, fitness, recovery, music and unforgettable community. This is not just another event - it is a full weekend experience.',
      '',
      'Your retreat package includes 2 nights accommodation, catering throughout the weekend, fitness sessions, personal training, gym access, sauna, recovery moments and all planned YE retreat activities. The weekend opens with a special 5-course dinner on Friday evening.',
      '',
      'The highlight of the weekend: our exclusive YE Sunrise Event on Saturday night, from 11 PM to 7 AM, with DJs, music, mountain views and additional guests joining for the night.',
      '',
      'Highlights:',
      '- Exclusive mountain location in Austria',
      '- 2 nights accommodation and full catering included',
      '- Special 5-course dinner on Friday evening',
      '- Fitness program with personal trainers, gym, sauna and recovery',
      '- Exclusive Sunrise Event (11 PM - 7 AM), separate tickets available',
      '- Parking at KitzSki Sesselbahn Resterhoehe with shuttle to the location',
      '',
      'Entry 18+ . Finest drinks.',
    ].join('\n'),
    coverImage:
      'https://ye-munich.com/wp-content/uploads/2026/07/WhatsApp-Image-2026-07-01-at-20.36.03-2-819x1024.jpeg',
    coverTheme: 'forest',
    titleFont: 'literary',
    effect: 'none',
    date: at(2026, 7, 31, 18),
    location: 'Passthurn 19, 5730 Mittersill, Austria',
    city: 'Mittersill',
    category: 'community',
    costPerPerson: '',
    dressCode: '',
  },
  {
    title: 'YE - Ready for Takeoff Festival Munich',
    description: [
      'A new era begins. On August 22nd, YE presents by far the biggest event in our history.',
      '',
      'For one unforgettable day we transform a unique location near Munich Airport into a completely new festival world, inspired by the energy of Ibiza and the world\'s most iconic beach clubs. This is more than an event - it is a journey. Every detail is designed to make you feel like you are stepping into another destination, where music, production, design and emotion come together.',
      '',
      'At the heart of the festival stands our spectacular Take-Off Stage, a breathtaking open-air main stage with one of the biggest productions we have ever built. A Flight Board guides you through the day, announcing every departure as each artist takes the stage.',
      '',
      'Discover different worlds across the grounds:',
      '- Take-Off Stage: massive open-air main stage with world-class visuals',
      '- Smilie Stage: deeper grooves and underground sounds',
      '- Terminal Food Market: selected food trucks and drinks',
      '- Lounge, Reflection Zone and exclusive First Class VIP area',
      '',
      'Plus the launch of our biggest merchandise collection ever, surprise performances and interactive experiences throughout the day. Headliner announcement soon.',
      '',
      'Entry 18+ . Open doors 12pm - 12am . Finest drinks.',
      'Table reservations: +49 15561 745599 or reservation@ye-munich.com',
    ].join('\n'),
    coverImage:
      'https://ye-munich.com/wp-content/uploads/2026/07/WhatsApp-Image-2026-07-01-at-17.24.13-819x1024.jpeg',
    coverTheme: 'midnight',
    titleFont: 'eclectic',
    effect: 'stars',
    date: at(2026, 8, 22, 12),
    location: 'Pappelallee, 85399 Hallbergmoos (near Munich Airport), Germany',
    // Hallbergmoos (Munich Airport) is part of the Munich metro area; grouped
    // under Munich so it surfaces for people browsing the city.
    city: 'Munich',
    category: 'music',
    costPerPerson: '',
    dressCode: '',
  },
  {
    title: 'YE Goes Krems an der Donau - Vinery Edition',
    description: [
      'YE at a vinery.',
      '',
      'After successfully hosting several events in Vienna, we are now moving beyond the city - to Krems an der Donau. A beautiful landscape surrounded by some of the finest vineyards in Europe, and right there is where you will find us: YE\'s first event at a winery.',
      '',
      'Expect a relaxed yet elegant open-air day at Weingut Salomon Undhof, with finest house music, summer vibes and an all-white dress code.',
      '',
      'Highlights:',
      '- YE\'s first-ever event at a winery',
      '- Stunning vineyard landscape in Krems an der Donau',
      '- Dress code: ALL WHITE',
      '',
      'Entry 18+ . Open doors 2pm - 10pm . Finest drinks.',
      'Table reservations: +49 15561 745599 (WhatsApp) or reservation@ye-munich.com',
    ].join('\n'),
    coverImage:
      'https://ye-munich.com/wp-content/uploads/2026/06/WhatsApp-Image-2026-06-11-at-12.48.00-819x1024.jpeg',
    coverTheme: 'gold',
    titleFont: 'literary',
    effect: 'none',
    date: at(2026, 10, 17, 14),
    location: 'Weingut Salomon Undhof, Undstrasse 10, 3500 Krems an der Donau, Austria',
    city: 'Krems an der Donau',
    category: 'music',
    costPerPerson: '',
    dressCode: 'All white',
  },
];

async function main() {
  // Full wipe first - removes the old placeholder/demo events entirely.
  await db.comment.deleteMany();
  await db.rsvp.deleteMany();
  await db.eventCohost.deleteMany();
  await db.crush.deleteMany();
  await db.partyConnection.deleteMany();
  await db.event.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash('now123', 10);

  // The official curator account that hosts every featured event.
  const ye = await db.user.create({
    data: {
      name: 'YE Munich',
      email: 'events@ye-munich.com',
      passwordHash,
      avatarEmoji: '🎧',
      city: 'Munich',
    },
  });

  // A dev login so you can open the app and browse the featured events as a
  // regular guest (not the host). Real users sign up with their phone number.
  await db.user.create({
    data: {
      name: 'Demo',
      email: 'demo@now.app',
      phone: '+14155550100',
      passwordHash,
      avatarEmoji: '🙂',
      city: 'Munich',
    },
  });

  for (const e of events) {
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

  console.log(`Seeded ${events.length} featured Munich events (all public).`);
  console.log('Dev login: demo@now.app / now123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
