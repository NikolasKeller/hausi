import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  EventDraftChatDraft,
  EventDraftChatRequest,
} from '../../../app/shared/types.js';
import {
  EventDraftAiError,
  eventDraftChatRequestSchema,
  generateEventDraftTurn,
} from './eventDraftAi.js';
import { eventDraftRoutes } from '../routes/eventDrafts.js';

const now = new Date('2026-07-10T12:00:00.000Z');

const baseDraft: EventDraftChatDraft = {
  title: 'Rooftop Dinner',
  description: '',
  date: '2026-07-18T17:00:00.000Z',
  locationHint: 'Alexanderplatz Berlin',
  selectedLocation: {
    location: 'Alexanderplatz, 10178 Berlin, Germany',
    city: 'Berlin',
  },
  category: 'food',
  isPublic: false,
  hideLocation: false,
  capacity: { kind: 'limited', maxGuests: 12 },
  plusOneLimit: 1,
  entry: { kind: 'paid', price: '15' },
};

const baseRequest: EventDraftChatRequest = {
  messages: [{ role: 'user', content: 'Dinner for twelve friends, tickets are €15.' }],
  draft: baseDraft,
  timeZone: 'Europe/Berlin',
  locale: 'en-DE',
};

function openAiResponse(output: unknown): Response {
  return new Response(
    JSON.stringify({
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: JSON.stringify(output) }],
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

test('validates strict, bounded client requests', () => {
  assert.equal(eventDraftChatRequestSchema.safeParse(baseRequest).success, true);
  assert.equal(
    eventDraftChatRequestSchema.safeParse({ ...baseRequest, unexpected: true }).success,
    false
  );
  assert.equal(
    eventDraftChatRequestSchema.safeParse({
      ...baseRequest,
      messages: [
        {
          role: 'user',
          content: 'x'.repeat(1501),
        },
      ],
    }).success,
    false
  );
});

test('requires authentication before drafting', async () => {
  const response = await eventDraftRoutes.request('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(baseRequest),
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'Invalid or expired token');
});

test('requests strict non-stored output and returns a normalized draft', async () => {
  let requestBody: Record<string, unknown> = {};
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return openAiResponse({
      draft: {
        ...baseDraft,
        selectedLocation: undefined,
        entry: { kind: 'paid', price: '15,00' },
      },
      clearSelectedLocation: false,
      assistantMessage: 'Everything is ready to review.',
      nextField: null,
    });
  }) as typeof fetch;

  const result = await generateEventDraftTurn(baseRequest, {
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl,
    now,
    userId: 'user-123',
  });

  assert.equal(requestBody.model, 'test-model');
  assert.equal(requestBody.store, false);
  assert.equal(
    (
      (requestBody.text as { format?: { strict?: boolean } } | undefined)?.format
    )?.strict,
    true
  );
  assert.deepEqual(result.missingFields, []);
  assert.equal(result.status, 'ready');
  assert.equal(result.draft.entry.kind, 'paid');
  assert.equal(result.draft.entry.price, '15');
  assert.deepEqual(result.draft.selectedLocation, baseDraft.selectedLocation);
});

test('rejects structurally invalid provider output', async () => {
  const fetchImpl = (async () =>
    openAiResponse({
      draft: {
        ...baseDraft,
        selectedLocation: undefined,
        capacity: { kind: 'limited', maxGuests: null },
      },
      clearSelectedLocation: false,
      assistantMessage: 'Ready.',
      nextField: null,
    })) as typeof fetch;

  await assert.rejects(
    generateEventDraftTurn(baseRequest, {
      apiKey: 'test-key',
      fetchImpl,
      now,
    }),
    (error: unknown) =>
      error instanceof EventDraftAiError && error.kind === 'invalid_response'
  );
});

test('never accepts an AI-written address as a selected location', async () => {
  const fetchImpl = (async () =>
    openAiResponse({
      draft: {
        ...baseDraft,
        selectedLocation: undefined,
        locationHint: 'Tempelhofer Feld',
      },
      clearSelectedLocation: true,
      assistantMessage: 'Search for the new place and select the exact result.',
      nextField: 'location',
    })) as typeof fetch;

  const result = await generateEventDraftTurn(baseRequest, {
    apiKey: 'test-key',
    fetchImpl,
    now,
  });

  assert.equal(result.draft.selectedLocation, null);
  assert.equal(result.nextField, 'location');
  assert.equal(result.status, 'needs_input');
});
