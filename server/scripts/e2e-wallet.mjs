// Smoke test for the Wallet feature: dev-login → RSVP GOING → wallet pass →
// public /checkin verification (valid + tampered + withdrawn). Run against a
// local server: `node scripts/e2e-wallet.mjs [origin]`.
const ORIGIN = process.argv[2] ?? 'http://localhost:3005';

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const login = await fetch(`${ORIGIN}/api/auth/dev/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '+4915799999999', name: 'Wallet Tester' }),
}).then((r) => r.json());
check('dev login', typeof login.token === 'string');
const auth = { Authorization: `Bearer ${login.token}` };

// An upcoming event to RSVP to.
const explore = await fetch(`${ORIGIN}/api/discover/explore`, { headers: auth }).then((r) =>
  r.json()
);
const target = explore.events?.[0];
check('found an upcoming event', !!target, target?.title);

const rsvp = await fetch(`${ORIGIN}/api/events/${target.id}/rsvp`, {
  method: 'PUT',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'GOING' }),
}).then((r) => r.json());
check('RSVP GOING', ['GOING', 'WAITLIST'].includes(rsvp.event?.myRsvp), rsvp.event?.myRsvp);

const wallet = await fetch(`${ORIGIN}/api/wallet`, { headers: auth }).then((r) => r.json());
const pass = wallet.passes?.find((p) => p.eventId === target.id);
check('wallet has the pass', !!pass, `${wallet.passes?.length} pass(es)`);
check('pass has QR data URL', pass?.qrDataUrl?.startsWith('data:image/png;base64,'));
check('pass role', pass?.role === 'guest', pass?.role);

// The QR encodes the public check-in URL; verify it answers correctly.
const validPage = await fetch(`${ORIGIN}/checkin/${pass.code}`);
const validHtml = await validPage.text();
check('checkin: valid pass → 200 + badge', validPage.status === 200 && validHtml.includes('Valid pass'));
check('checkin: shows guest name', validHtml.includes('Wallet Tester'));
check('checkin: shows event title', validHtml.includes(target.title.slice(0, 20)));

// Tampered signature must be rejected.
const tampered = pass.code.slice(0, -4) + (pass.code.endsWith('AAAA') ? 'BBBB' : 'AAAA');
const badPage = await fetch(`${ORIGIN}/checkin/${tampered}`);
check('checkin: tampered code → 404', badPage.status === 404);

// Withdrawing the RSVP must kill the pass (live status check).
await fetch(`${ORIGIN}/api/events/${target.id}/rsvp`, {
  method: 'PUT',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'CANT' }),
});
const deadPage = await fetch(`${ORIGIN}/checkin/${pass.code}`);
const deadHtml = await deadPage.text();
check('checkin: withdrawn RSVP → not valid', deadPage.status === 410 && deadHtml.includes('Not valid'));

const walletAfter = await fetch(`${ORIGIN}/api/wallet`, { headers: auth }).then((r) => r.json());
check(
  'wallet drops the pass after withdrawal',
  !walletAfter.passes?.some((p) => p.eventId === target.id)
);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
