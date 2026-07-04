import './env.js';

// Append-only audit ledger in Supabase (public."EventLedger"): every event
// lifecycle action is recorded there — which kind of event, by whom, when.
// Writes go through PostgREST with the service-role key and are
// fire-and-forget: the ledger must never break the user-facing request.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type LedgerAction = 'created' | 'updated' | 'canceled' | 'deleted';

export interface LedgerEntry {
  action: LedgerAction;
  eventSlug: string;
  eventTitle: string;
  category: string;
  isPublic: boolean;
  actorId: string;
  actorName: string;
}

export function ledger(entry: LedgerEntry): void {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.warn('[ledger] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — entry skipped');
    return;
  }
  fetch(`${SUPABASE_URL}/rest/v1/EventLedger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ ...entry, source: 'hono-dev' }),
  })
    .then((res) => {
      if (!res.ok) console.error(`[ledger] write failed: ${res.status}`);
    })
    .catch((e) => console.error('[ledger] write failed:', e));
}
