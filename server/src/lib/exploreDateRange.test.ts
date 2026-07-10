import assert from 'node:assert/strict';
import test from 'node:test';
import { parseExploreDateRange } from './exploreDateRange.js';

test('accepts an absent or canonical half-open date range', () => {
  assert.deepEqual(parseExploreDateRange(undefined, undefined), {
    ok: true,
    range: null,
  });

  const parsed = parseExploreDateRange(
    '2026-07-09T22:00:00.000Z',
    '2026-07-10T22:00:00.000Z'
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok || !parsed.range) return;
  assert.equal(parsed.range.from.toISOString(), '2026-07-09T22:00:00.000Z');
  assert.equal(parsed.range.to.toISOString(), '2026-07-10T22:00:00.000Z');
});

test('rejects partial, date-only and invalid ranges', () => {
  assert.equal(
    parseExploreDateRange('2026-07-09T22:00:00.000Z', undefined).ok,
    false
  );
  assert.equal(parseExploreDateRange('2026-07-10', '2026-07-11').ok, false);
  assert.equal(
    parseExploreDateRange('not-a-date', '2026-07-10T22:00:00.000Z').ok,
    false
  );
  assert.equal(
    parseExploreDateRange(
      '2026-07-10T22:00:00.000Z',
      '2026-07-10T22:00:00.000Z'
    ).ok,
    false
  );
  assert.equal(
    parseExploreDateRange(
      '2026-07-11T22:00:00.000Z',
      '2026-07-10T22:00:00.000Z'
    ).ok,
    false
  );
});
