// Kalenderlogik für den Wochenplan. Daten sind reine Kalendertage als ISO-String „YYYY-MM-DD“.
// Gerechnet wird in UTC, damit Sommer-/Winterzeit keine Tage verschiebt.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const date = toUtc(value);
  return fromUtc(date) === value; // fängt z. B. 2026-02-30 ab
}

export function addDays(iso: string, days: number): string {
  const date = toUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

/** Tage von `from` bis `to` (negativ, wenn `to` davor liegt). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** ISO-Wochentag: 1 = Montag … 7 = Sonntag */
export function isoWeekday(iso: string): number {
  const day = toUtc(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

export function mondayOf(iso: string): string {
  return addDays(iso, 1 - isoWeekday(iso));
}

/** Die sieben Tage der Woche ab Montag. */
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Heute in deutscher Zeit (nicht UTC), als ISO-Datum. */
export function todayInBerlin(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** ISO-Kalenderwoche (KW) nach DIN 1355 / ISO 8601. */
export function isoWeekNumber(iso: string): number {
  const thursday = toUtc(addDays(mondayOf(iso), 3));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Montag der Woche aus dem URL-Parameter (?woche=YYYY-MM-DD), sonst die aktuelle Woche. */
export function resolveWeekParam(param: unknown, today: string = todayInBerlin()): string {
  return isIsoDate(param) ? mondayOf(param) : mondayOf(today);
}

const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKDAY_LONG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export function weekdayShort(iso: string): string {
  return WEEKDAY_SHORT[isoWeekday(iso) - 1];
}

export function weekdayLong(iso: string): string {
  return WEEKDAY_LONG[isoWeekday(iso) - 1];
}

/** „19.10.“ */
export function dayMonth(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}.`;
}

/** „KW 43 · 19.10.–25.10.2026“ */
export function weekLabel(monday: string): string {
  const sunday = addDays(monday, 6);
  return `KW ${isoWeekNumber(monday)} · ${dayMonth(monday)}–${dayMonth(sunday)}${sunday.slice(0, 4)}`;
}

/** „KW 43 · 19.10.–25.10.“ (ohne Jahr, für die Wochenleiste) */
export function weekRangeLabel(monday: string): string {
  return `KW ${isoWeekNumber(monday)} · ${dayMonth(monday)}–${dayMonth(addDays(monday, 6))}`;
}

/** „Diese Woche“, „Letzte Woche“, „Nächste Woche“, „In 2 Wochen“, „Vor 3 Wochen“ */
export function relativeWeekLabel(monday: string, today: string): string {
  const weeks = Math.round(daysBetween(mondayOf(today), mondayOf(monday)) / 7);
  if (weeks === 0) return "Diese Woche";
  if (weeks === -1) return "Letzte Woche";
  if (weeks === 1) return "Nächste Woche";
  return weeks > 1 ? `In ${weeks} Wochen` : `Vor ${-weeks} Wochen`;
}
