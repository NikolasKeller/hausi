// Twilio integration for phone login codes. Two modes, both driven by env vars
// (no SDK — plain authenticated POSTs keep the Docker image lean):
//   1. Verify API  — set TWILIO_VERIFY_SERVICE_SID (VA…). Twilio generates,
//      sends AND checks the code; we never see or store it. Preferred.
//   2. Messages API — set TWILIO_FROM (a +E.164 number or MG… service). We
//      generate the code, store it, and text it ourselves.
// With neither set, the caller falls back to returning the code on screen.
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID?.trim();
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim();
const TWILIO_FROM = process.env.TWILIO_FROM?.trim();
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

const hasAuth = Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN);
export const verifyEnabled = Boolean(hasAuth && TWILIO_VERIFY_SERVICE_SID);
export const smsEnabled = Boolean(hasAuth && TWILIO_FROM);

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

export async function startVerification(to: string): Promise<void> {
  await twilioPost(
    `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`,
    new URLSearchParams({ To: to, Channel: 'sms' })
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

export async function sendSms(to: string, body: string): Promise<void> {
  const form = new URLSearchParams({ To: to, Body: body });
  if (TWILIO_FROM!.startsWith('MG')) form.set('MessagingServiceSid', TWILIO_FROM!);
  else form.set('From', TWILIO_FROM!);
  await twilioPost(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    form
  );
}
