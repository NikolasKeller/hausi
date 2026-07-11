import assert from 'node:assert/strict';
import test from 'node:test';
import { isEventContentAllowed } from './moderation.js';

function moderationResponse(categories: Record<string, boolean>, status = 200): Response {
  return new Response(JSON.stringify({ results: [{ categories }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('blocks content flagged in a disallowed category', async () => {
  const fetchImpl = (async () =>
    moderationResponse({ sexual: true, violence: false })) as typeof fetch;
  assert.equal(
    await isEventContentAllowed('a sex party for 20 people', { apiKey: 'k', fetchImpl }),
    false
  );
});

test('allows clean content and ignores non-blocked categories', async () => {
  const fetchImpl = (async () =>
    moderationResponse({ sexual: false, harassment: true })) as typeof fetch;
  assert.equal(
    await isEventContentAllowed('a birthday dinner for friends', { apiKey: 'k', fetchImpl }),
    true
  );
});

test('fails open on provider errors and missing key', async () => {
  const errorImpl = (async () => moderationResponse({}, 500)) as typeof fetch;
  assert.equal(await isEventContentAllowed('anything', { apiKey: 'k', fetchImpl: errorImpl }), true);

  const throwImpl = (async () => {
    throw new Error('network down');
  }) as typeof fetch;
  assert.equal(await isEventContentAllowed('anything', { apiKey: 'k', fetchImpl: throwImpl }), true);

  assert.equal(await isEventContentAllowed('anything', { apiKey: '' }), true);
});
