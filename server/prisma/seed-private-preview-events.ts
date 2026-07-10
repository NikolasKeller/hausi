import { db } from '../src/lib/db.js';
import { makeSlug } from '../src/lib/slug.js';

// Creates the sold-out, invite-only Munich examples used for product previews.
// Safety: requires an existing admin and never marks these events public.
// Run only after the Event Studio feature is complete:
//   PREVIEW_ADMIN_USER_ID=<id> npx tsx prisma/seed-private-preview-events.ts

const configuredAdmin = process.env.PREVIEW_ADMIN_USER_ID?.trim();
const host = configuredAdmin
  ? await db.user.findFirst({ where: { id: configuredAdmin, isAdmin: true } })
  : await db.user.findFirst({ where: { isAdmin: true }, orderBy: { createdAt: 'asc' } });

if (!host) {
  throw new Error(
    'No admin account found. Set PREVIEW_ADMIN_USER_ID to the admin who should own the preview events.'
  );
}

if (!host.username) {
  await db.user.update({
    where: { id: host.id },
    data: { username: 'nikolas_preview' },
  });
}

const DAY = 24 * 60 * 60 * 1000;
const specs = [
  {
    title: 'BLANC: The All White Night',
    description:
      'One private summer night where the only rule is white. Champagne at sunset, a hidden dance floor after dark, and a guest list capped before it gets ordinary.',
    location: 'Praterinsel 3-4, 80538 München',
    city: 'Munich',
    category: 'music',
    coverTheme: 'cloud',
    costPerPerson: '€ 38',
    maxGuests: 24,
    plusOneLimit: 1,
    daysFromNow: 18,
  },
  {
    title: 'Sip & Stroke: Wine, Paint, No Rules',
    description:
      'Natural wine, oversized canvases and a playlist that gets better with every glass. No talent needed. Your painting goes home with you.',
    location: 'KUNSTLABOR 2, Dachauer Straße 90, 80335 München',
    city: 'Munich',
    category: 'arts',
    coverTheme: 'berry',
    costPerPerson: '€ 29',
    maxGuests: 16,
    plusOneLimit: 0,
    daysFromNow: 25,
  },
  {
    title: 'Kitchen Floor: A Maxvorstadt House Party',
    description:
      'Phones down, shoes off. Dinner turns into drinks, drinks turn into dancing, and the address only unlocks once your RSVP is confirmed.',
    location: 'Import Export, Schwere-Reiter-Straße 2h, 80636 München',
    city: 'Munich',
    category: 'community',
    coverTheme: 'midnight',
    costPerPerson: '',
    maxGuests: 20,
    plusOneLimit: 1,
    daysFromNow: 11,
  },
  {
    title: 'Blue Hour: Private Rooftop Pool Club',
    description:
      'Pool from golden hour, DJs after dark. Towels, drinks and midnight snacks are covered. The exact entrance is shared with confirmed guests.',
    location: 'Andaz Munich Schwabinger Tor, Leopoldstraße 170, 80804 München',
    city: 'Munich',
    category: 'community',
    coverTheme: 'ocean',
    costPerPerson: '€ 45',
    maxGuests: 18,
    plusOneLimit: 0,
    daysFromNow: 32,
  },
] as const;

for (const spec of specs) {
  const date = new Date(Date.now() + spec.daysFromNow * DAY);
  date.setHours(19, 30, 0, 0);

  let event = await db.event.findFirst({
    where: { hostId: host.id, title: spec.title },
  });
  if (!event) {
    event = await db.event.create({
      data: {
        slug: makeSlug(spec.title),
        hostId: host.id,
        title: spec.title,
        description: spec.description,
        location: spec.location,
        city: spec.city,
        date,
        category: spec.category,
        coverTheme: spec.coverTheme,
        costPerPerson: spec.costPerPerson,
        maxGuests: spec.maxGuests,
        plusOneLimit: spec.plusOneLimit,
        isPublic: false,
        publicationStatus: 'PRIVATE',
        hideLocation: true,
        rsvpsOpen: true,
      },
    });
  } else {
    event = await db.event.update({
      where: { id: event.id },
      data: {
        date,
        description: spec.description,
        location: spec.location,
        city: spec.city,
        costPerPerson: spec.costPerPerson,
        maxGuests: spec.maxGuests,
        plusOneLimit: spec.plusOneLimit,
        isPublic: false,
        publicationStatus: 'PRIVATE',
        hideLocation: true,
        canceledAt: null,
        rsvpsOpen: true,
      },
    });
  }

  // Exactly maxGuests confirmed RSVPs makes the event genuinely sold out in
  // the same capacity math the product uses — no fake "sold out" display flag.
  for (let i = 0; i < spec.maxGuests; i++) {
    const email = `preview.guest.${spec.daysFromNow}.${i}@iykyk.test`;
    const guest = await db.user.upsert({
      where: { email },
      create: {
        email,
        name: `Preview Guest ${i + 1}`,
        username: `preview_${spec.daysFromNow}_${i + 1}`,
        avatarEmoji: ['🪩', '🍷', '🎨', '🌊', '✨'][i % 5],
        city: 'Munich',
      },
      update: {},
    });
    await db.rsvp.upsert({
      where: { eventId_userId: { eventId: event.id, userId: guest.id } },
      create: { eventId: event.id, userId: guest.id, status: 'GOING' },
      update: { status: 'GOING', plusOnes: 0 },
    });
  }

  console.log(`✓ ${spec.title} — private, hidden location, ${spec.maxGuests}/${spec.maxGuests}`);
}

await db.$disconnect();
