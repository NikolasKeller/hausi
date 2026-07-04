// Real SMS via Twilio's REST API. No SDK — a single authenticated POST keeps
// the Docker image lean. When the Twilio env vars are unset, smsEnabled is
// false and the caller falls back to returning the code on screen (dev mode).
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID?.trim();
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim();
// A phone number in E.164 (+1415…) OR a Messaging Service SID (MG…).
const TWILIO_FROM = process.env.TWILIO_FROM?.trim();

export const smsEnabled = Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM);

export async function sendSms(to: string, body: string): Promise<void> {
  if (!smsEnabled) throw new Error('SMS is not configured');

  const form = new URLSearchParams({ To: to, Body: body });
  // Messaging Service SIDs start with "MG"; a bare number goes in "From".
  if (TWILIO_FROM!.startsWith('MG')) form.set('MessagingServiceSid', TWILIO_FROM!);
  else form.set('From', TWILIO_FROM!);

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    }
  );

  if (!res.ok) {
    // Surface Twilio's own message (e.g. unverified trial number, bad From).
    const detail = await res.json().catch(() => null);
    const message = (detail as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
    throw new Error(`Twilio: ${message}`);
  }
}
