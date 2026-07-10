export type EventDatePreset = 'any' | 'today' | 'tomorrow' | 'weekend';

export type EventDateFilter =
  | { kind: 'any' }
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'weekend' }
  | { kind: 'date'; date: string };

export interface EventDateRange {
  from: Date;
  to: Date;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Parse calendar input as a local date. `new Date("YYYY-MM-DD")` is UTC and can
// silently move the chosen day backwards in western time zones.
export function fromLocalDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// Every range is half-open [from, to). Building the boundaries with calendar
// constructors (rather than adding 24 hours) keeps them correct across DST.
export function getEventDateRange(
  filter: EventDateFilter,
  now: Date = new Date()
): EventDateRange | null {
  if (filter.kind === 'any') return null;

  const today = startOfLocalDay(now);
  let from: Date;

  if (filter.kind === 'today') {
    from = today;
  } else if (filter.kind === 'tomorrow') {
    from = addLocalDays(today, 1);
  } else if (filter.kind === 'weekend') {
    const weekday = today.getDay();
    // For event discovery, the weekend includes Friday night. Friday-Sunday
    // means the current weekend; Monday-Thursday means the upcoming one.
    const daysUntilFriday = weekday === 0 ? -2 : 5 - weekday;
    from = addLocalDays(today, daysUntilFriday);
  } else {
    const selected = fromLocalDateKey(filter.date);
    if (!selected) return null;
    from = selected;
  }

  const days = filter.kind === 'weekend' ? 3 : 1;
  return { from, to: addLocalDays(from, days) };
}

export function eventDateFilterLabel(filter: EventDateFilter): string {
  if (filter.kind === 'any') return 'Any date';
  if (filter.kind === 'today') return 'Today';
  if (filter.kind === 'tomorrow') return 'Tomorrow';
  if (filter.kind === 'weekend') return 'This weekend';

  const date = fromLocalDateKey(filter.date);
  return date
    ? date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Pick a date';
}
