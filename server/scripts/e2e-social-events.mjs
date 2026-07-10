// End-to-end social event flow:
// usernames/search → friendship → private event → direct invite → RSVP →
// friend as linked plus-one.
const ORIGIN = process.argv[2] ?? 'http://localhost:3006';
let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}
async function call(path, options = {}, expected = 200) {
  const response = await fetch(`${ORIGIN}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (response.status !== expected) {
    throw new Error(`${path}: expected ${expected}, got ${response.status} ${body.error ?? ''}`);
  }
  return body;
}
const json = { 'Content-Type': 'application/json' };
async function login(phone, name) {
  const body = await call(
    '/api/auth/dev/login',
    { method: 'POST', headers: json, body: JSON.stringify({ phone, name }) },
    200
  );
  return {
    user: body.user,
    headers: { ...json, Authorization: `Bearer ${body.token}` },
  };
}

const alice = await login('+4915110000001', 'Alice Social');
const bob = await login('+4915110000002', 'Bob Social');
const charlie = await login('+4915110000003', 'Charlie Social');

for (const [session, username] of [
  [alice, 'alice_social'],
  [bob, 'bob_social'],
  [charlie, 'charlie_social'],
]) {
  await call('/api/me', {
    method: 'PATCH',
    headers: session.headers,
    body: JSON.stringify({ username }),
  });
}
check('unique usernames saved', true);

const duplicate = await fetch(`${ORIGIN}/api/me`, {
  method: 'PATCH',
  headers: bob.headers,
  body: JSON.stringify({ username: 'alice_social' }),
});
check('duplicate username rejected', duplicate.status === 409, `HTTP ${duplicate.status}`);

const search = await call('/api/users/search?q=@bob_soc', { headers: alice.headers });
check(
  'search finds exact handle',
  search.users.length === 1 && search.users[0].username === 'bob_social'
);

await call(`/api/friends/requests/${bob.user.id}`, {
  method: 'POST',
  headers: alice.headers,
}, 201);
const bobAccepts = await call(`/api/friends/requests/${alice.user.id}`, {
  method: 'POST',
  headers: bob.headers,
});
check('reciprocal request becomes friendship', bobAccepts.state === 'friends');

await call(`/api/friends/requests/${charlie.user.id}`, {
  method: 'POST',
  headers: bob.headers,
}, 201);
await call(`/api/friends/requests/${bob.user.id}`, {
  method: 'POST',
  headers: charlie.headers,
});

const future = new Date(Date.now() + 14 * 86400000).toISOString();
const created = await call(
  '/api/events',
  {
    method: 'POST',
    headers: alice.headers,
    body: JSON.stringify({
      title: 'Social E2E House Party',
      description: 'Private social test.',
      date: future,
      location: 'Import Export, Schwere-Reiter-Straße 2h, 80636 München',
      city: 'Munich',
      isPublic: false,
      hideLocation: true,
      maxGuests: 6,
      plusOneLimit: 1,
    }),
  },
  201
);
const event = created.event;
check('private event created', event.publicationStatus === 'PRIVATE' && !event.isPublic);

const invited = await call(`/api/events/${event.id}/invites`, {
  method: 'POST',
  headers: alice.headers,
  body: JSON.stringify({ userIds: [bob.user.id] }),
});
check('friend directly invited', invited.invited.some((user) => user.id === bob.user.id));

const inbox = await call('/api/me/event-invites', { headers: bob.headers });
check('invite reaches recipient inbox', inbox.invites.some((invite) => invite.event.id === event.id));

const bobRsvp = await call(`/api/events/${event.id}/rsvp`, {
  method: 'PUT',
  headers: bob.headers,
  body: JSON.stringify({ status: 'GOING' }),
});
check('recipient RSVPs going', bobRsvp.event.myRsvp === 'GOING');
check('confirmed guest unlocks hidden address', bobRsvp.event.location.includes('Import Export'));

const plusOne = await call(`/api/events/${event.id}/plus-one`, {
  method: 'POST',
  headers: bob.headers,
  body: JSON.stringify({ userId: charlie.user.id }),
}, 201);
const bobEntry = plusOne.event.rsvps.find((entry) => entry.user.id === bob.user.id);
check(
  'friend selected as linked plus-one',
  bobEntry?.guests.some((guest) => guest.userId === charlie.user.id)
);
check('linked plus-one counts toward capacity', plusOne.event.counts.going === 2);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
