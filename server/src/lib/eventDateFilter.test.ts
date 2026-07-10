import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fromLocalDateKey,
  getEventDateRange,
  toLocalDateKey,
  type EventDateFilter,
} from '../../../app/lib/eventDateFilter.js';

process.env.TZ = 'Europe/Berlin';

function isoRange(filter: EventDateFilter, now: Date): [string, string] | null {
  const range = getEventDateRange(filter, now);
  return range ? [range.from.toISOString(), range.to.toISOString()] : null;
}

test('today follows local midnight across the spring DST change', () => {
  const now = new Date('2026-03-29T12:00:00+02:00');
  assert.deepEqual(isoRange({ kind: 'today' }, now), [
    '2026-03-28T23:00:00.000Z',
    '2026-03-29T22:00:00.000Z',
  ]);
});

test('tomorrow uses the next local calendar day', () => {
  const now = new Date('2026-12-31T18:00:00+01:00');
  assert.deepEqual(isoRange({ kind: 'tomorrow' }, now), [
    '2026-12-31T23:00:00.000Z',
    '2027-01-01T23:00:00.000Z',
  ]);
});

test('this weekend covers Friday through Sunday in local time', () => {
  const expected = ['2026-07-09T22:00:00.000Z', '2026-07-12T22:00:00.000Z'];
  assert.deepEqual(
    isoRange({ kind: 'weekend' }, new Date('2026-07-10T12:00:00+02:00')),
    expected
  );
  assert.deepEqual(
    isoRange({ kind: 'weekend' }, new Date('2026-07-11T12:00:00+02:00')),
    expected
  );
  assert.deepEqual(
    isoRange({ kind: 'weekend' }, new Date('2026-07-12T12:00:00+02:00')),
    expected
  );
});

test('this weekend advances to the upcoming weekend on Monday', () => {
  assert.deepEqual(
    isoRange({ kind: 'weekend' }, new Date('2026-07-13T12:00:00+02:00')),
    ['2026-07-16T22:00:00.000Z', '2026-07-19T22:00:00.000Z']
  );
});

test('custom calendar dates are parsed locally, never as UTC date strings', () => {
  const selected = fromLocalDateKey('2026-07-10');
  assert.ok(selected);
  assert.equal(selected.getHours(), 0);
  assert.equal(toLocalDateKey(selected), '2026-07-10');
  assert.deepEqual(
    isoRange({ kind: 'date', date: '2026-07-10' }, new Date('2026-07-01T12:00:00+02:00')),
    ['2026-07-09T22:00:00.000Z', '2026-07-10T22:00:00.000Z']
  );
  assert.equal(fromLocalDateKey('2026-02-30'), null);
});

test('any date has no range', () => {
  assert.equal(getEventDateRange({ kind: 'any' }), null);
});
