export type ExploreDateRangeParseResult =
  | { ok: true; range: { from: Date; to: Date } | null }
  | { ok: false; error: string };

function parseCanonicalInstant(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  // The app always sends canonical UTC instants. Requiring that shape avoids
  // date-only strings being interpreted in an unintended server time zone.
  return date.toISOString() === value ? date : null;
}

export function parseExploreDateRange(
  dateFrom: string | undefined,
  dateTo: string | undefined
): ExploreDateRangeParseResult {
  if (dateFrom === undefined && dateTo === undefined) {
    return { ok: true, range: null };
  }

  const from = parseCanonicalInstant(dateFrom);
  const to = parseCanonicalInstant(dateTo);
  if (!from || !to) {
    return {
      ok: false,
      error: 'dateFrom and dateTo must be canonical ISO timestamps',
    };
  }
  if (from.getTime() >= to.getTime()) {
    return { ok: false, error: 'dateFrom must be before dateTo' };
  }

  return { ok: true, range: { from, to } };
}
