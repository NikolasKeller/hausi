// End-to-end smoke test for the agentic ticket purchase flow, driving the real
// HTTP endpoints against a locally running server (PORT env, default 3002).
// Usage: node scripts/e2e-ticket.mjs [soldout]
const BASE = `http://127.0.0.1:${process.env.PORT ?? 3002}`;
const SOLDOUT = process.argv[2] === 'soldout';

const IDENTITY = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  address: '5 Analytical Ave, London',
  dateOfBirth: '1990-12-10',
};
const PAYMENT = { cardNumber: '4242 4242 4242 4242', cardExpiry: '12/29', cardCvc: '123' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1) Dev login (loopback-only) → token.
  const login = await fetch(`${BASE}/api/auth/dev/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Wallet Tester' }),
  }).then((r) => r.json());
  const token = login.token;
  if (!token) throw new Error(`No token: ${JSON.stringify(login)}`);
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Pick a Blitz Club event (München) for realism.
  const explore = await fetch(`${BASE}/api/discover/explore?city=Munich`, { headers: auth }).then((r) => r.json());
  const event =
    explore.events.find((e) => /blitz/i.test(e.title)) ?? explore.events[0];
  console.log('Event:', event.title, event.id);

  // 2) Availability check.
  const checkBody = { eventId: event.id, provider: 'demo', identity: IDENTITY };
  const check = await fetch(`${BASE}/api/tickets/check`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify(checkBody),
  }).then((r) => r.json());
  let job = check.job;
  console.log('After /check →', job.status);

  // Poll until availability settles.
  for (let i = 0; i < 20 && job.status === 'checking'; i++) {
    await sleep(1000);
    job = (await fetch(`${BASE}/api/tickets/${job.id}`, { headers: auth }).then((r) => r.json())).job;
  }
  console.log('Availability →', job.status, job.error || '');

  if (SOLDOUT) {
    console.log(job.status === 'soldout' ? 'PASS: sold out detected' : `UNEXPECTED: ${job.status}`);
    return;
  }
  if (job.status !== 'available') throw new Error(`Expected available, got ${job.status}: ${job.error}`);

  // 3+4) Payment + purchase.
  const purchase = await fetch(`${BASE}/api/tickets/${job.id}/purchase`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ identity: IDENTITY, payment: PAYMENT }),
  }).then((r) => r.json());
  job = purchase.job;
  console.log('After /purchase →', job.status);

  for (let i = 0; i < 40 && job.status === 'purchasing'; i++) {
    await sleep(1000);
    job = (await fetch(`${BASE}/api/tickets/${job.id}`, { headers: auth }).then((r) => r.json())).job;
  }
  console.log('Purchase →', job.status, job.error || '');
  console.log('PDF path:', job.pdfPath, '| card:', job.cardLast4);

  if (job.status === 'done' && job.pdfPath) {
    const pdf = await fetch(`${BASE}${job.pdfPath}`);
    console.log('PDF fetch:', pdf.status, pdf.headers.get('content-type'));
    console.log('PASS: ticket purchased end to end');
  } else {
    console.log('RESULT: purchase did not complete (see status/error above)');
  }
}

main().catch((e) => {
  console.error('E2E ERROR:', e);
  process.exit(1);
});
