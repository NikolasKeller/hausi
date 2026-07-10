import { Hono } from 'hono';
import { db } from '../lib/db.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { toExploreEvent } from '../lib/serialize.js';
import { findMutuals } from '../lib/mutuals.js';
import { findFriendIds } from '../lib/friends.js';
import { resolveCities } from '../lib/geocode.js';
import { parseExploreDateRange } from '../lib/exploreDateRange.js';
import { CATEGORIES, type Category, type ExploreEvent } from '../../../app/shared/types.js';

const exploreInclude = {
  host: true,
  cohosts: { include: { user: true } },
  rsvps: { include: { user: true } },
};

function byInterest(a: ExploreEvent, b: ExploreEvent): number {
  return b.interested - a.interested;
}

export const discoverRoutes = new Hono<{ Variables: AuthVariables }>();
discoverRoutes.use('*', requireAuth);

// Everything the home screen needs in one round trip.
discoverRoutes.get('/home', async (c) => {
  const userId = c.get('userId');
  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });
  // "Pals" = explicit friends plus computed mutuals (people you've partied with).
  const [mutuals, friends] = await Promise.all([
    findMutuals(db, userId),
    findFriendIds(db, userId),
  ]);
  const friendIds = new Set([...mutuals.keys(), ...friends]);

  const events = await db.event.findMany({
    where: {
      ...(me.isAdmin ? {} : { isPublic: true }),
      canceledAt: null,
      date: { gte: new Date() },
    },
    include: exploreInclude,
    orderBy: { date: 'asc' },
    take: 1000,
  });

  const explore = events.map((e) => toExploreEvent(e, userId, friendIds));
  const trendingNearby = explore
    .filter((e) => e.city.trim().toLowerCase() === me.city.trim().toLowerCase())
    .sort(byInterest)
    .slice(0, 10);
  const palsGoing = explore
    .filter((e) => e.friendGoing && !e.isHost && e.myRsvp == null)
    .sort(byInterest)
    .slice(0, 10);
  const trendingNow = explore.sort(byInterest).slice(0, 10);

  return c.json({
    city: me.city,
    trendingNearby,
    palsGoing,
    trendingNow,
  });
});

// Public events filtered by city, category and optional device-local date
// boundaries (sent as absolute ISO instants).
discoverRoutes.get('/explore', async (c) => {
  const userId = c.get('userId');
  const me = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { isAdmin: true },
  });
  const wantedCity = c.req.query('city')?.trim().toLowerCase();
  const categoryParam = c.req.query('category')?.trim();
  const category = CATEGORIES.includes(categoryParam as Category)
    ? (categoryParam as Category)
    : null;
  const parsedDateRange = parseExploreDateRange(
    c.req.query('dateFrom'),
    c.req.query('dateTo')
  );
  if (!parsedDateRange.ok) {
    return c.json({ error: parsedDateRange.error }, 400);
  }
  // Free-text search over what a guest can already see on the card: title,
  // description, city and host name. Deliberately NOT the street address —
  // hideLocation events must not be probeable by address guesses. SQLite's
  // LIKE is case-insensitive for ASCII, which is all these fields need.
  const q = c.req.query('q')?.trim().slice(0, 80) ?? '';

  const now = new Date();
  const dateRange = parsedDateRange.range;
  const dateWhere = {
    // Explore never brings already-started events back, even when today's
    // local range began before the current instant.
    gte: new Date(Math.max(now.getTime(), dateRange?.from.getTime() ?? now.getTime())),
    ...(dateRange ? { lt: dateRange.to } : {}),
  };

  // Category is a controlled enum so it filters in the DB; city is matched in
  // JS below so casing/whitespace differences ("san francisco" vs "San
  // Francisco") still line up — SQLite equality is case-sensitive.
  const events = await db.event.findMany({
    where: {
      ...(me.isAdmin ? {} : { isPublic: true }),
      canceledAt: null,
      date: dateWhere,
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
              { city: { contains: q } },
              { host: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    include: exploreInclude,
    orderBy: { date: 'asc' },
    // High enough that a full catalogue of scraped city events (24 cities ×
    // ~35, see scripts/scrape-events.ts) never truncates a city's feed.
    take: 1000,
  });

  // Cities that have public events, resolved to real, on-the-map places. Each
  // distinct city is checked against the geocoder (resolveCity), which drops
  // made-up names ("San Brancisco") and canonicalizes casing. `realKeys` is the
  // set of raw city strings that map to a real place; it gates BOTH the picker
  // list AND the event feed, so a fake city never surfaces on Explore — as a
  // switcher option or on an event card (e.g. reached via a stale/fake filter).
  const cityRows = await db.event.findMany({
    where: {
      ...(me.isAdmin ? {} : { isPublic: true }),
      canceledAt: null,
      date: { gte: now },
      city: { not: '' },
    },
    select: { city: true },
  });
  const distinct = new Map<string, string>();
  for (const { city } of cityRows) {
    const label = city.trim();
    const key = label.toLowerCase();
    if (label && !distinct.has(key)) distinct.set(key, label);
  }
  const labels = [...distinct.values()];
  const resolved = await resolveCities(labels);
  const realKeys = new Set<string>();
  const cityByKey = new Map<string, string>();
  labels.forEach((label, i) => {
    const name = resolved[i];
    if (!name) return;
    realKeys.add(label.toLowerCase());
    const key = name.toLowerCase();
    if (!cityByKey.has(key)) cityByKey.set(key, name);
  });
  const cities = [...cityByKey.values()].sort((a, b) => a.localeCompare(b));

  const [mutuals, friends] = await Promise.all([
    findMutuals(db, userId),
    findFriendIds(db, userId),
  ]);
  const friendIds = new Set([...mutuals.keys(), ...friends]);
  const results = events
    .map((e) => toExploreEvent(e, userId, friendIds))
    .filter((e) => {
      const key = e.city.trim().toLowerCase();
      // Drop events whose city is a made-up name; keep city-less events.
      if (key && !realKeys.has(key)) return false;
      return !wantedCity || key === wantedCity;
    })
    .sort(byInterest);

  return c.json({ events: results, cities });
});
