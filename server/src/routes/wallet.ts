import { createHmac, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import QRCode from 'qrcode';
import { db } from '../lib/db.js';
import { requireAuth, JWT_SECRET, type AuthVariables } from '../lib/auth.js';
import type { CoverTheme, TitleFont, WalletPass } from '../../../app/shared/types.js';

// The in-app Wallet: a pass (with entry QR) for every upcoming event the user
// hosts or is GOING to. Passes are computed — no ticket table. The QR encodes
// a public /checkin/<code> URL whose code is HMAC-signed, so anyone scanning
// it (door staff with a phone camera) gets a server-verified answer.
//
// Code format: "<eventId>.<userId>.<sig>" where sig = HMAC-SHA256(secret,
// "wallet:<eventId>:<userId>") in base64url, truncated to 24 chars. cuids
// never contain '.', so splitting is unambiguous.

const SIG_LENGTH = 24;

function passSignature(eventId: string, userId: string): string {
  return createHmac('sha256', JWT_SECRET)
    .update(`wallet:${eventId}:${userId}`)
    .digest('base64url')
    .slice(0, SIG_LENGTH);
}

export function makePassCode(eventId: string, userId: string): string {
  return `${eventId}.${userId}.${passSignature(eventId, userId)}`;
}

export function verifyPassCode(code: string): { eventId: string; userId: string } | null {
  const parts = code.split('.');
  if (parts.length !== 3) return null;
  const [eventId, userId, sig] = parts;
  if (!eventId || !userId || sig.length !== SIG_LENGTH) return null;
  const expected = passSignature(eventId, userId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { eventId, userId };
}

// Where the /checkin page lives — same resolution as the SMS links in
// events.ts: explicit APP_URL, else the (forwarded) request host.
function publicBase(c: {
  req: { header: (name: string) => string | undefined };
}): string {
  const configured = process.env.APP_URL?.trim();
  const fwdHost = c.req.header('x-forwarded-host') ?? c.req.header('host');
  const fwdProto = c.req.header('x-forwarded-proto') ?? 'http';
  return (configured || (fwdHost ? `${fwdProto}://${fwdHost}` : '')).replace(/\/$/, '');
}

// Passes stay in the wallet a few hours past the start time (doors are late).
const PAST_GRACE_MS = 6 * 60 * 60 * 1000;

export const walletRoutes = new Hono<{ Variables: AuthVariables }>();
walletRoutes.use('*', requireAuth);

walletRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const cutoff = new Date(Date.now() - PAST_GRACE_MS);

  const events = await db.event.findMany({
    where: {
      canceledAt: null,
      date: { gte: cutoff },
      OR: [
        { hostId: userId },
        { cohosts: { some: { userId } } },
        { rsvps: { some: { userId, status: { in: ['GOING', 'WAITLIST'] } } } },
      ],
    },
    include: { host: true, cohosts: { where: { userId } } },
    orderBy: { date: 'asc' },
  });

  const base = publicBase(c);
  const passes: WalletPass[] = await Promise.all(
    events.map(async (event) => {
      const code = makePassCode(event.id, userId);
      const qrDataUrl = await QRCode.toDataURL(`${base}/checkin/${code}`, {
        width: 480,
        margin: 1,
        // Ink on ticket paper — matches the pass card the app renders it on.
        color: { dark: '#101319', light: '#F4F1EB' },
      });
      const isHost = event.hostId === userId || event.cohosts.length > 0;
      return {
        eventId: event.id,
        slug: event.slug,
        title: event.title,
        date: event.date.toISOString(),
        location: event.location,
        city: event.city,
        coverTheme: event.coverTheme as CoverTheme,
        coverImage: event.coverImage,
        titleFont: event.titleFont as TitleFont,
        hostName: event.host.name,
        costPerPerson: event.costPerPerson,
        role: isHost ? ('host' as const) : ('guest' as const),
        code,
        qrDataUrl,
        ticketUrl: event.ticketUrl,
      };
    })
  );

  return c.json({ passes });
});
