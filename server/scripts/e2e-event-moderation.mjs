// Smoke test: private visibility, public approval queue and hidden locations.
// Run against an isolated local server:
//   node scripts/e2e-event-moderation.mjs http://localhost:3006
const ORIGIN = process.argv[2] ?? 'http://localhost:3006';
let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function json(path, options = {}) {
  const response = await fetch(`${ORIGIN}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${response.status} ${body.error ?? ''}`);
  return body;
}

const userLogin = await json('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@iykyk.app', password: 'iykyk123' }),
});
const userHeaders = {
  Authorization: `Bearer ${userLogin.token}`,
  'Content-Type': 'application/json',
};

const adminLogin = await json('/api/auth/dev/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '+4915799999998', name: 'Preview Admin' }),
});
const adminHeaders = {
  Authorization: `Bearer ${adminLogin.token}`,
  'Content-Type': 'application/json',
};

const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
const privateEvent = (
  await json('/api/events', {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({
      title: 'Private Preview Test',
      description: 'Invite only.',
      date: future,
      location: 'Müllerstraße 6, München',
      city: 'Munich',
      isPublic: false,
      hideLocation: true,
      maxGuests: 10,
      plusOneLimit: 1,
    }),
  })
).event;
check('private event stays private', !privateEvent.isPublic && privateEvent.publicationStatus === 'PRIVATE');
check('host sees hidden address', privateEvent.location.includes('Müllerstraße'));

const submitted = (
  await json('/api/events', {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({
      title: 'Public Approval Test',
      description: 'Needs moderation.',
      date: future,
      location: 'Lenbachplatz 8, München',
      city: 'Munich',
      isPublic: true,
      maxGuests: 20,
      plusOneLimit: 0,
    }),
  })
).event;
check(
  'public request is pending, not public',
  !submitted.isPublic && submitted.publicationStatus === 'PENDING'
);

const before = await json('/api/discover/explore', { headers: userHeaders });
check('regular Explore hides private event', !before.events.some((e) => e.id === privateEvent.id));
check('regular Explore hides pending event', !before.events.some((e) => e.id === submitted.id));

const adminExplore = await json('/api/discover/explore', { headers: adminHeaders });
check('admin preview sees private event', adminExplore.events.some((e) => e.id === privateEvent.id));
check('admin preview hides protected address', adminExplore.events.find((e) => e.id === privateEvent.id)?.location === 'Location revealed after RSVP');

const queue = await json('/api/admin/events', { headers: adminHeaders });
check('submission appears in admin queue', queue.events.some((e) => e.id === submitted.id));
await json(`/api/admin/events/${submitted.id}/approve`, { method: 'POST', headers: adminHeaders });

const after = await json('/api/discover/explore', { headers: userHeaders });
check('approved event appears in regular Explore', after.events.some((e) => e.id === submitted.id));
check('private event remains hidden after another approval', !after.events.some((e) => e.id === privateEvent.id));

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
