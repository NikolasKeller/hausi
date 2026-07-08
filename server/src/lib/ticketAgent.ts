import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Locator, type Page } from 'playwright';
import { UPLOAD_DIR } from './uploads.js';
import type { AgentWallet } from '../../../app/shared/types.js';

// Ticket PDFs live next to the image uploads, in their own subfolder, and are
// served back out as "/uploads/tickets/<file>.pdf".
export const TICKET_DIR = join(UPLOAD_DIR, 'tickets');
mkdirSync(TICKET_DIR, { recursive: true });

// ⚠️ PROTOTYPE: this agent receives raw card data in memory for the duration
// of one checkout run. It must never log it, and nothing here persists it.

// The wallet keys the agent can type into a form, plus derived name parts.
type FillKey = keyof AgentWallet | 'firstName' | 'lastName';

// Attribute patterns for recognizing checkout form fields generically —
// matched against name/id/placeholder/aria-label/autocomplete of visible
// <input> elements. English + German. Order matters: card + specific fields
// before the generic "name" so a "cardholder name" doesn't grab the buyer name.
const FIELD_MATCHERS: { key: FillKey; pattern: RegExp }[] = [
  { key: 'cardNumber', pattern: /cc.?num|card.?num|cardnumber|kartennummer|^cc$|credit.?card/i },
  { key: 'cardExpiry', pattern: /cc.?exp|expir|expiry|valid|ablauf|mm.?\/.?(yy|jj)/i },
  { key: 'cardCvc', pattern: /cvc|cvv|csc|security.?code|prüfziffer|kartenprüf/i },
  { key: 'email', pattern: /e.?mail/i },
  { key: 'dateOfBirth', pattern: /birth|dob|geburt|geb.?datum|geburtstag/i },
  { key: 'address', pattern: /address|street|line1|strasse|straße|anschrift|wohnort/i },
  { key: 'firstName', pattern: /first.?name|given.?name|vorname/i },
  { key: 'lastName', pattern: /last.?name|family.?name|surname|nachname/i },
  { key: 'name', pattern: /card.?holder|full.?name|^name$|your.?name|inhaber/i },
];

// Extra autocomplete hints (the most reliable signal when present).
const AUTOCOMPLETE_HINTS: Record<string, FillKey> = {
  'cc-number': 'cardNumber',
  'cc-exp': 'cardExpiry',
  'cc-csc': 'cardCvc',
  'cc-name': 'name',
  email: 'email',
  name: 'name',
  'given-name': 'firstName',
  'family-name': 'lastName',
  bday: 'dateOfBirth',
  'street-address': 'address',
  'address-line1': 'address',
};

const BUY_BUTTON = /buy|checkout|purchase|pay now|pay\b|kaufen|bestellen|zur kasse|complete order|place order|confirm|get tickets?/i;

const BOT_PROTECTION =
  /cloudflare|captcha|are you human|access denied|unusual traffic|verify you are|robot|hold on|checking your browser/i;

// Signals the event is sold out — checked against page text and against the
// demo shop's explicit [data-sold-out] marker.
const SOLD_OUT = /sold\s?out|ausverkauft|no (more )?tickets|tickets? (are )?(no longer|not) available|restlos/i;

export interface CheckoutResult {
  ok: boolean;
  // Human-readable outcome/failure summary (safe to store & show — no card data).
  reason: string;
  filledFields: string[];
}

export interface AvailabilityResult {
  // 'available' → tickets can be bought; 'soldout' → none; 'unknown' → the page
  // couldn't be assessed (bot protection, load failure, no recognizable form).
  status: 'available' | 'soldout' | 'unknown';
  reason: string;
}

function valueFor(key: FillKey, wallet: AgentWallet): string {
  if (key === 'firstName') return wallet.name.split(/\s+/)[0] ?? wallet.name;
  if (key === 'lastName') return wallet.name.split(/\s+/).slice(1).join(' ') || wallet.name;
  return wallet[key];
}

// Classify one input by its attributes; returns which wallet field it wants.
async function classifyInput(input: Locator): Promise<FillKey | null> {
  const attrs = await input.evaluate((el) => ({
    name: el.getAttribute('name') ?? '',
    id: el.id,
    placeholder: el.getAttribute('placeholder') ?? '',
    aria: el.getAttribute('aria-label') ?? '',
    autocomplete: el.getAttribute('autocomplete') ?? '',
    type: el.getAttribute('type') ?? 'text',
  }));
  if (['hidden', 'submit', 'button', 'checkbox', 'radio', 'file'].includes(attrs.type)) return null;
  const auto = AUTOCOMPLETE_HINTS[attrs.autocomplete.toLowerCase()];
  if (auto) return auto;
  if (attrs.type === 'email') return 'email';
  const haystack = `${attrs.name} ${attrs.id} ${attrs.placeholder} ${attrs.aria}`;
  for (const { key, pattern } of FIELD_MATCHERS) {
    if (pattern.test(haystack)) return key;
  }
  return null;
}

// Fill every recognizable field on the page. Returns which wallet keys landed.
async function fillCheckoutForm(page: Page, wallet: AgentWallet): Promise<string[]> {
  const filled: string[] = [];
  const inputs = page.locator('input:visible');
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    try {
      const key = await classifyInput(input);
      if (!key) continue;
      await input.fill(valueFor(key, wallet), { timeout: 3000 });
      if (!filled.includes(key)) filled.push(key);
    } catch {
      // Field not fillable (readonly, detached mid-run…) — move on.
    }
  }
  return filled;
}

async function findBuyButton(page: Page): Promise<Locator | null> {
  const candidates = page.locator('button:visible, input[type="submit"]:visible, a[role="button"]:visible');
  const count = await candidates.count();
  for (let i = 0; i < count; i++) {
    const el = candidates.nth(i);
    try {
      const text = ((await el.textContent()) ?? (await el.getAttribute('value')) ?? '').trim();
      if (BUY_BUTTON.test(text)) return el;
    } catch {
      // ignore
    }
  }
  return null;
}

// Open a page and run a shared preflight: load, bot-protection + sold-out
// checks. Returns the live page (caller must close the browser) or an error.
async function openPage(browser: Awaited<ReturnType<typeof chromium.launch>>, url: string) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  } catch {
    return { page, loadError: 'Could not load the page (timeout).' as string };
  }
  return { page, loadError: null as string | null };
}

// Step 2 of the flow: verify ticket availability WITHOUT buying anything. The
// agent opens the checkout/ticket page and reports whether tickets are on sale.
export async function checkAvailability(url: string): Promise<AvailabilityResult> {
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, loadError } = await openPage(browser, url);
    if (loadError) return { status: 'unknown', reason: loadError };

    const bodyText = (await page.locator('body').textContent().catch(() => '')) ?? '';
    if (BOT_PROTECTION.test(bodyText)) {
      return {
        status: 'unknown',
        reason: 'The ticket site is protected against automated visitors (bot protection / captcha).',
      };
    }

    // The demo shop states availability explicitly; trust that marker first.
    const explicitSoldOut = await page.locator('[data-sold-out]').count().catch(() => 0);
    if (explicitSoldOut > 0 || SOLD_OUT.test(bodyText)) {
      return { status: 'soldout', reason: 'This event is sold out — no tickets available.' };
    }

    const buy = await findBuyButton(page);
    if (buy) return { status: 'available', reason: 'Tickets are available.' };

    return {
      status: 'unknown',
      reason:
        'Could not confirm availability automatically (no recognizable buy button — often behind bot protection).',
    };
  } catch (e) {
    return { status: 'unknown', reason: e instanceof Error ? e.message : 'Availability check failed' };
  } finally {
    await browser.close().catch(() => {});
  }
}

// Drive one checkout attempt end to end.
//  - allowPurchase=false (real providers): fill what we can, then STOP before
//    any final buy click — prototype safety, we never complete real purchases.
//  - allowPurchase=true (demo provider): click buy, wait for the confirmation
//    marker, print the confirmation page to `pdfFile`.
export async function runCheckout(opts: {
  url: string;
  wallet: AgentWallet;
  allowPurchase: boolean;
  pdfFile?: string;
}): Promise<CheckoutResult> {
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, loadError } = await openPage(browser, opts.url);
    if (loadError) return { ok: false, reason: loadError, filledFields: [] };

    const bodyText = (await page.locator('body').textContent().catch(() => '')) ?? '';
    if (BOT_PROTECTION.test(bodyText)) {
      return {
        ok: false,
        reason: 'The ticket site is protected against automated visitors (bot protection / captcha).',
        filledFields: [],
      };
    }

    // Re-check availability at purchase time — it may have sold out since the
    // availability step, and we must never fake a purchase.
    const explicitSoldOut = await page.locator('[data-sold-out]').count().catch(() => 0);
    if (explicitSoldOut > 0 || SOLD_OUT.test(bodyText)) {
      return { ok: false, reason: 'This event sold out before the purchase completed.', filledFields: [] };
    }

    const filled = await fillCheckoutForm(page, opts.wallet);

    if (!opts.allowPurchase) {
      // Real provider: by design we stop right here, before any purchase.
      const detail = filled.length
        ? `Recognized and filled ${filled.length} checkout field(s): ${filled.join(', ')}.`
        : 'No recognizable checkout form found (payment fields often live in embedded iframes with bot protection).';
      return {
        ok: false,
        reason: `Stopped before completing a real purchase (prototype safety). ${detail} Use the demo checkout for the full flow.`,
        filledFields: filled,
      };
    }

    if (filled.length === 0) {
      return { ok: false, reason: 'No checkout form fields found on the page.', filledFields: filled };
    }

    const buy = await findBuyButton(page);
    if (!buy) {
      return { ok: false, reason: 'No buy/checkout button found on the page.', filledFields: filled };
    }
    await buy.click({ timeout: 5000 });

    // The demo confirmation page marks itself with [data-ticket-confirmed].
    try {
      await page.waitForSelector('[data-ticket-confirmed]', { timeout: 15_000 });
    } catch {
      return {
        ok: false,
        reason: 'Purchase was submitted but no confirmation page appeared.',
        filledFields: filled,
      };
    }

    if (opts.pdfFile) {
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: opts.pdfFile, format: 'A4', printBackground: true });
    }
    return { ok: true, reason: 'Ticket purchased on the demo checkout.', filledFields: filled };
  } finally {
    await browser.close().catch(() => {});
  }
}
