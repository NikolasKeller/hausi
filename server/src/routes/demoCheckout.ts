import { Hono } from 'hono';
import QRCode from 'qrcode';
import { db } from '../lib/db.js';

// A tiny self-hosted "ticket shop" the purchase agent can drive end to end.
// Real providers (RA, Eventbrite…) block automated checkouts, so this page
// exists to demonstrate the full agentic flow: the agent opens it, fills the
// generic checkout form, confirms the purchase and prints the confirmation
// (with a QR code) to PDF. It intentionally uses generic field names
// (autocomplete="cc-number" etc.) so the SAME generic form-detection the agent
// uses on real sites drives this page too — nothing here is special-cased.
//
// ⚠️ PROTOTYPE: the submitted card data is used for nothing, stored nowhere
// and never logged. This is a fake shop; no money moves anywhere.

export const demoCheckoutRoutes = new Hono();

const PAGE_STYLE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    background: #CFC7BD; color: #171717;
    display: flex; justify-content: center; padding: 48px 16px;
  }
  .card {
    background: #F4F1EB; border: 1px solid rgba(0,0,0,0.08); border-radius: 16px;
    padding: 32px; width: 100%; max-width: 460px;
    box-shadow: 0 12px 24px rgba(74,68,56,0.25);
  }
  .kicker { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: rgba(23,23,23,0.55); }
  h1 { font-size: 26px; margin: 6px 0 2px; letter-spacing: -0.5px; }
  .meta { color: rgba(23,23,23,0.6); font-size: 14px; margin-bottom: 20px; }
  label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: rgba(23,23,23,0.55); margin: 14px 0 4px; }
  input {
    width: 100%; padding: 12px 14px; font-size: 16px; color: #171717;
    background: rgba(255,255,255,0.55); border: 1px solid rgba(0,0,0,0.12); border-radius: 8px;
  }
  .row { display: flex; gap: 10px; }
  .row > div { flex: 1; }
  button {
    width: 100%; margin-top: 24px; padding: 15px; font-size: 16px; font-weight: 600;
    color: #fff; background: #171717; border: 0; border-radius: 999px; cursor: pointer;
  }
  .price { font-size: 20px; font-weight: 700; margin-top: 16px; }
  .qr { display: block; margin: 20px auto; width: 220px; height: 220px; }
  .code { text-align: center; font-family: ui-monospace, monospace; font-size: 13px; color: rgba(23,23,23,0.6); word-break: break-all; }
  .confirmed { text-align: center; }
  .check { font-size: 44px; }
  .note { font-size: 12px; color: rgba(23,23,23,0.45); margin-top: 18px; text-align: center; }
`;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

// Demo events are available by default. Append ?soldout=1 to simulate a
// sold-out event so the availability step can be demonstrated end to end.
function isSoldOut(c: { req: { query: (k: string) => string | undefined } }): boolean {
  return c.req.query('soldout') === '1';
}

demoCheckoutRoutes.get('/:eventId', async (c) => {
  const event = await db.event.findUnique({ where: { id: c.req.param('eventId') } });
  if (!event) return c.html('<h1>Event not found</h1>', 404);
  const job = c.req.query('job') ?? '';
  const price = event.costPerPerson || '€ 25.00';

  if (isSoldOut(c)) {
    return c.html(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Demo Ticket Shop</title><style>${PAGE_STYLE}</style></head>
<body>
  <div class="card" data-sold-out="true">
    <div class="kicker">Demo Ticket Shop</div>
    <h1>${esc(event.title)}</h1>
    <div class="meta">${esc(event.location)}${event.city ? `, ${esc(event.city)}` : ''} · ${event.date.toDateString()}</div>
    <div class="price">Sold out</div>
    <div class="note">No tickets are available for this event.</div>
  </div>
</body></html>`);
  }

  return c.html(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Demo Ticket Shop</title><style>${PAGE_STYLE}</style></head>
<body>
  <div class="card" data-available="true">
    <div class="kicker">Demo Ticket Shop</div>
    <h1>${esc(event.title)}</h1>
    <div class="meta">${esc(event.location)}${event.city ? `, ${esc(event.city)}` : ''} · ${event.date.toDateString()}</div>
    <form method="POST" action="/demo-checkout/${event.id}/confirm">
      <input type="hidden" name="job" value="${esc(job)}">
      <label for="name">Full name</label>
      <input id="name" name="name" autocomplete="name" placeholder="Ada Lovelace" required>
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" placeholder="ada@example.com" required>
      <label for="address">Billing address</label>
      <input id="address" name="address" autocomplete="street-address" placeholder="5 Analytical Ave, London" required>
      <label for="bday">Date of birth</label>
      <input id="bday" name="bday" autocomplete="bday" placeholder="YYYY-MM-DD" required>
      <label for="cc-number">Card number</label>
      <input id="cc-number" name="cc-number" autocomplete="cc-number" inputmode="numeric" placeholder="4242 4242 4242 4242" required>
      <div class="row">
        <div>
          <label for="cc-exp">Expiry (MM/YY)</label>
          <input id="cc-exp" name="cc-exp" autocomplete="cc-exp" placeholder="12/29" required>
        </div>
        <div>
          <label for="cc-csc">CVC</label>
          <input id="cc-csc" name="cc-csc" autocomplete="cc-csc" inputmode="numeric" placeholder="123" required>
        </div>
      </div>
      <div class="price">1 × General Admission — ${esc(price)}</div>
      <button type="submit">Buy ticket</button>
    </form>
    <div class="note">Demo checkout — no real payment happens here.</div>
  </div>
</body></html>`);
});

demoCheckoutRoutes.post('/:eventId/confirm', async (c) => {
  const event = await db.event.findUnique({ where: { id: c.req.param('eventId') } });
  if (!event) return c.html('<h1>Event not found</h1>', 404);
  const form = await c.req.parseBody();
  const name = typeof form.name === 'string' ? form.name.trim() : '';
  const email = typeof form.email === 'string' ? form.email.trim() : '';
  const cardNumber = typeof form['cc-number'] === 'string' ? form['cc-number'].replace(/\s+/g, '') : '';
  if (!name || !email || cardNumber.length < 12) {
    return c.html('<h1>Missing checkout details</h1>', 400);
  }

  // Bind the ticket to the purchasing user via the job reference when the
  // agent bought it; a human clicking around gets a guest ticket.
  const jobId = typeof form.job === 'string' ? form.job : '';
  const job = jobId ? await db.ticketJob.findUnique({ where: { id: jobId } }) : null;
  const userId = job?.userId ?? 'guest';

  const issuedAt = Date.now();
  const ticketCode = `iykyk-ticket:${event.id}:${userId}:${issuedAt}`;
  const qrDataUrl = await QRCode.toDataURL(ticketCode, { width: 440, margin: 1 });
  const last4 = cardNumber.slice(-4);

  return c.html(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Ticket confirmed</title><style>${PAGE_STYLE}</style></head>
<body>
  <div class="card confirmed" data-ticket-confirmed="true">
    <div class="check">✅</div>
    <div class="kicker">Order confirmed</div>
    <h1>${esc(event.title)}</h1>
    <div class="meta">${esc(event.location)}${event.city ? `, ${esc(event.city)}` : ''} · ${event.date.toDateString()}</div>
    <img class="qr" src="${qrDataUrl}" alt="Ticket QR code">
    <div class="code">${esc(ticketCode)}</div>
    <div class="meta" style="margin-top:16px">1 × General Admission · ${esc(name)} · card ending in ${esc(last4)}</div>
    <div class="note">Show this QR code at the door. Demo ticket — not valid for real entry.</div>
  </div>
</body></html>`);
});
