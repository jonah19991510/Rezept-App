// Deutsche Zahlen- und Datumsformate (SPEC „Sprache & Einheiten“):
// 1.234,5 g · Mo, 19.10. · 3,49 €

const LOCALE = "de-DE";
const TIME_ZONE = "Europe/Berlin";

export function formatNumber(value: number, maxFractionDigits = 1): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: maxFractionDigits }).format(value);
}

export function formatGrams(value: number, maxFractionDigits = 1): string {
  return `${formatNumber(value, maxFractionDigits)} g`;
}

export function formatKcal(value: number): string {
  return `${formatNumber(Math.round(value), 0)} kcal`;
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: "EUR" }).format(value);
}

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** 19.10.2026 */
export function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(toDate(value));
}

/** Mo, 19.10. */
export function formatDayShort(value: Date | string): string {
  const date = toDate(value);
  const weekday = new Intl.DateTimeFormat(LOCALE, { weekday: "short", timeZone: TIME_ZONE })
    .format(date)
    .replace(/\.$/, "");
  const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: "2-digit", month: "2-digit", timeZone: TIME_ZONE }).format(date);
  return `${weekday}, ${dayMonth}`;
}
