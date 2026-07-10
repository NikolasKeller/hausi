import { Hono } from 'hono';
import { db } from '../lib/db.js';
import { verifyPassCode } from './wallet.js';

// The public page a wallet-pass QR opens (scanned with any phone camera —
// door staff need no app and no login). Verifies the HMAC-signed code and
// re-checks the guest's CURRENT status in the database, so a pass silently
// dies when the RSVP is withdrawn or the event is canceled. Stateless — no
// "used" tracking; parties re-admit, this is a guest-list check, not a
// single-use turnstile.

export const checkinRoutes = new Hono();

const PAGE_STYLE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    background: #080B16; color: #F2F4F8;
    display: flex; justify-content: center; padding: 48px 16px;
  }
  .card {
    background: rgba(20,25,40,0.96); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 16px; padding: 32px; width: 100%; max-width: 420px;
    text-align: center;
  }
  .badge {
    display: inline-flex; align-items: center; gap: 8px;
    border-radius: 999px; padding: 8px 18px; font-weight: 700; font-size: 15px;
    margin-bottom: 20px;
  }
  .valid { background: #1E9E52; color: #fff; }
  .invalid { background: #D93036; color: #fff; }
  .kicker { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: rgba(242,244,248,0.5); margin-bottom: 6px; }
  h1 { font-size: 24px; letter-spacing: -0.5px; margin-bottom: 6px; }
  .meta { color: rgba(242,244,248,0.65); font-size: 14px; }
  .guest { margin-top: 22px; padding-top: 18px; border-top: 1px dashed rgba(255,255,255,0.18); }
  .guest .name { font-size: 20px; font-weight: 700; }
  .guest .role { font-size: 13px; color: rgba(242,244,248,0.6); margin-top: 2px; }
  .note { font-size: 12px; color: rgba(242,244,248,0.4); margin-top: 20px; }
`;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function page(inner: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>iykyk check-in</title><style>${PAGE_STYLE}</style></head>
<body><div class="card">${inner}</div></body></html>`;
}

function invalid(reason: string): string {
  return page(`
    <div class="badge invalid">✕ Not valid</div>
    <div class="kicker">iykyk check-in</div>
    <div class="meta">${esc(reason)}</div>
    <div class="note">Ask the guest to open their pass in the iykyk wallet.</div>`);
}

checkinRoutes.get('/:code', async (c) => {
  const parsed = verifyPassCode(c.req.param('code'));
  if (!parsed) return c.html(invalid('This pass code is not recognized.'), 404);

  const [event, user] = await Promise.all([
    db.event.findUnique({ where: { id: parsed.eventId }, include: { cohosts: true } }),
    db.user.findUnique({ where: { id: parsed.userId } }),
  ]);
  if (!event || !user) return c.html(invalid('This pass points at an event or guest that no longer exists.'), 404);
  if (event.canceledAt) return c.html(invalid('This event was canceled.'), 410);

  // Live status check — the pass is only as valid as the guest's current RSVP.
  const isHost =
    event.hostId === user.id || event.cohosts.some((ch) => ch.userId === user.id);
  let role = isHost ? 'Host' : '';
  if (!isHost) {
    const rsvp = await db.rsvp.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: user.id } },
    });
    if (!rsvp || rsvp.status === 'CANT' || rsvp.status === 'MAYBE') {
      return c.html(invalid(`${user.name || 'This guest'} is not on the guest list for "${event.title}".`), 410);
    }
    role = rsvp.status === 'WAITLIST' ? 'Waitlist' : 'Guest';
  }

  const when = `${event.date.toDateString()} · ${event.date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
  return c.html(
    page(`
    <div class="badge valid">✓ Valid pass</div>
    <div class="kicker">iykyk check-in</div>
    <h1>${esc(event.title)}</h1>
    <div class="meta">${esc(when)}${event.location ? `<br>${esc(event.location)}${event.city ? `, ${esc(event.city)}` : ''}` : ''}</div>
    <div class="guest">
      <div class="name">${esc(user.name || 'Guest')}</div>
      <div class="role">${esc(role)}${role === 'Waitlist' ? ' — admit if space allows' : ''}</div>
    </div>
    <div class="note">Status checked live against the guest list just now.</div>`)
  );
});
