// Getränketracker (Sport & Gesundheit, 27.10.2026): reine Logik ohne Datenbank.
// Mengen in ml, Koffein in mg, Zucker in g. Tage sind Kalendertage in deutscher Zeit („YYYY-MM-DD“).

import { formatNumber } from "@/lib/format";
import { addDays, daysBetween, isoWeekNumber, mondayOf } from "./week";

// ---------------------------------------------------------------------------
// Farben, Startliste, Schnellmengen
// ---------------------------------------------------------------------------

/** Farben für Getränke: kräftig genug für Chips und Balken in Hell und Dunkel. */
export const DRINK_COLORS = {
  blau: { label: "Blau", value: "#3b82f6" },
  hellblau: { label: "Hellblau", value: "#38bdf8" },
  tuerkis: { label: "Türkis", value: "#14b8a6" },
  gruen: { label: "Grün", value: "#22a35a" },
  oliv: { label: "Oliv", value: "#84a32b" },
  gelb: { label: "Gelb", value: "#e0b100" },
  orange: { label: "Orange", value: "#f08a24" },
  rot: { label: "Rot", value: "#e04444" },
  pink: { label: "Pink", value: "#e0559a" },
  lila: { label: "Lila", value: "#8b5cf6" },
  braun: { label: "Braun", value: "#a0703f" },
  dunkelbraun: { label: "Dunkelbraun", value: "#7a5236" },
  creme: { label: "Creme", value: "#d4bc8a" },
  grau: { label: "Grau", value: "#8a8f98" },
} as const;

export type DrinkColor = keyof typeof DRINK_COLORS;
export const DRINK_COLOR_KEYS = Object.keys(DRINK_COLORS) as DrinkColor[];

/** CSS-Farbe zu einem gespeicherten Schlüssel (unbekannte Schlüssel grau). */
export function drinkColor(key: string): string {
  return (DRINK_COLORS as Record<string, { value: string }>)[key]?.value ?? DRINK_COLORS.grau.value;
}

export const DEFAULT_GOAL_ML = 2000;

/** Trinktag fürs Tempo: von 7 bis 21 Uhr steigt das Soll gleichmäßig bis zum Ziel. */
export const PACE_START_HOUR = 7;
export const PACE_END_HOUR = 21;
/** Markierungen auf dem Fortschrittsbalken (Uhrzeit → Soll). */
export const PACE_MARKS = [10, 13, 16, 19];

export const QUICK_AMOUNTS = [
  { ml: 250, label: "Glas" },
  { ml: 330, label: "Dose" },
  { ml: 500, label: "Flasche" },
  { ml: 750, label: "Flasche" },
  { ml: 1000, label: "Liter" },
] as const;

/** Orientierung für Koffein: bis 400 mg am Tag gelten für gesunde Erwachsene als unbedenklich (EFSA). */
export const CAFFEINE_LIMIT_MG = 400;

export type DrinkIngredient = {
  name: string;
  ml: number;
  /** mg pro 100 ml */
  caffeine: number;
  /** g pro 100 ml */
  sugar: number;
  /** zählt als Wasser */
  water: boolean;
};

export type Drink = {
  id: string;
  name: string;
  color: string;
  caffeinePer100: number;
  sugarPer100: number;
  waterPercent: number;
  /** null = einfaches Getränk */
  ingredients: DrinkIngredient[] | null;
  position: number;
};

/** Startliste beim ersten Öffnen (Richtwerte; jeder kann sie ändern). */
export const DEFAULT_DRINKS: Omit<Drink, "id">[] = [
  { name: "Wasser", color: "blau", caffeinePer100: 0, sugarPer100: 0, waterPercent: 100, ingredients: null, position: 0 },
  { name: "Sprudelwasser", color: "hellblau", caffeinePer100: 0, sugarPer100: 0, waterPercent: 100, ingredients: null, position: 1 },
  { name: "Kaffee", color: "braun", caffeinePer100: 50, sugarPer100: 0, waterPercent: 0, ingredients: null, position: 2 },
  { name: "Espresso", color: "dunkelbraun", caffeinePer100: 130, sugarPer100: 0, waterPercent: 0, ingredients: null, position: 3 },
  { name: "Schwarzer Tee", color: "oliv", caffeinePer100: 20, sugarPer100: 0, waterPercent: 0, ingredients: null, position: 4 },
  { name: "Kräutertee", color: "gruen", caffeinePer100: 0, sugarPer100: 0, waterPercent: 100, ingredients: null, position: 5 },
  { name: "Cola", color: "rot", caffeinePer100: 10, sugarPer100: 10.6, waterPercent: 0, ingredients: null, position: 6 },
  { name: "Cola Zero", color: "grau", caffeinePer100: 12, sugarPer100: 0, waterPercent: 0, ingredients: null, position: 7 },
  { name: "Energy Drink", color: "gelb", caffeinePer100: 32, sugarPer100: 11, waterPercent: 0, ingredients: null, position: 8 },
  { name: "Saftschorle", color: "orange", caffeinePer100: 0, sugarPer100: 5, waterPercent: 0, ingredients: null, position: 9 },
  { name: "Milch 1,5 %", color: "creme", caffeinePer100: 0, sugarPer100: 4.8, waterPercent: 0, ingredients: null, position: 10 },
];

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Werte eines Mischgetränks pro 100 ml aus seinen Zutaten (z. B. 300 ml Milch + 200 ml Wasser → 40 % Wasser). */
export function mixValues(ingredients: DrinkIngredient[]): { totalMl: number; caffeinePer100: number; sugarPer100: number; waterPercent: number } {
  const totalMl = ingredients.reduce((s, i) => s + i.ml, 0);
  if (totalMl <= 0) return { totalMl: 0, caffeinePer100: 0, sugarPer100: 0, waterPercent: 0 };
  const caffeine = ingredients.reduce((s, i) => s + (i.ml * i.caffeine) / 100, 0);
  const sugar = ingredients.reduce((s, i) => s + (i.ml * i.sugar) / 100, 0);
  const water = ingredients.reduce((s, i) => s + (i.water ? i.ml : 0), 0);
  return {
    totalMl,
    caffeinePer100: round1((caffeine / totalMl) * 100),
    sugarPer100: round1((sugar / totalMl) * 100),
    waterPercent: round1((water / totalMl) * 100),
  };
}

/** Was ein Eintrag festhält: Koffein, Zucker und Wasser für die getrunkene Menge. */
export function entryValues(drink: Pick<Drink, "caffeinePer100" | "sugarPer100" | "waterPercent">, ml: number) {
  return {
    caffeine: round1((drink.caffeinePer100 * ml) / 100),
    sugar: round1((drink.sugarPer100 * ml) / 100),
    water: round1((drink.waterPercent * ml) / 100),
  };
}

// ---------------------------------------------------------------------------
// Anzeige
// ---------------------------------------------------------------------------

/** „0,50 l“ (Menge) bzw. mit `digits = 1` „2,0 l“ (Ziel). */
export function formatLiters(ml: number, digits = 2): string {
  return `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(ml / 1000)} l`;
}

/** Schnellmenge als „0,25“ (ohne Einheit). */
export function quickLabel(ml: number): string {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: ml % 1000 === 0 ? 1 : 2, maximumFractionDigits: 2 }).format(ml / 1000);
}

export function formatMg(mg: number): string {
  return `${formatNumber(Math.round(mg), 0)} mg`;
}

/** „45 mg Koffein · 10,6 g Zucker“ bzw. „koffeinfrei · zuckerfrei“ (pro 100 ml). */
export function drinkFacts(drink: Pick<Drink, "caffeinePer100" | "sugarPer100">): string {
  const caffeine = drink.caffeinePer100 > 0 ? `${formatNumber(drink.caffeinePer100, 1)} mg Koffein` : "koffeinfrei";
  const sugar = drink.sugarPer100 > 0 ? `${formatNumber(drink.sugarPer100, 1)} g Zucker` : "zuckerfrei";
  return `${caffeine} · ${sugar}`;
}

/** „1.11.“ (ohne führende Null beim Tag, wie in der Kalenderwoche „26.10.–1.11.“) */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${m}.`;
}

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** „Dienstag, 27. Oktober“ */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = new Intl.DateTimeFormat("de-DE", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  return `${weekday}, ${d}. ${MONTHS[m - 1]}`;
}

// ---------------------------------------------------------------------------
// Einträge
// ---------------------------------------------------------------------------

export type DrinkEntry = {
  id: string;
  drinkId: string | null;
  name: string;
  color: string;
  /** Zeitpunkt (ISO, UTC) */
  at: string;
  /** Kalendertag in deutscher Zeit */
  date: string;
  /** Minuten seit Mitternacht in deutscher Zeit */
  minutes: number;
  ml: number;
  caffeine: number;
  sugar: number;
  water: number;
};

/** Getränk eines Eintrags für Gruppierungen: das gespeicherte Getränk, sonst (gelöscht) sein Name. */
export function entryKey(e: Pick<DrinkEntry, "drinkId" | "name">): string {
  return e.drinkId ?? `name:${e.name}`;
}

/** „14:05“ */
export function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function sumEntries(entries: Pick<DrinkEntry, "ml" | "caffeine" | "sugar" | "water">[]) {
  const sum = { ml: 0, caffeine: 0, sugar: 0, water: 0, count: 0 };
  for (const e of entries) {
    sum.ml += e.ml;
    sum.caffeine += e.caffeine;
    sum.sugar += e.sugar;
    sum.water += e.water;
    sum.count += 1;
  }
  return sum;
}

/** Anteile je Getränk an einer Liste (für gestapelte Balken), größter zuerst. */
export function byDrink(entries: DrinkEntry[]): { key: string; name: string; color: string; ml: number; caffeine: number; count: number }[] {
  const map = new Map<string, { key: string; name: string; color: string; ml: number; caffeine: number; count: number }>();
  for (const e of entries) {
    const key = entryKey(e);
    const row = map.get(key) ?? { key, name: e.name, color: e.color, ml: 0, caffeine: 0, count: 0 };
    row.ml += e.ml;
    row.caffeine += e.caffeine;
    row.count += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.ml - a.ml || a.name.localeCompare(b.name, "de"));
}

// ---------------------------------------------------------------------------
// Tempo über den Tag
// ---------------------------------------------------------------------------

/** Soll zu einer Uhrzeit: von 7 bis 21 Uhr gleichmäßig von 0 bis zum Ziel. */
export function paceTarget(goalMl: number, minutes: number): number {
  const start = PACE_START_HOUR * 60;
  const end = PACE_END_HOUR * 60;
  const share = Math.min(1, Math.max(0, (minutes - start) / (end - start)));
  return Math.round(goalMl * share);
}

export type PaceTone = "done" | "good" | "behind" | "far";

/** Wie weit man vor oder hinter dem Soll für jetzt liegt und wie viel noch fehlt. */
export function paceStatus(amountMl: number, goalMl: number, minutes: number) {
  const target = paceTarget(goalMl, minutes);
  const diff = amountMl - target;
  const remaining = Math.max(0, goalMl - amountMl);
  const tone: PaceTone = remaining === 0 ? "done" : diff >= -100 ? "good" : diff >= -400 ? "behind" : "far";
  return { target, diff, remaining, tone };
}

/** Satz zum Tempo, z. B. „0,30 l hinter dem Soll für 14:30 Uhr · noch 1,50 l bis zum Ziel“. */
export function paceText(amountMl: number, goalMl: number, minutes: number): string {
  const { diff, remaining, tone } = paceStatus(amountMl, goalMl, minutes);
  if (tone === "done") return amountMl > goalMl ? `Ziel erreicht · ${formatLiters(amountMl - goalMl)} darüber` : "Ziel erreicht";
  const rest = `noch ${formatLiters(remaining)} bis zum Ziel`;
  if (minutes < PACE_START_HOUR * 60) return `Der Tag fängt gerade an · ${rest}`;
  const time = `${clock(minutes)} Uhr`;
  if (Math.abs(diff) < 50) return `Genau im Soll für ${time} · ${rest}`;
  return `${formatLiters(Math.abs(diff))} ${diff < 0 ? "hinter dem" : "vor dem"} Soll für ${time} · ${rest}`;
}

// ---------------------------------------------------------------------------
// Zeiträume und Statistik
// ---------------------------------------------------------------------------

export type StatsView = "woche" | "monat";

/** Erster und letzter Tag der Woche bzw. des Monats um `date`. */
export function periodRange(view: StatsView, date: string): { from: string; to: string } {
  if (view === "woche") {
    const from = mondayOf(date);
    return { from, to: addDays(from, 6) };
  }
  const [y, m] = date.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from, to: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}

/** Gleicher Tag im Zeitraum davor/danach (Woche ±7 Tage, Monat ±1 Monat, Tag höchstens Monatsende). */
export function shiftPeriod(view: StatsView, date: string, step: number): string {
  if (view === "woche") return addDays(date, 7 * step);
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + step, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** „KW 44 · 26.10.–1.11.“ bzw. „Oktober 2026“ */
export function periodLabel(view: StatsView, date: string): string {
  const { from, to } = periodRange(view, date);
  if (view === "woche") return `KW ${isoWeekNumber(from)} · ${shortDate(from)}–${shortDate(to)}`;
  return `${MONTHS[Number(from.slice(5, 7)) - 1]} ${from.slice(0, 4)}`;
}

export function daysOf(from: string, to: string): string[] {
  return Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i));
}

export type DayTotal = { date: string; ml: number; caffeine: number; sugar: number; count: number };

/** Summen je Tag für alle Tage des Zeitraums (auch leere). */
export function dayTotals(entries: DrinkEntry[], days: string[]): DayTotal[] {
  const map = new Map(days.map((d) => [d, { date: d, ml: 0, caffeine: 0, sugar: 0, count: 0 }]));
  for (const e of entries) {
    const row = map.get(e.date);
    if (!row) continue;
    row.ml += e.ml;
    row.caffeine += e.caffeine;
    row.sugar += e.sugar;
    row.count += 1;
  }
  return [...map.values()];
}

/** Kennzahlen eines Zeitraums. Ø nur über Tage mit Einträgen, „Ziel erreicht“ über die Tage bis heute. */
export function periodSummary(totals: DayTotal[], goalMl: number, today: string) {
  const elapsed = totals.filter((t) => t.date <= today);
  const withEntries = totals.filter((t) => t.count > 0);
  const total = totals.reduce((s, t) => s + t.ml, 0);
  const best = withEntries.reduce<DayTotal | null>((b, t) => (!b || t.ml > b.ml ? t : b), null);
  return {
    total,
    avg: withEntries.length ? Math.round(total / withEntries.length) : null,
    daysWithEntries: withEntries.length,
    reached: elapsed.filter((t) => t.ml >= goalMl).length,
    elapsed: elapsed.length,
    best,
  };
}

/** Tage am Stück mit erreichtem Ziel bis heute (heute zählt, wenn erreicht; sonst endet die Serie gestern). */
export function goalStreak(totalsByDate: Map<string, number>, goalMl: number, today: string): number {
  let day = (totalsByDate.get(today) ?? 0) >= goalMl ? today : addDays(today, -1);
  let streak = 0;
  while ((totalsByDate.get(day) ?? 0) >= goalMl) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

/** Koffein-Kennzahlen eines Zeitraums (Ø über Tage mit Einträgen; koffeinfrei = Tage mit Einträgen ohne Koffein). */
export function caffeineSummary(totals: DayTotal[]) {
  const withEntries = totals.filter((t) => t.count > 0);
  const total = totals.reduce((s, t) => s + t.caffeine, 0);
  const max = withEntries.reduce<DayTotal | null>((b, t) => (!b || t.caffeine > b.caffeine ? t : b), null);
  return {
    total,
    avg: withEntries.length ? total / withEntries.length : null,
    max: max && max.caffeine > 0 ? max : null,
    over: withEntries.filter((t) => t.caffeine > CAFFEINE_LIMIT_MG).length,
    free: withEntries.filter((t) => t.caffeine === 0).length,
  };
}

/** Rangliste der Getränke mit Anzahl, Menge und Anteil an der Menge. */
export function drinkRanking(entries: DrinkEntry[]) {
  const total = entries.reduce((s, e) => s + e.ml, 0);
  return byDrink(entries).map((r) => ({ ...r, share: total ? r.ml / total : 0 }));
}

/** Koffeinquellen: Anteil jedes Getränks am Koffein. */
export function caffeineSources(entries: DrinkEntry[]) {
  const rows = byDrink(entries.filter((e) => e.caffeine > 0)).sort((a, b) => b.caffeine - a.caffeine);
  const total = rows.reduce((s, r) => s + r.caffeine, 0);
  return rows.map((r) => ({ ...r, share: total ? r.caffeine / total : 0 }));
}

export type DaySlot = "morgens" | "mittags" | "nachmittags" | "abends" | "nachts";

export const DAY_SLOTS: { key: DaySlot; label: string; from: number; to: number }[] = [
  { key: "morgens", label: "Morgens", from: 5, to: 11 },
  { key: "mittags", label: "Mittags", from: 11, to: 15 },
  { key: "nachmittags", label: "Nachmittags", from: 15, to: 18 },
  { key: "abends", label: "Abends", from: 18, to: 23 },
  { key: "nachts", label: "Nachts", from: 23, to: 5 },
];

export function slotOf(minutes: number): DaySlot {
  const hour = Math.floor(minutes / 60);
  return DAY_SLOTS.find((s) => s.key !== "nachts" && hour >= s.from && hour < s.to)?.key ?? "nachts";
}

/** Menge je Tageszeit mit Anteil; „Nachts“ nur, wenn dort etwas getrunken wurde. */
export function timeOfDay(entries: DrinkEntry[]) {
  const total = entries.reduce((s, e) => s + e.ml, 0);
  return DAY_SLOTS.map((slot) => {
    const items = entries.filter((e) => slotOf(e.minutes) === slot.key);
    const ml = items.reduce((s, e) => s + e.ml, 0);
    return { ...slot, ml, share: total ? ml / total : 0, entries: items };
  }).filter((s) => s.key !== "nachts" || s.ml > 0);
}

// ---------------------------------------------------------------------------
// Tipps aus den eigenen Daten
// ---------------------------------------------------------------------------

export type DrinkTip = { tone: "good" | "hint"; title: string; text: string };

/**
 * Persönliche Hinweise aus den letzten 14 Tagen (`entries` dieser Tage, `days` die Tage selbst bis heute).
 * Gibt höchstens die Hinweise zurück, für die es genug Daten gibt.
 */
export function personalTips(entries: DrinkEntry[], days: string[], goalMl: number): DrinkTip[] {
  const totals = dayTotals(entries, days);
  const tracked = totals.filter((t) => t.count > 0);
  if (tracked.length < 3) return [];
  const tips: DrinkTip[] = [];
  const reached = tracked.filter((t) => t.ml >= goalMl).length;
  const avg = tracked.reduce((s, t) => s + t.ml, 0) / tracked.length;

  if (reached / tracked.length >= 0.7) {
    tips.push({ tone: "good", title: "Ziel gut im Griff", text: `An ${reached} von ${tracked.length} eingetragenen Tagen hast du ${formatLiters(goalMl, 1)} geschafft.` });
  } else {
    tips.push({
      tone: "hint",
      title: "Ziel öfter erreichen",
      text: `Ziel an ${reached} von ${tracked.length} eingetragenen Tagen erreicht, im Schnitt ${formatLiters(avg)}. Eine volle Flasche in Sichtweite hilft mehr als jede Erinnerung.`,
    });
  }

  const slots = timeOfDay(entries);
  const morning = slots.find((s) => s.key === "morgens")?.share ?? 0;
  const evening = (slots.find((s) => s.key === "abends")?.share ?? 0) + (slots.find((s) => s.key === "nachts")?.share ?? 0);
  if (morning < 0.15) {
    tips.push({ tone: "hint", title: "Morgens trinkst du wenig", text: `Nur ${Math.round(morning * 100)} % deiner Menge vor 11 Uhr. Ein Glas Wasser direkt nach dem Aufstehen bringt dich gleich ins Tempo.` });
  }
  if (evening > 0.4) {
    tips.push({ tone: "hint", title: "Viel am Abend", text: `${Math.round(evening * 100)} % trinkst du ab 18 Uhr. Früher am Tag verteilt musst du nachts seltener raus.` });
  }

  const lateCaffeineDays = new Set(entries.filter((e) => e.caffeine > 0 && e.minutes >= 15 * 60).map((e) => e.date)).size;
  if (lateCaffeineDays >= 3) {
    tips.push({
      tone: "hint",
      title: "Koffein am Nachmittag",
      text: `An ${lateCaffeineDays} Tagen gab es nach 15 Uhr noch Koffein. Es wirkt etwa 5 Stunden zur Hälfte nach; für guten Schlaf lieber bis zum frühen Nachmittag.`,
    });
  }
  const over = tracked.filter((t) => t.caffeine > CAFFEINE_LIMIT_MG).length;
  if (over > 0) {
    tips.push({ tone: "hint", title: "Mehr als 400 mg Koffein", text: `An ${over === 1 ? "einem Tag" : `${over} Tagen`} lagst du über 400 mg. Ein Kaffee weniger oder ein Espresso statt eines großen Bechers reicht oft.` });
  }

  const sugarAvg = tracked.reduce((s, t) => s + t.sugar, 0) / tracked.length;
  if (sugarAvg > 25) {
    tips.push({ tone: "hint", title: "Zucker aus Getränken", text: `Im Schnitt ${formatNumber(Math.round(sugarAvg), 0)} g Zucker am Tag nur aus Getränken. Die WHO rät zu höchstens 50 g freiem Zucker am Tag, besser 25 g.` });
  }

  const water = entries.reduce((s, e) => s + e.water, 0);
  const all = entries.reduce((s, e) => s + e.ml, 0);
  if (all > 0 && water / all >= 0.6) {
    tips.push({ tone: "good", title: "Viel Wasser", text: `${Math.round((water / all) * 100)} % deiner Menge ist Wasser oder ungesüßter Kräutertee. Besser geht es kaum.` });
  } else if (all > 0 && water / all < 0.4) {
    tips.push({ tone: "hint", title: "Mehr Wasser", text: `Nur ${Math.round((water / all) * 100)} % deiner Menge ist Wasser. Wer jedes zweite Getränk durch Wasser ersetzt, spart Zucker und Koffein.` });
  }
  return tips;
}
