import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import {
  EventDraftAiError,
  eventDraftChatRequestSchema,
  generateEventDraftTurn,
} from '../lib/eventDraftAi.js';

export const eventDraftRoutes = new Hono<{ Variables: AuthVariables }>();

// Reject oversized histories before parsing JSON. The stricter per-message and
// aggregate character limits in the Zod schema are defense-in-depth.
eventDraftRoutes.use(
  '*',
  bodyLimit({
    maxSize: 32 * 1024,
    onError: (c) => c.json({ error: 'AI draft request is too large' }, 413),
  })
);
eventDraftRoutes.use('*', requireAuth);

// Each turn has an external cost. Cap requests by authenticated account rather
// than a spoofable forwarded IP while still allowing a complete event wizard.
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;
const rateBuckets = new Map<string, number[]>();

eventDraftRoutes.use('*', async (c, next) => {
  const userId = c.get('userId');
  const now = Date.now();
  const hits = (rateBuckets.get(userId) ?? []).filter((time) => now - time < RATE_WINDOW_MS);
  if (rateBuckets.size > 10_000) rateBuckets.clear();
  hits.push(now);
  rateBuckets.set(userId, hits);
  if (hits.length > RATE_LIMIT) {
    return c.json({ error: 'Too many AI requests - wait a minute and try again' }, 429);
  }
  await next();
});

eventDraftRoutes.post('/chat', async (c) => {
  const parsed = eventDraftChatRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Invalid or overly long AI draft request' }, 400);
  }

  try {
    const result = await generateEventDraftTurn(parsed.data, { userId: c.get('userId') });
    return c.json(result);
  } catch (error) {
    if (!(error instanceof EventDraftAiError)) {
      console.warn('[event-drafts] AI turn failed with unexpected error');
      return c.json({ error: 'AI event drafting is temporarily unavailable' }, 502);
    }
    // Kind only — never user content or provider payloads.
    console.warn(`[event-drafts] AI turn failed: ${error.kind}`);
    switch (error.kind) {
      case 'not_configured':
        return c.json(
          { error: 'AI event drafting is not configured on this server yet' },
          503
        );
      case 'timeout':
        return c.json({ error: 'The AI took too long to respond - please retry' }, 504);
      case 'rate_limited':
        return c.json({ error: 'The AI service is busy - please retry in a moment' }, 503);
      case 'invalid_response':
        return c.json({ error: 'The AI returned an invalid draft - please retry' }, 502);
      case 'unavailable':
        return c.json({ error: 'Could not reach the AI service - please retry' }, 502);
    }
  }
});
