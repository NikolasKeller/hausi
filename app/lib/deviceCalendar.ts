import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';
import { storage } from './storage';

// ── Device calendar bridge ───────────────────────────────────────────────────
// Two directions:
//  1. addToDeviceCalendar — save an iykyk event into the phone's calendar.
//     Native uses the system "new event" sheet (no permission needed on
//     either platform); web downloads a universal .ics file.
//  2. getDeviceEvents — read the phone's own calendar entries so the app's
//     calendar tab can show them next to iykyk events. Read permission is
//     asked once, and the opt-in itself is remembered on the device.

const SYNC_KEY = 'iykyk.deviceCalendarSync';

export interface AddableEvent {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  openEnd: boolean;
  location: string;
  city: string;
  description: string;
}

export interface DeviceCalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  calendarTitle: string;
  color: string;
}

// Without a known end, block out two hours: a calendar entry needs SOME
// duration, and hosts can adjust it in the system sheet before saving.
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

function eventWindow(event: AddableEvent): { start: Date; end: Date } {
  const start = new Date(event.date);
  const end = event.endDate
    ? new Date(event.endDate)
    : new Date(start.getTime() + DEFAULT_DURATION_MS);
  return { start, end };
}

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildIcs(event: AddableEvent): string {
  const { start, end } = eventWindow(event);
  const location = [event.location, event.city]
    .filter(Boolean)
    .join(', ');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//iykyk//event//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@iykyk`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    location ? `LOCATION:${icsEscape(location)}` : '',
    event.description ? `DESCRIPTION:${icsEscape(event.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.filter(Boolean).join('\r\n');
}

// Returns true when the event was handed to the device calendar (or the .ics
// download started), false when the user backed out of the system sheet.
export async function addToDeviceCalendar(event: AddableEvent): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') return false;
    const link = document.createElement('a');
    link.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(event))}`;
    link.download = `${event.title.replace(/[^\w -]+/g, '').trim() || 'event'}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  }

  const { start, end } = eventWindow(event);
  const result = await Calendar.createEventInCalendarAsync({
    title: event.title,
    startDate: start,
    endDate: end,
    location: [event.location, event.city].filter(Boolean).join(', '),
    notes: event.description || undefined,
  });
  return result.action !== 'canceled';
}

export function deviceCalendarSupported(): boolean {
  return Platform.OS !== 'web';
}

// The user's opt-in for showing their own calendar inside the app.
export async function getDeviceSyncEnabled(): Promise<boolean> {
  try {
    return (await storage.getItemAsync(SYNC_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setDeviceSyncEnabled(enabled: boolean): Promise<void> {
  try {
    await storage.setItemAsync(SYNC_KEY, enabled ? '1' : '0');
  } catch {
    // Best-effort; worst case the toggle resets next launch.
  }
}

export async function requestDeviceCalendarAccess(): Promise<boolean> {
  if (!deviceCalendarSupported()) return false;
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

// The phone's own entries between `start` and `end`, across all its calendars.
// Returns [] when unsupported or permission is missing, so callers can render
// unconditionally.
export async function getDeviceEvents(
  start: Date,
  end: Date
): Promise<DeviceCalendarEvent[]> {
  if (!deviceCalendarSupported()) return [];
  try {
    const permission = await Calendar.getCalendarPermissionsAsync();
    if (permission.status !== 'granted') return [];
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (calendars.length === 0) return [];
    const events = await Calendar.getEventsAsync(
      calendars.map((calendar) => calendar.id),
      start,
      end
    );
    const titleById = new Map(calendars.map((calendar) => [calendar.id, calendar.title]));
    const colorById = new Map(calendars.map((calendar) => [calendar.id, calendar.color]));
    return events
      .map((event) => ({
        id: String(event.id),
        title: event.title || 'Busy',
        startDate: new Date(event.startDate).toISOString(),
        endDate: new Date(event.endDate).toISOString(),
        allDay: Boolean(event.allDay),
        calendarTitle: titleById.get(event.calendarId ?? '') ?? 'Calendar',
        color: colorById.get(event.calendarId ?? '') ?? '#8A8FA3',
      }))
      .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));
  } catch {
    return [];
  }
}
