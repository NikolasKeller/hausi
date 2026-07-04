import { Hono } from 'hono';
import { db } from '../lib/db.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { toCardEntry } from '../lib/serialize.js';

// Viewing a shared card requires a session — the same gate as event invites,
// so opening a link funnels signed-out recipients through phone sign-in first.
export const cardRoutes = new Hono<{ Variables: AuthVariables }>();
cardRoutes.use('*', requireAuth);

// Fetch a card by its id — the handle embedded in a shared link.
cardRoutes.get('/:id', async (c) => {
  const card = await db.card.findUnique({
    where: { id: c.req.param('id') },
    include: { from: true, to: true },
  });
  if (!card) return c.json({ error: 'Card not found' }, 404);
  return c.json({ card: toCardEntry(card) });
});
