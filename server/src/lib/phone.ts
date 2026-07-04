import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Collapse the many ways one real phone number can be typed — spaces,
// punctuation, and (the big one) a national trunk "0" after the country code —
// down to a single canonical E.164 string, so the same person always maps to
// one account. Without this, a German mobile entered as "+49 0176…" and
// "+49 176…" became two separate users, because the DB unique constraint only
// compares the raw strings. libphonenumber knows the per-country rules: it
// drops the trunk 0 for DE/UK but correctly keeps Italy's leading 0.
export function normalizePhone(raw: string): string {
  // Treat the international dialing prefix "00" as "+" so 0049… and +49… fold
  // to the same number (matters for legacy rows; new signups already send "+").
  const trimmed = raw.trim().replace(/^00/, '+');
  try {
    const parsed = parsePhoneNumberFromString(trimmed);
    // isPossible() is length-based and lenient, so it still canonicalizes
    // fictional test numbers (e.g. +1 555…) that the stricter isValid() rejects.
    if (parsed && parsed.isPossible()) return parsed.number;
  } catch {
    // Unparseable — fall back to a digits-only canonical form below.
  }
  const digits = trimmed.replace(/[^0-9]/g, '');
  return `+${digits}`;
}
