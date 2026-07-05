import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

// Collapse the many ways one real phone number can be typed — spaces,
// punctuation, and (the big one) a national trunk "0" after the country code —
// down to a single canonical E.164 string, so the same person always maps to
// one account. Without this, a German mobile entered as "+49 0176…" and
// "+49 176…" became two separate users, because the DB unique constraint only
// compares the raw strings. libphonenumber knows the per-country rules: it
// drops the trunk 0 for DE/UK but correctly keeps Italy's leading 0.
//
// defaultCountry lets a number typed WITHOUT a country code (e.g. "4155551234")
// still fold to E.164 ("+14155551234") using that region's dialing rules. Pass
// the adder's own country here so a guest brought as a bare national number maps
// to the same canonical form as their account — otherwise it degrades to the
// digits-only fallback ("+4155551234"), which matches nothing. libphonenumber
// ignores defaultCountry when the input already carries a "+"/country code.
export function normalizePhone(raw: string, defaultCountry?: CountryCode): string {
  // Treat the international dialing prefix "00" as "+" so 0049… and +49… fold
  // to the same number (matters for legacy rows; new signups already send "+").
  const trimmed = raw.trim().replace(/^00/, '+');
  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
    // isPossible() is length-based and lenient, so it still canonicalizes
    // fictional test numbers (e.g. +1 555…) that the stricter isValid() rejects.
    if (parsed && parsed.isPossible()) return parsed.number;
  } catch {
    // Unparseable — fall back to a digits-only canonical form below.
  }
  const digits = trimmed.replace(/[^0-9]/g, '');
  return `+${digits}`;
}

// The ISO country of an already-canonical E.164 number, used as the defaultCountry
// hint above. Returns undefined for null/unparseable input (e.g. an account whose
// phone was never set).
export function phoneCountry(e164: string | null | undefined): CountryCode | undefined {
  if (!e164) return undefined;
  try {
    return parsePhoneNumberFromString(e164)?.country;
  } catch {
    return undefined;
  }
}
