/**
 * Day keys are YYYY-MM-DD strings in the viewer's local timezone.
 * Arithmetic on keys goes through UTC so DST shifts never skip or repeat a day.
 */

export type DayKey = string;

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function toDayKey(date: Date): DayKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function keyToUtc(key: DayKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToKey(ms: number): DayKey {
  return new Date(ms).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

export function addDays(key: DayKey, delta: number): DayKey {
  return utcToKey(keyToUtc(key) + delta * DAY_MS);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((keyToUtc(b) - keyToUtc(a)) / DAY_MS);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(key: DayKey): number {
  return new Date(keyToUtc(key)).getUTCDay();
}

/** Inclusive list of day keys from `start` to `end`. Empty when start > end. */
export function dayRange(start: DayKey, end: DayKey): DayKey[] {
  const n = daysBetween(start, end);
  const out: DayKey[] = [];
  for (let i = 0; i <= n; i++) out.push(addDays(start, i));
  return out;
}

export function maxKey(a: DayKey, b: DayKey): DayKey {
  return a > b ? a : b;
}
