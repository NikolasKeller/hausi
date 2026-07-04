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
    .filter((e) => e.city.toLowerCase() === me.city.toLowerCase())
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
  const city = c.req.query('city')?.trim();
  const categoryParam = c.req.query('category')?.trim();
  const category = CATEGORIES.includes(categoryParam as Category)
    ? (categoryParam as Category)
    : null;

  const events = await db.event.findMany({
    where: {
      isPublic: true,
      canceledAt: null,
      date: { gte: new Date() },
      ...(city ? { city: { equals: city } } : {}),
      ...(category ? { category } : {}),
    },
    include: exploreInclude,
    orderBy: { date: 'asc' },
    take: 100,
  });

  const mutuals = await findMutuals(db, userId);
  const friendIds = new Set(mutuals.keys());
  const results = events.map((e) => toExploreEvent(e, userId, friendIds)).sort(byInterest);

  // Distinct cities that currently have public events, for the city picker.
  const cityRows = await db.event.findMany({
    where: { isPublic: true, canceledAt: null, date: { gte: new Date() }, city: { not: '' } },
    select: { city: true },
    distinct: ['city'],
  });

  return c.json({ events: results, cities: cityRows.map((r) => r.city).sort() });
});
