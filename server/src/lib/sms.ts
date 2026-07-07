import type { DeliveryChannel } from '../../../app/shared/types.js';

// Twilio integration for login codes. Two modes, both driven by env vars
// (no SDK — plain authenticated POSTs keep the Docker image lean):
//   1. Verify API  — set TWILIO_VERIFY_SERVICE_SID (VA…). Twilio generates,
//      sends AND checks the code; we never see or store it. Preferred. Supports
//      SMS, WhatsApp AND email channels (each must be enabled on the Verify
//      Service in the Twilio console — WhatsApp sender / SendGrid email
//      integration respectively).
//   2. Messages API — set TWILIO_FROM (a +E.164 number or MG… service) for SMS.
//      For WhatsApp set TWILIO_WHATSAPP_FROM (a whatsapp:-enabled sender; falls
//      back to Twilio's shared sandbox number). We generate the code, store it,
//      and send it ourselves. This mode CANNOT send email (email is Verify-only).
// With neither set, the caller falls back to returning the code on screen.
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID?.trim();
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim();
const TWILIO_FROM = process.env.TWILIO_FROM?.trim();
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
// WhatsApp sender for the Messages API. Defaults to Twilio's public sandbox
// number so local/dev setups work once the tester has joined the sandbox.
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM?.trim() || 'whatsapp:+14155238886';
// Optional per-request overrides for the Verify email channel. Normally the
// SendGrid sender + dynamic template are configured on the Verify Service in the
// Twilio console; these let a deploy point at a specific template/sender without
// touching the console. Unset = use whatever the service integration defines.
const TWILIO_VERIFY_EMAIL_TEMPLATE_ID = process.env.TWILIO_VERIFY_EMAIL_TEMPLATE_ID?.trim();
const TWILIO_VERIFY_EMAIL_FROM = process.env.TWILIO_VERIFY_EMAIL_FROM?.trim();
const TWILIO_VERIFY_EMAIL_FROM_NAME = process.env.TWILIO_VERIFY_EMAIL_FROM_NAME?.trim();

const hasAuth = Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN);
export const verifyEnabled = Boolean(hasAuth && TWILIO_VERIFY_SERVICE_SID);
export const smsEnabled = Boolean(hasAuth && TWILIO_FROM);
// WhatsApp via Messages needs auth + a whatsapp sender (the sandbox default
// covers the common case once credentials are present).
export const whatsappEnabled = Boolean(hasAuth && TWILIO_WHATSAPP_FROM);
// Email is only deliverable through Verify (its SendGrid integration). We can't
// detect from here whether the SendGrid integration is actually configured on
// the service, so we gate purely on Verify being enabled and let a send failure
// surface a clear error.
export const emailEnabled = verifyEnabled;

// Whether the requested delivery channel can actually send (used by the route to
// decide between a real send and the on-screen dev-code fallback).
export function channelEnabled(channel: DeliveryChannel): boolean {
  if (channel === 'email') return emailEnabled;
  if (channel === 'whatsapp') return whatsappEnabled;
  return smsEnabled;
}

// Twilio addresses WhatsApp endpoints with a "whatsapp:" scheme prefix.
function whatsappAddress(value: string): string {
  return value.startsWith('whatsapp:') ? value : `whatsapp:${value}`;
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`;
}

async function twilioPost(url: string, form: URLSearchParams): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
    throw new Error(`Twilio: ${message}`);
  }
  return data;
}

// --- Verify API ---------------------------------------------------------

export async function startVerification(
  to: string,
  channel: DeliveryChannel = 'sms'
): Promise<void> {
  const form = new URLSearchParams({ To: to, Channel: channel });
  // Optional per-request email template override. When unset, Twilio uses the
  // SendGrid sender + dynamic template configured on the Verify Service itself.
  if (channel === 'email' && TWILIO_VERIFY_EMAIL_TEMPLATE_ID) {
    const config: Record<string, string> = { template_id: TWILIO_VERIFY_EMAIL_TEMPLATE_ID };
    if (TWILIO_VERIFY_EMAIL_FROM) config.from = TWILIO_VERIFY_EMAIL_FROM;
    if (TWILIO_VERIFY_EMAIL_FROM_NAME) config.from_name = TWILIO_VERIFY_EMAIL_FROM_NAME;
    form.set('ChannelConfiguration', JSON.stringify(config));
  }
  await twilioPost(
    `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`,
    form
  );
}

export async function checkVerification(to: string, code: string): Promise<boolean> {
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`,
    {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, Code: code }).toString(),
    }
  );
  // Once a verification is consumed or its attempts run out, Twilio deletes it
  // and returns 404 — that's a wrong/expired code, not a server error.
  if (res.status === 404) return false;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
    throw new Error(`Twilio: ${message}`);
  }
  return (data as { status?: string } | null)?.status === 'approved';
}

// --- Messages API -------------------------------------------------------

export async function sendMessage(
  to: string,
  body: string,
  channel: DeliveryChannel = 'sms'
): Promise<void> {
  const form = new URLSearchParams({ Body: body });
  if (channel === 'whatsapp') {
    // WhatsApp requires the whatsapp: scheme on both endpoints and a
    // WhatsApp-enabled sender (sandbox or an approved business number).
    form.set('To', whatsappAddress(to));
    form.set('From', whatsappAddress(TWILIO_WHATSAPP_FROM));
  } else {
    form.set('To', to);
    if (TWILIO_FROM!.startsWith('MG')) form.set('MessagingServiceSid', TWILIO_FROM!);
    else form.set('From', TWILIO_FROM!);
  }
  await twilioPost(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    form
  );
}

// Back-compat alias for callers that only send SMS (e.g. host text blasts).
export async function sendSms(to: string, body: string): Promise<void> {
  await sendMessage(to, body, 'sms');
}
