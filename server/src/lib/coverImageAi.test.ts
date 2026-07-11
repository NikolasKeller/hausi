import assert from 'node:assert/strict';
import test from 'node:test';
import { EventDraftAiError } from './eventDraftAi.js';
import { eventCoverRequestSchema, generateEventCoverImage } from './coverImageAi.js';

const baseRequest = {
  title: 'Birthday Dinner for Friends',
  description: 'A cozy candlelit dinner with good food and better company.',
  category: 'food' as const,
};

function imagesResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('validates strict cover requests', () => {
  assert.equal(eventCoverRequestSchema.safeParse(baseRequest).success, true);
  assert.equal(eventCoverRequestSchema.safeParse({ title: 'Party' }).success, true);
  assert.equal(
    eventCoverRequestSchema.safeParse({ ...baseRequest, unexpected: true }).success,
    false
  );
  assert.equal(eventCoverRequestSchema.safeParse({ title: 'x' }).success, false);
  assert.equal(
    eventCoverRequestSchema.safeParse({ ...baseRequest, description: 'x'.repeat(601) }).success,
    false
  );
});

test('requests a landscape JPEG and returns its base64 payload', async () => {
  let requestBody: Record<string, unknown> = {};
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return imagesResponse({ data: [{ b64_json: 'aGVsbG8=' }] });
  }) as typeof fetch;

  const result = await generateEventCoverImage(baseRequest, {
    apiKey: 'test-key',
    model: 'test-image-model',
    fetchImpl,
    userId: 'user-123',
  });

  assert.equal(requestBody.model, 'test-image-model');
  assert.equal(requestBody.size, '1536x1024');
  assert.equal(requestBody.output_format, 'jpeg');
  assert.equal(requestBody.n, 1);
  const prompt = String(requestBody.prompt);
  assert.ok(prompt.includes(baseRequest.title));
  assert.ok(prompt.toLowerCase().includes('no text'));
  // The user id is only ever forwarded as a hash.
  assert.ok(!JSON.stringify(requestBody).includes('user-123'));
  assert.equal(result.base64, 'aGVsbG8=');
  assert.equal(result.contentType, 'image/jpeg');
});

test('maps provider failures to the shared error kinds', async () => {
  const cases: [number, string][] = [
    [401, 'not_configured'],
    [429, 'rate_limited'],
    [400, 'invalid_response'],
    [500, 'unavailable'],
  ];
  for (const [status, kind] of cases) {
    const fetchImpl = (async () => imagesResponse({}, status)) as typeof fetch;
    await assert.rejects(
      generateEventCoverImage(baseRequest, { apiKey: 'test-key', fetchImpl }),
      (error: unknown) => error instanceof EventDraftAiError && error.kind === kind
    );
  }
});

test('rejects an empty provider payload', async () => {
  const fetchImpl = (async () => imagesResponse({ data: [{}] })) as typeof fetch;
  await assert.rejects(
    generateEventCoverImage(baseRequest, { apiKey: 'test-key', fetchImpl }),
    (error: unknown) =>
      error instanceof EventDraftAiError && error.kind === 'invalid_response'
  );
});
