import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Context } from 'hono';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import {
  EventDraftAiError,
  eventDraftChatRequestSchema,
  generateEventDraftTurn,
  missingFields,
} from '../lib/eventDraftAi.js';
import {
  eventCoverRequestSchema,
  generateEventCoverImage,
} from '../lib/coverImageAi.js';
import { GUIDELINE_REFUSAL, isEventContentAllowed } from '../lib/moderation.js';
import type { EventDraftChatResponse } from '../../../app/shared/types.js';

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

// Shared provider-failure mapping for both AI endpoints. Logs the kind only —
// never user content or provider payloads.
function aiFailure(c: Context, error: unknown, what: string) {
  if (!(error instanceof EventDraftAiError)) {
    console.warn(`[event-drafts] ${what} failed with unexpected error`);
    return c.json({ error: 'AI event drafting is temporarily unavailable' }, 502);
  }
  console.warn(`[event-drafts] ${what} failed: ${error.kind}`);
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

eventDraftRoutes.post('/chat', async (c) => {
  const parsed = eventDraftChatRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Invalid or overly long AI draft request' }, 400);
  }

  // Hard content gate BEFORE the model sees anything: a brief asking for a
  // disallowed event (sexual/adult, hate, violence, illegal goods) gets a
  // firm, friendly refusal and never touches the draft. The prompt policy
  // inside the model is the second net for grey-zone phrasing.
  const lastUserMessage = [...parsed.data.messages]
    .reverse()
    .find((message) => message.role === 'user');
  if (lastUserMessage && !(await isEventContentAllowed(lastUserMessage.content))) {
    const missing = missingFields(parsed.data.draft, new Date());
    const refusal: EventDraftChatResponse = {
      draft: parsed.data.draft,
      assistantMessage: GUIDELINE_REFUSAL,
      status: missing.length === 0 ? 'ready' : 'needs_input',
      nextField: missing[0] ?? null,
      missingFields: missing,
      titleSuggestions: [],
    };
    return c.json(refusal);
  }

  try {
    const result = await generateEventDraftTurn(parsed.data, { userId: c.get('userId') });
    return c.json(result);
  } catch (error) {
    return aiFailure(c, error, 'AI turn');
  }
});

// Cover artwork is an order of magnitude pricier per call than a chat turn, so
// it gets its own much tighter per-user bucket on top of the shared limiter.
const COVER_LIMIT = 8;
const COVER_WINDOW_MS = 5 * 60 * 1000;
const coverBuckets = new Map<string, number[]>();

eventDraftRoutes.post('/cover', async (c) => {
  const userId = c.get('userId');
  const now = Date.now();
  const hits = (coverBuckets.get(userId) ?? []).filter((time) => now - time < COVER_WINDOW_MS);
  if (coverBuckets.size > 10_000) coverBuckets.clear();
  hits.push(now);
  coverBuckets.set(userId, hits);
  if (hits.length > COVER_LIMIT) {
    return c.json({ error: 'Too many cover designs - wait a few minutes and try again' }, 429);
  }

  const parsed = eventCoverRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Invalid cover request' }, 400);
  }

  try {
    const image = await generateEventCoverImage(parsed.data, { userId });
    // Base64 goes back to the client; it becomes a stored upload only when the
    // event is actually published (same lifecycle as hand-picked photos).
    return c.json({ image: image.base64, contentType: image.contentType });
  } catch (error) {
    return aiFailure(c, error, 'Cover generation');
  }
});
