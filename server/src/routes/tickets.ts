import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Event, TicketJob } from '@prisma/client';
import { db } from '../lib/db.js';
import { requireAuth, type AuthVariables } from '../lib/auth.js';
import { checkAvailability, runCheckout, TICKET_DIR } from '../lib/ticketAgent.js';
import type { AgentWallet, TicketJobInfo } from '../../../app/shared/types.js';

// Agentic ticket purchase — a real, phased flow (see app/shared/types.ts for
// the status meanings). The app drives it in two calls:
//   1) POST /check      { eventId, identity }        → job goes checking →
//                                                       available | soldout
//   2) POST /:id/purchase { identity, payment }      → job goes purchasing →
//                                                       done | failed
// "purchased" (status 'done') is only ever set after the agent has a confirmed
// ticket PDF in hand.
//
// ⚠️ PROTOTYPE LIMITATION — card handling: the payment (incl. full card
// number) arrives in the request body and is handed to the purchase agent IN
// MEMORY only. It is never written to the database, never logged, and dropped
// when the job finishes. That is still not PCI-compliant; a real version must
// use a tokenizing payment provider instead of raw card data.

export const ticketRoutes = new Hono<{ Variables: AuthVariables }>();
ticketRoutes.use('*', requireAuth);

// Identity a checkout typically asks for (step 1). No payment data here.
const identitySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  address: z.string().trim().min(1).max(300),
  dateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD'),
});

// Payment method (step 3). Kept in memory only.
const paymentSchema = z.object({
  cardNumber: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^\d{12,19}$/, 'Card number must be 12-19 digits')),
  cardExpiry: z.string().trim().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Expiry must be MM/YY'),
  cardCvc: z.string().trim().regex(/^\d{3,4}$/, 'CVC must be 3-4 digits'),
});

const checkSchema = z.object({
  eventId: z.string().min(1),
  provider: z.enum(['demo', 'web']).default('demo'),
  identity: identitySchema,
});

const purchaseSchema = z.object({
  identity: identitySchema,
  payment: paymentSchema,
});

// The event's real ticket/source link. Prefers the dedicated `ticketUrl`
// column (introduced by the event pipeline, #108) when present; otherwise
// falls back to the old convention of the LAST https URL in the description.
// Read defensively so this works whether or not the column has shipped yet.
function ticketUrl(event: Event): string | null {
  const explicit = (event as { ticketUrl?: string | null }).ticketUrl;
  if (typeof explicit === 'string' && /^https?:\/\//.test(explicit)) return explicit;
  const matches = event.description.match(/https:\/\/[^\s]+/g);
  return matches?.[matches.length - 1] ?? null;
}

function toTicketJobInfo(job: TicketJob, event: Event | null): TicketJobInfo {
  return {
    id: job.id,
    eventId: job.eventId,
    status: job.status as TicketJobInfo['status'],
    provider: job.provider as TicketJobInfo['provider'],
    pdfPath: job.pdfPath,
    cardLast4: job.cardLast4,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    event: event
      ? {
          slug: event.slug,
          title: event.title,
          date: event.date.toISOString(),
          location: event.location,
        }
      : null,
  };
}

// The agent drives the demo shop over plain HTTP on this same server.
const SELF_ORIGIN = `http://127.0.0.1:${Number(process.env.PORT ?? 3001)}`;

// For 'web' the checkout URL is the event's real ticket link; for 'demo' it's
// our own test shop.
function checkoutUrlFor(provider: 'demo' | 'web', event: Event, jobId: string): string | null {
  if (provider === 'web') return ticketUrl(event);
  return `${SELF_ORIGIN}/demo-checkout/${event.id}?job=${jobId}`;
}

// Step 2: availability check. Never touches payment. Runs in the background;
// the app polls until the job leaves "checking".
async function runAvailabilityJob(jobId: string, event: Event, provider: 'demo' | 'web') {
  try {
    const url = checkoutUrlFor(provider, event, jobId);
    if (!url) {
      await db.ticketJob.update({
        where: { id: jobId },
        data: { status: 'failed', error: 'This event has no ticket link.' },
      });
      return;
    }
    const result = await checkAvailability(url);
    if (result.status === 'available') {
      await db.ticketJob.update({ where: { id: jobId }, data: { status: 'available', error: '' } });
    } else if (result.status === 'soldout') {
      await db.ticketJob.update({ where: { id: jobId }, data: { status: 'soldout', error: result.reason } });
    } else {
      // Couldn't confirm (bot protection etc.) — surface it as a failure so we
      // never proceed to payment on an unverified event.
      await db.ticketJob.update({ where: { id: jobId }, data: { status: 'failed', error: result.reason } });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Availability check crashed';
    await db.ticketJob
      .update({ where: { id: jobId }, data: { status: 'failed', error: message.slice(0, 500) } })
      .catch(() => {});
  }
}

// Step 4: the actual purchase. The wallet lives only in this call's scope.
async function runPurchaseJob(jobId: string, event: Event, provider: 'demo' | 'web', wallet: AgentWallet) {
  try {
    if (provider === 'web') {
      const url = ticketUrl(event);
      if (!url) {
        await db.ticketJob.update({ where: { id: jobId }, data: { status: 'failed', error: 'This event has no ticket link.' } });
        return;
      }
      // Real providers: form recognition only — we stop before any purchase.
      const result = await runCheckout({ url, wallet, allowPurchase: false });
      await db.ticketJob.update({ where: { id: jobId }, data: { status: 'failed', error: result.reason } });
      return;
    }

    const pdfName = `${randomUUID()}.pdf`;
    const result = await runCheckout({
      url: `${SELF_ORIGIN}/demo-checkout/${event.id}?job=${jobId}`,
      wallet,
      allowPurchase: true,
      pdfFile: join(TICKET_DIR, pdfName),
    });
    await db.ticketJob.update({
      where: { id: jobId },
      // Only now, with a confirmed ticket PDF, does the job become 'done'.
      data: result.ok
        ? { status: 'done', pdfPath: `/uploads/tickets/${pdfName}`, error: '' }
        : { status: 'failed', error: result.reason },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Purchase agent crashed';
    await db.ticketJob
      .update({ where: { id: jobId }, data: { status: 'failed', error: message.slice(0, 500) } })
      .catch(() => {});
  }
}

// ── Step 1+2: submit identity, start the availability check ──────────────────
ticketRoutes.post('/check', async (c) => {
  const userId = c.get('userId');
  const parsed = checkSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, 400);
  }
  const { eventId, provider, identity } = parsed.data;

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || event.canceledAt) return c.json({ error: 'Event not found' }, 404);

  // Reuse an in-flight job for this user+event; otherwise start a fresh check.
  // A finished/failed/soldout job is replaced so the user can retry cleanly.
  const existing = await db.ticketJob.findFirst({
    where: { eventId, userId },
    orderBy: { createdAt: 'desc' },
  });
  if (existing && (existing.status === 'checking' || existing.status === 'purchasing')) {
    return c.json({ job: toTicketJobInfo(existing, event) });
  }

  const job = await db.ticketJob.create({
    data: {
      userId,
      eventId,
      provider,
      status: 'checking',
      buyerName: identity.name,
      pdfPath: '',
      cardLast4: '',
      error: '',
    },
  });

  void runAvailabilityJob(job.id, event, provider);
  return c.json({ job: toTicketJobInfo(job, event) }, 201);
});

// ── Step 3+4: confirm payment, complete the purchase ─────────────────────────
ticketRoutes.post('/:id/purchase', async (c) => {
  const userId = c.get('userId');
  const jobId = c.req.param('id');
  const parsed = purchaseSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payment' }, 400);
  }
  const { identity, payment } = parsed.data;

  const job = await db.ticketJob.findUnique({ where: { id: jobId } });
  if (!job || job.userId !== userId) return c.json({ error: 'Not found' }, 404);
  // Payment is only allowed once availability was confirmed.
  if (job.status !== 'available') {
    return c.json({ error: 'Tickets have not been confirmed available for this order.' }, 409);
  }

  const event = await db.event.findUnique({ where: { id: job.eventId } });
  if (!event || event.canceledAt) return c.json({ error: 'Event not found' }, 404);

  const updated = await db.ticketJob.update({
    where: { id: jobId },
    // Only the masked tail ever reaches the database.
    data: { status: 'purchasing', cardLast4: payment.cardNumber.slice(-4), error: '' },
  });

  // Buying implies attending: mirror the old Buy-ticket GOING rsvp so the
  // event lands under Profile → "My events". Best-effort.
  if (event.hostId !== userId) {
    await db.rsvp
      .upsert({
        where: { eventId_userId: { eventId: event.id, userId } },
        create: { eventId: event.id, userId, status: 'GOING' },
        update: { status: 'GOING' },
      })
      .catch(() => {});
  }

  const wallet: AgentWallet = { ...identity, ...payment };
  void runPurchaseJob(jobId, event, job.provider as 'demo' | 'web', wallet);

  return c.json({ job: toTicketJobInfo(updated, event) });
});

ticketRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const jobs = await db.ticketJob.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  const events = await db.event.findMany({ where: { id: { in: [...new Set(jobs.map((j) => j.eventId))] } } });
  const byId = new Map(events.map((e) => [e.id, e]));
  return c.json({ jobs: jobs.map((j) => toTicketJobInfo(j, byId.get(j.eventId) ?? null)) });
});

ticketRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  const job = await db.ticketJob.findUnique({ where: { id: c.req.param('id') } });
  if (!job || job.userId !== userId) return c.json({ error: 'Not found' }, 404);
  const event = await db.event.findUnique({ where: { id: job.eventId } });
  return c.json({ job: toTicketJobInfo(job, event) });
});
