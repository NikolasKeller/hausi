import type { Category } from '../shared/types';

export interface ExtractedEventBrief {
  title?: string;
  date?: Date;
  dateSeed?: Date;
  category: Category;
  isPublic?: boolean;
  hideLocation?: boolean;
  maxGuests?: number | null;
  plusOneLimit?: number;
  paid?: boolean;
  price?: string;
}

const CATEGORY_TERMS: Record<Category, string[]> = {
  music: [
    'concert',
    'club',
    'dj',
    'dance',
    'disco',
    'gig',
    'karaoke',
    'music',
    'party',
    'rave',
    'tanzen',
    'musik',
  ],
  food: [
    'bbq',
    'brunch',
    'cook',
    'dinner',
    'drink',
    'food',
    'lunch',
    'pasta',
    'picnic',
    'potluck',
    'barbecue',
    'essen',
    'frühstück',
    'grillen',
  ],
  sports: [
    'basketball',
    'bike',
    'climb',
    'football',
    'hike',
    'run',
    'run club',
    'sport',
    'tennis',
    'training',
    'workout',
    'yoga',
    'lauf',
    'laufen',
    'wandern',
  ],
  arts: [
    'art',
    'cinema',
    'exhibition',
    'film',
    'gallery',
    'museum',
    'painting',
    'poetry',
    'theater',
    'workshop',
    'ausstellung',
    'kunst',
    'kino',
  ],
  community: [
    'birthday',
    'community',
    'friends',
    'game night',
    'meetup',
    'networking',
    'reunion',
    'wedding',
    'geburtstag',
    'hochzeit',
    'spieleabend',
  ],
  other: [],
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sonntag: 0,
  monday: 1,
  montag: 1,
  tuesday: 2,
  dienstag: 2,
  wednesday: 3,
  mittwoch: 3,
  thursday: 4,
  donnerstag: 4,
  friday: 5,
  freitag: 5,
  saturday: 6,
  samstag: 6,
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferCategory(text: string): Category {
  const lower = text.toLocaleLowerCase();
  let best: Category = 'other';
  let bestScore = 0;

  for (const [category, terms] of Object.entries(CATEGORY_TERMS) as [
    Category,
    string[],
  ][]) {
    const score = terms.reduce(
      (total, term) =>
        total + (new RegExp(`(^|\\W)${escapeRegExp(term)}(?=\\W|$)`, 'i').test(lower) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }

  return best;
}

function inferTitle(text: string): string | undefined {
  const patterns = [
    /(?:called|named|titled)\s+["“„]?([^"“”„\n,.!?]{2,120})/i,
    /(?:heißt|heisst|namens)\s+["“„]?([^"“”„\n,.!?]{2,120})/i,
    /(?:title|titel)\s*(?:is|ist|:)\s*["“„]?([^"“”„\n,.!?]{2,120})/i,
    /["“„]([^"“”„\n]{2,120})["”]/,
  ];

  for (const pattern of patterns) {
    const value = text.match(pattern)?.[1]?.trim();
    if (value) return value.slice(0, 120);
  }

  return undefined;
}

function inferTime(text: string): { hour: number; minute: number } | undefined {
  const lower = text.toLocaleLowerCase();
  const twelveHour = lower.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (twelveHour) {
    let hour = Number(twelveHour[1]) % 12;
    if (twelveHour[3] === 'pm') hour += 12;
    const minute = Number(twelveHour[2] ?? 0);
    if (minute <= 59) return { hour, minute };
  }

  const contextual = lower.match(
    /\b(?:at|um|gegen|@)\s*(\d{1,2})(?:(?::|\.)?(\d{2}))?\s*(?:uhr|h)?\b/
  );
  if (contextual) {
    const hour = Number(contextual[1]);
    const minute = Number(contextual[2] ?? 0);
    if (hour <= 23 && minute <= 59) return { hour, minute };
  }

  const clock = lower.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (clock) return { hour: Number(clock[1]), minute: Number(clock[2]) };

  return undefined;
}

function inferDatePart(text: string, now: Date): Date | undefined {
  const lower = text.toLocaleLowerCase();
  const date = new Date(now);
  date.setSeconds(0, 0);

  if (/(?:^|\W)(?:day after tomorrow|übermorgen|uebermorgen)(?=\W|$)/.test(lower)) {
    date.setDate(date.getDate() + 2);
    return date;
  }
  if (/\b(?:tomorrow|morgen)\b/.test(lower)) {
    date.setDate(date.getDate() + 1);
    return date;
  }
  if (/\b(?:today|tonight|heute|heute abend)\b/.test(lower)) return date;

  const iso = lower.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    const parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (
      parsed.getFullYear() === Number(iso[1]) &&
      parsed.getMonth() === Number(iso[2]) - 1 &&
      parsed.getDate() === Number(iso[3])
    ) {
      return parsed;
    }
  }

  const european = lower.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
  if (european) {
    const yearValue = european[3] ? Number(european[3]) : now.getFullYear();
    const year = yearValue < 100 ? 2000 + yearValue : yearValue;
    const parsed = new Date(year, Number(european[2]) - 1, Number(european[1]));
    if (
      parsed.getFullYear() === year &&
      parsed.getMonth() === Number(european[2]) - 1 &&
      parsed.getDate() === Number(european[1])
    ) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (!european[3] && parsed.getTime() < today.getTime()) {
        parsed.setFullYear(parsed.getFullYear() + 1);
      }
      return parsed;
    }
  }

  for (const [name, weekday] of Object.entries(WEEKDAYS)) {
    if (!new RegExp(`\\b${name}\\b`, 'i').test(lower)) continue;
    const daysAhead = (weekday - now.getDay() + 7) % 7 || 7;
    date.setDate(date.getDate() + daysAhead);
    return date;
  }

  return undefined;
}

function inferDate(text: string, now: Date): Pick<ExtractedEventBrief, 'date' | 'dateSeed'> {
  const datePart = inferDatePart(text, now);
  const time = inferTime(text);
  if (!datePart && !time) return {};

  const candidate = datePart ? new Date(datePart) : new Date(now);
  if (!datePart) candidate.setDate(candidate.getDate() + 1);
  candidate.setHours(time?.hour ?? 19, time?.minute ?? 0, 0, 0);

  if (datePart && time && candidate.getTime() > now.getTime()) return { date: candidate };
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1);
  return { dateSeed: candidate };
}

export function normalizeTicketPrice(input: string): string | null {
  const compact = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(compact)) return null;
  const amount = Number(compact);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount.toFixed(2).replace(/\.?0+$/, '');
}

function inferPrice(text: string): Pick<ExtractedEventBrief, 'paid' | 'price'> {
  const lower = text.toLocaleLowerCase();
  if (
    /\b(?:free (?:entry|event|admission)|entry is free|gratis|kostenlos(?:e[rsnm]?)?|eintritt frei)\b/.test(
      lower
    ) ||
    /(?:^|[,;]\s*)free(?:\s*[,;.!]|$)/.test(lower)
  ) {
    return { paid: false, price: '' };
  }

  const currency =
    lower.match(/(?:€|eur\s*)(\d+(?:[.,]\d{1,2})?)/)?.[1] ??
    lower.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur\b)/)?.[1] ??
    lower.match(
      /\b(?:ticket|tickets|entry|admission|eintritt|ticketpreis|preis)\s*(?:costs?|is|are|kostet|kosten|:)?\s*(\d+(?:[.,]\d{1,2})?)/
    )?.[1];
  const price = currency ? normalizeTicketPrice(currency) : null;
  if (price) return { paid: true, price };
  if (/\b(?:paid|ticketed|tickets required|kostenpflichtig)\b/.test(lower)) {
    return { paid: true };
  }

  return {};
}

function inferCapacity(text: string): Pick<ExtractedEventBrief, 'maxGuests'> {
  const lower = text.toLocaleLowerCase();
  if (/\b(?:unlimited|no guest limit|no capacity limit|unbegrenzt|kein gästelimit)\b/.test(lower)) {
    return { maxGuests: null };
  }

  const amount =
    lower.match(
      /\b(?:maximum|max|up to|for|with|bis zu|höchstens|fuer|für|mit)\s*(\d{1,5})\s*(?:guests?|people|persons?|spots?|gäste|gaeste|personen|leute|plätze|plaetze)\b/
    )?.[1] ??
    lower.match(
      /\b(\d{1,5})\s*(?:guests?|people|persons?|friends?|spots?|gäste|gaeste|personen|leute|freunde|plätze|plaetze)\b/
    )?.[1];
  if (!amount) return {};
  const maxGuests = Number(amount);
  return maxGuests >= 1 && maxGuests <= 10000 ? { maxGuests } : {};
}

function inferPlusOnes(text: string): Pick<ExtractedEventBrief, 'plusOneLimit'> {
  const lower = text.toLocaleLowerCase();
  if (
    /\b(?:no plus[- ]?ones?|no \+1s?|without plus[- ]?ones?|keine begleitpersonen|ohne begleitung)\b/.test(
      lower
    )
  ) {
    return { plusOneLimit: 0 };
  }

  const explicit =
    lower.match(
      /\b(?:up to|max(?:imum)?|bis zu|höchstens)?\s*(\d{1,2})\s*(?:plus[- ]?ones?|begleitpersonen)\b/
    )?.[1] ?? lower.match(/(?:^|\s)\+(\d{1,2})s?\b/)?.[1];
  if (explicit) {
    const limit = Number(explicit);
    if (limit >= 0 && limit <= 10) return { plusOneLimit: limit };
  }
  if (
    /(?:\bplus[- ]?ones? (?:welcome|allowed)|(?:^|\s)\+1s? (?:welcome|allowed)\b|\bbring a friend\b|\bbegleitung erlaubt\b)/.test(
      lower
    )
  ) {
    return { plusOneLimit: 1 };
  }

  return {};
}

function inferVisibility(
  text: string
): Pick<ExtractedEventBrief, 'isPublic' | 'hideLocation'> {
  const lower = text.toLocaleLowerCase();
  const result: Pick<ExtractedEventBrief, 'isPublic' | 'hideLocation'> = {};

  if (
    /(?:^|\W)(?:private|invite[- ]?only|invitation only|closed event|privat(?:e[rsnm]?)?|nur auf einladung|geschlossene veranstaltung)(?=\W|$)/.test(
      lower
    )
  ) {
    result.isPublic = false;
  } else if (
    /(?:^|\W)(?:public|open to (?:all|everyone)|everyone welcome|öffentlich(?:e[rsnm]?)?|offen für alle|alle willkommen)(?=\W|$)/.test(
      lower
    )
  ) {
    result.isPublic = true;
  }

  if (
    /\b(?:hide (?:the )?(?:address|location)|address after rsvp|reveal(?:ed)? after rsvp|adresse erst nach|ort verbergen)\b/.test(
      lower
    )
  ) {
    result.hideLocation = true;
  } else if (
    /\b(?:show (?:the )?(?:address|location)|address visible|adresse anzeigen|ort anzeigen)\b/.test(
      lower
    )
  ) {
    result.hideLocation = false;
  }

  return result;
}

export function extractEventBrief(text: string, now = new Date()): ExtractedEventBrief {
  const title = inferTitle(text);
  return {
    category: inferCategory(text),
    ...(title ? { title } : {}),
    ...inferDate(text, now),
    ...inferVisibility(text),
    ...inferCapacity(text),
    ...inferPlusOnes(text),
    ...inferPrice(text),
  };
}
