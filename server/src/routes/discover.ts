import { Hono } from 'hono';
import { db } from '../lib/db.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { toExploreEvent } from '../lib/serialize.js';
import { findMutuals } from '../lib/mutuals.js';
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
  const mutuals = await findMutuals(db, userId);
  const friendIds = new Set(mutuals.keys());

  const events = await db.event.findMany({
    where: { isPublic: true, canceledAt: null, date: { gte: new Date() } },
    include: exploreInclude,
    orderBy: { date: 'asc' },
    take: 200,
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

// Public events filtered by city and category.
discoverRoutes.get('/explore', async (c) => {
  const userId = c.get('userId');
  const wantedCity = c.req.query('city')?.trim().toLowerCase();
  const categoryParam = c.req.query('category')?.trim();
  const category = CATEGORIES.includes(categoryParam as Category)
    ? (categoryParam as Category)
    : null;

  // Category is a controlled enum so it filters in the DB; city is matched in
  // JS below so casing/whitespace differences ("san francisco" vs "San
  // Francisco") still line up — SQLite equality is case-sensitive.
  const events = await db.event.findMany({
    where: {
      isPublic: true,
      canceledAt: null,
      date: { gte: new Date() },
      ...(category ? { category } : {}),
    },
    include: exploreInclude,
    orderBy: { date: 'asc' },
    take: 200,
  });

  const mutuals = await findMutuals(db, userId);
  const friendIds = new Set(mutuals.keys());
  const results = events
    .map((e) => toExploreEvent(e, userId, friendIds))
    .filter((e) => !wantedCity || e.city.trim().toLowerCase() === wantedCity)
    .sort(byInterest);

  // Cities with public events, for the picker. Deduped case-insensitively
  // (keeping the first display casing seen) so one city isn't listed twice.
  const cityRows = await db.event.findMany({
    where: { isPublic: true, canceledAt: null, date: { gte: new Date() }, city: { not: '' } },
    select: { city: true },
  });
  const cityByKey = new Map<string, string>();
  for (const { city } of cityRows) {
    const label = city.trim();
    const key = label.toLowerCase();
    if (label && !cityByKey.has(key)) cityByKey.set(key, label);
  }
  const cities = [...cityByKey.values()].sort();

  return c.json({ events: results, cities });
});
