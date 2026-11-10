// Habit Tracker und Trainings-Wochenplan (Sport & Gesundheit, 02.11.2026): reine Logik ohne Datenbank.
// Tage sind Kalendertage in deutscher Zeit („YYYY-MM-DD“), Uhrzeiten „HH:MM“.

import { periodRange } from "./drinks";
import { addDays, isoWeekday, mondayOf } from "./week";

// ---------------------------------------------------------------------------
// Typen und Beschriftungen
// ---------------------------------------------------------------------------

export type HabitKind = "habit" | "supplement";
export type HabitFrequency = "daily" | "weekly" | "monthly";
export type Daytime = "morgens" | "mittags" | "nachmittags" | "abends" | "nachts";

export const HABIT_KINDS: { key: HabitKind; label: string; plural: string }[] = [
  { key: "habit", label: "Gewohnheit", plural: "Gewohnheiten" },
  { key: "supplement", label: "Supplement", plural: "Supplemente" },
];

export const FREQUENCIES: { key: HabitFrequency; label: string; unit: string; max: number }[] = [
  { key: "daily", label: "Täglich", unit: "pro Tag", max: 20 },
  { key: "weekly", label: "Wöchentlich", unit: "pro Woche", max: 14 },
  { key: "monthly", label: "Monatlich", unit: "pro Monat", max: 31 },
];

/** Tageszeiten mit Beginn (Stunde); wie beim Getränketracker. */
export const DAYTIMES: { key: Daytime; label: string; from: number }[] = [
  { key: "morgens", label: "Morgens", from: 5 },
  { key: "mittags", label: "Mittags", from: 11 },
  { key: "nachmittags", label: "Nachmittags", from: 15 },
  { key: "abends", label: "Abends", from: 18 },
  { key: "nachts", label: "Nachts", from: 23 },
];
export const DAYTIME_KEYS = DAYTIMES.map((d) => d.key);

export function daytimeLabel(key: Daytime): string {
  return DAYTIMES.find((d) => d.key === key)?.label ?? key;
}

/** Tageszeit zu einer Uhrzeit („07:30“ → morgens; 0–5 Uhr zählt als nachts). */
export function daytimeOfTime(time: string): Daytime {
  const hour = Number(time.slice(0, 2));
  if (hour < 5) return "nachts";
  return [...DAYTIMES].reverse().find((d) => hour >= d.from)?.key ?? "morgens";
}

/** Sortierschlüssel innerhalb eines Tages: Uhrzeit, sonst Beginn der Tageszeit. */
export function timeKey(daytime: Daytime | null, atTime: string | null): string {
  if (atTime) return atTime;
  const d = DAYTIMES.find((x) => x.key === daytime);
  return d ? `${String(d.from).padStart(2, "0")}:00` : "99:99";
}

/**
 * Routine (z. B. Morgen- oder Abendroutine, eigene wie „Nach dem Training“): geordnete Liste täglicher Habits. Ein
 * Habit kann in mehreren Routinen stehen; sein Tagesziel ist dann mindestens die Zahl seiner Routinen (Zähneputzen
 * morgens und abends = 2× am Tag), und je Routine gibt es ein eigenes Häkchen.
 */
export type HabitRoutine = {
  id: string;
  name: string;
  /** Platz unter „Heute“ */
  daytime: Daytime;
  color: string;
  position: number;
  /** Punkte in eigener Reihenfolge */
  habitIds: string[];
};

/** In welcher Routine ein Habit an einem Tag abgehakt wurde. */
export type RoutineCheck = { routineId: string; habitId: string; date: string };

/** Vorschläge für eine neue Routine. */
export const ROUTINE_SUGGESTIONS: { name: string; daytime: Daytime; color: string }[] = [
  { name: "Morgenroutine", daytime: "morgens", color: "orange" },
  { name: "Abendroutine", daytime: "abends", color: "lila" },
  { name: "Mittagspause", daytime: "mittags", color: "gruen" },
  { name: "Nach dem Training", daytime: "nachmittags", color: "blau" },
];

/** Reihenfolge der Routinen: nach Tageszeit, dann eigene Reihenfolge. */
export function sortRoutines<T extends Pick<HabitRoutine, "daytime" | "position" | "name">>(routines: T[]): T[] {
  const at = (d: Daytime) => DAYTIME_KEYS.indexOf(d);
  return [...routines].sort((a, b) => at(a.daytime) - at(b.daytime) || a.position - b.position || a.name.localeCompare(b.name, "de"));
}

/** Namen der Routinen eines Habits (in Routinen-Reihenfolge). */
export function routineNames(h: Pick<Habit, "routineIds">, routines: Pick<HabitRoutine, "id" | "name">[]): string[] {
  return h.routineIds.map((id) => routines.find((r) => r.id === id)?.name).filter((n): n is string => n != null);
}

/**
 * Tagesziel nach einer Änderung der Routinen eines Habits: folgte es bisher nur den Routinen (höchstens so hoch wie
 * ihre Zahl), folgt es weiter (2 Routinen → 2×); ein höheres eigenes Ziel bleibt, nie unter der Zahl der Routinen.
 */
export function targetForRoutines(target: number, before: number, after: number): number {
  if (target <= Math.max(before, 1)) return Math.max(after, 1);
  return Math.max(target, after);
}

export const WEEKDAYS = [
  { n: 1, short: "Mo", long: "Montag" },
  { n: 2, short: "Di", long: "Dienstag" },
  { n: 3, short: "Mi", long: "Mittwoch" },
  { n: 4, short: "Do", long: "Donnerstag" },
  { n: 5, short: "Fr", long: "Freitag" },
  { n: 6, short: "Sa", long: "Samstag" },
  { n: 7, short: "So", long: "Sonntag" },
];

export type Habit = {
  id: string;
  name: string;
  kind: HabitKind;
  frequency: HabitFrequency;
  /** wie oft je Tag/Woche/Monat */
  target: number;
  /** nur täglich: Wochentage 1–7; leer = jeden Tag */
  weekdays: number[];
  daytime: Daytime | null;
  atTime: string | null;
  dose: string | null;
  notes: string | null;
  color: string;
  position: number;
  /** Routinen, in denen das Habit steht (nur täglich), in Routinen-Reihenfolge; leer = keine */
  routineIds: string[];
  /** angelegt am (deutsche Zeit): davor zählt nichts */
  startDate: string;
  /** pausiert ab diesem Tag (einschließlich); null = aktiv */
  pausedOn: string | null;
};

export type HabitCheck = { habitId: string; date: string; count: number };

/** Vorschläge im Sheet (antippen füllt Name und ggf. Dosis). */
export const HABIT_PRESETS: Record<HabitKind, { name: string; dose?: string; daytime?: Daytime }[]> = {
  habit: [
    { name: "Dehnen", daytime: "abends" },
    { name: "10.000 Schritte" },
    { name: "Meditation", daytime: "morgens" },
    { name: "Lesen", daytime: "abends" },
    { name: "Vor 23 Uhr schlafen", daytime: "abends" },
    { name: "Kein Alkohol" },
  ],
  supplement: [
    { name: "Kreatin", dose: "5 g", daytime: "morgens" },
    { name: "Vitamin D3", dose: "1.000 IE", daytime: "morgens" },
    { name: "Omega-3", dose: "1 Kapsel", daytime: "mittags" },
    { name: "Magnesium", dose: "300 mg", daytime: "abends" },
    { name: "Zink", dose: "10 mg", daytime: "abends" },
    { name: "Proteinshake", dose: "30 g" },
  ],
};

/** Vorschläge für Punkte einer Routine (nach ihrer Tageszeit). */
export function routinePresets(daytime: Daytime): { name: string; dose?: string; daytime?: Daytime }[] {
  if (daytime === "morgens") return [{ name: "Glas Wasser" }, { name: "Bett machen" }, { name: "Dehnen" }, { name: "Kalt duschen" }, { name: "Zähne putzen" }, { name: "Tag planen" }];
  if (daytime === "abends" || daytime === "nachts")
    return [{ name: "Handy weglegen" }, { name: "Zähne putzen" }, { name: "Tagebuch" }, { name: "Lesen" }, { name: "Morgen vorbereiten" }, { name: "Dehnen" }];
  return [{ name: "Glas Wasser" }, { name: "Dehnen" }, { name: "Spaziergang" }, { name: "Kurz durchatmen" }, { name: "Proteinshake" }];
}

/** „Mo, Mi, Fr“ (in Wochenreihenfolge). */
export function weekdayList(days: number[]): string {
  return [...days]
    .sort((a, b) => a - b)
    .map((n) => WEEKDAYS[n - 1]?.short)
    .filter(Boolean)
    .join(", ");
}

/** „Täglich“, „2× täglich“, „Mo, Mi, Fr“, „3× pro Woche“, „Wöchentlich“, „Monatlich“, „2× pro Monat“. */
export function frequencyLabel(h: Pick<Habit, "frequency" | "target" | "weekdays">): string {
  if (h.frequency === "daily") {
    const days = h.weekdays.length > 0 && h.weekdays.length < 7 ? weekdayList(h.weekdays) : null;
    if (days) return h.target > 1 ? `${days} · ${h.target}×` : days;
    return h.target > 1 ? `${h.target}× täglich` : "Täglich";
  }
  if (h.frequency === "weekly") return h.target > 1 ? `${h.target}× pro Woche` : "Wöchentlich";
  return h.target > 1 ? `${h.target}× pro Monat` : "Monatlich";
}

/** „Täglich · Morgens · 07:30“ bzw. „2× täglich · Morgenroutine, Abendroutine“ (mit den Namen der Routinen) */
export function scheduleLabel(h: Pick<Habit, "frequency" | "target" | "weekdays" | "daytime" | "atTime">, routines: string[] = []): string {
  if (routines.length) return [frequencyLabel(h), routines.join(", ")].join(" · ");
  return [frequencyLabel(h), h.daytime ? daytimeLabel(h.daytime) : null, h.atTime].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------
// Fällig, Zeiträume, Fortschritt
// ---------------------------------------------------------------------------

/** Läuft die Gewohnheit an diesem Tag (angelegt und nicht pausiert)? */
export function isActiveOn(h: Pick<Habit, "startDate" | "pausedOn">, date: string): boolean {
  return date >= h.startDate && (h.pausedOn == null || date < h.pausedOn);
}

/** Ist die Gewohnheit an diesem Tag dran? Wöchentliche und monatliche sind an jedem aktiven Tag abhakbar. */
export function isDueOn(h: Pick<Habit, "frequency" | "weekdays" | "startDate" | "pausedOn">, date: string): boolean {
  if (!isActiveOn(h, date)) return false;
  if (h.frequency !== "daily" || h.weekdays.length === 0) return true;
  return h.weekdays.includes(isoWeekday(date));
}

/** Zeitraum (Tag, Woche Mo–So, Kalendermonat), zu dem ein Tag gehört. */
export function periodOf(frequency: HabitFrequency, date: string): { from: string; to: string } {
  if (frequency === "daily") return { from: date, to: date };
  return periodRange(frequency === "weekly" ? "woche" : "monat", date);
}

/** Abhak-Zahlen je Gewohnheit und Tag. */
export type CheckIndex = Map<string, Map<string, number>>;

export function checkIndex(checks: HabitCheck[]): CheckIndex {
  const index: CheckIndex = new Map();
  for (const c of checks) {
    let days = index.get(c.habitId);
    if (!days) index.set(c.habitId, (days = new Map()));
    days.set(c.date, (days.get(c.date) ?? 0) + c.count);
  }
  return index;
}

export function countOn(index: CheckIndex, habitId: string, date: string): number {
  return index.get(habitId)?.get(date) ?? 0;
}

/** Summe der Abhak-Zahlen von `from` bis `to` (beide einschließlich). */
export function countBetween(index: CheckIndex, habitId: string, from: string, to: string): number {
  let sum = 0;
  for (const [date, count] of index.get(habitId) ?? []) if (date >= from && date <= to) sum += count;
  return sum;
}

/** Stand im Zeitraum, zu dem `date` gehört (z. B. 2 von 3 diese Woche). */
export function periodProgress(h: Habit, index: CheckIndex, date: string): { done: number; target: number; met: boolean } {
  const { from, to } = periodOf(h.frequency, date);
  const done = countBetween(index, h.id, from, to);
  return { done, target: h.target, met: done >= h.target };
}

/**
 * Nächster Stand eines Tages beim Antippen. Täglich: bis zum Ziel hochzählen, danach wieder auf 0. Woche/Monat: je
 * Tag einmal abhaken (antippen nimmt es wieder weg).
 */
export function nextCount(current: number, target: number, frequency: HabitFrequency): number {
  if (frequency === "daily") return current >= target ? 0 : current + 1;
  return current > 0 ? 0 : 1;
}

/** Lief die Gewohnheit an mindestens einem Tag von `from` bis `to`? */
function activeBetween(h: Pick<Habit, "startDate" | "pausedOn">, from: string, to: string): boolean {
  return to >= h.startDate && (h.pausedOn == null || from < h.pausedOn);
}

// ---------------------------------------------------------------------------
// Heute
// ---------------------------------------------------------------------------

export type TodayGroup = { key: string; label: string; habits: Habit[]; routine?: HabitRoutine };

/**
 * Gruppen für „Heute“: tägliche Gewohnheiten nach Tageszeit (ohne Tageszeit: „Jederzeit“), danach „Diese Woche“ und
 * „Diesen Monat“. Routinen stehen als eigene Gruppen an ihrer Tageszeit: vor deren Habits, Morgenroutinen ganz oben
 * (vor „Jederzeit“), Abendroutinen nach den Habits von abends. Habits in Routinen stehen nur dort. In jeder Gruppe
 * gilt die eigene Reihenfolge (Drag & Drop). Routinen ohne aktive Punkte (z. B. gerade angelegt) stehen leer an
 * ihrem Platz, damit man sie füllen kann; Routinen, deren Punkte nur heute nicht dran sind, fehlen.
 */
export function todayGroups(habits: Habit[], routines: HabitRoutine[], date: string): TodayGroup[] {
  const due = habits.filter((h) => isDueOn(h, date)).sort((a, b) => a.position - b.position);
  const daily = due.filter((h) => h.frequency === "daily" && h.routineIds.length === 0);
  const sorted = sortRoutines(routines);
  const routinesAt = (d: Daytime): TodayGroup[] =>
    sorted
      .filter((r) => r.daytime === d)
      .map((r) => ({
        key: `routine-${r.id}`,
        label: r.name,
        routine: r,
        habits: r.habitIds.map((id) => due.find((h) => h.id === id && h.frequency === "daily")).filter((h): h is Habit => h != null),
      }));
  const daytime = (key: Daytime): TodayGroup => ({ key, label: daytimeLabel(key), habits: daily.filter((h) => h.daytime === key) });
  const groups: TodayGroup[] = [
    ...routinesAt("morgens"),
    { key: "jederzeit", label: "Jederzeit", habits: daily.filter((h) => h.daytime == null) },
    daytime("morgens"),
    ...routinesAt("mittags"),
    daytime("mittags"),
    ...routinesAt("nachmittags"),
    daytime("nachmittags"),
    daytime("abends"),
    ...routinesAt("abends"),
    ...routinesAt("nachts"),
    daytime("nachts"),
    { key: "woche", label: "Diese Woche", habits: due.filter((h) => h.frequency === "weekly") },
    { key: "monat", label: "Diesen Monat", habits: due.filter((h) => h.frequency === "monthly") },
  ];
  const empty = (r: HabitRoutine) => !r.habitIds.some((id) => habits.some((h) => h.id === id && h.pausedOn == null));
  return groups.filter((g) => g.habits.length > 0 || (g.routine != null && empty(g.routine)));
}

// ---------------------------------------------------------------------------
// Häkchen je Routine
// ---------------------------------------------------------------------------

/** Abgehakte Routinen je Habit und Tag („habitId|date“ → Routinen-IDs). */
export type RoutineCheckIndex = Map<string, Set<string>>;

export function routineCheckIndex(checks: RoutineCheck[]): RoutineCheckIndex {
  const index: RoutineCheckIndex = new Map();
  for (const c of checks) {
    const key = `${c.habitId}|${c.date}`;
    let set = index.get(key);
    if (!set) index.set(key, (set = new Set()));
    set.add(c.routineId);
  }
  return index;
}

/**
 * In welchen Routinen ein Habit an einem Tag erledigt ist. Ausdrücklich in einer Routine Abgehaktes zählt dort; was
 * die Zahl des Tages darüber hinaus hergibt (z. B. in der Statistik abgehakt), füllt die übrigen Routinen der Reihe
 * nach (morgens vor abends).
 */
export function routinesDone(h: Pick<Habit, "id" | "routineIds">, index: CheckIndex, routineIndex: RoutineCheckIndex, date: string): Set<string> {
  const marked = routineIndex.get(`${h.id}|${date}`) ?? new Set<string>();
  const done = new Set(h.routineIds.filter((id) => marked.has(id)));
  let rest = countOn(index, h.id, date) - done.size;
  for (const id of h.routineIds) {
    if (rest <= 0) break;
    if (done.has(id)) continue;
    done.add(id);
    rest--;
  }
  return done;
}

/** Neuer Stand eines Punkts an einem Tag: Zahl des Tages und die Routinen, in denen er abgehakt ist. */
export type RoutineDayUpdate = { habitId: string; date: string; count: number; routineIds: string[] };

/** Punkt in Routine `routineId` abhaken (`done` true) oder das Häkchen wegnehmen; die Zahl des Tages folgt. Ohne Änderung: null. */
export function setRoutineItem(
  h: Pick<Habit, "id" | "routineIds">,
  routineId: string,
  done: boolean,
  index: CheckIndex,
  routineIndex: RoutineCheckIndex,
  date: string,
): RoutineDayUpdate | null {
  const current = routinesDone(h, index, routineIndex, date);
  if (current.has(routineId) === done) return null;
  const next = new Set(current);
  if (done) next.add(routineId);
  else next.delete(routineId);
  const count = countOn(index, h.id, date) + (done ? 1 : -1);
  return { habitId: h.id, date, count: Math.max(0, Math.min(99, count)), routineIds: h.routineIds.filter((id) => next.has(id)) };
}

/** Stand einer Routine an einem Tag: wie viele Punkte in dieser Routine erledigt sind und ob alle. */
export function routineProgress(
  routineId: string,
  items: Pick<Habit, "id" | "routineIds">[],
  index: CheckIndex,
  routineIndex: RoutineCheckIndex,
  date: string,
): { done: number; total: number; complete: boolean } {
  const done = items.filter((h) => routinesDone(h, index, routineIndex, date).has(routineId)).length;
  return { done, total: items.length, complete: items.length > 0 && done === items.length };
}

/**
 * Eine Routine als eigene Statistik: ihre Punkte mit Ziel 1 je Tag und der Zahl 1 an Tagen, an denen sie in dieser
 * Routine erledigt sind (von `from` bis `to`). Damit rechnen Quote, Serien und Kästchen wie bei Habits.
 */
export function routineView(
  routine: Pick<HabitRoutine, "id" | "habitIds">,
  habits: Habit[],
  index: CheckIndex,
  routineIndex: RoutineCheckIndex,
  from: string,
  to: string,
): { habits: Habit[]; index: CheckIndex } {
  const items = routine.habitIds.map((id) => habits.find((h) => h.id === id && h.frequency === "daily")).filter((h): h is Habit => h != null);
  const view: CheckIndex = new Map();
  for (const h of items) {
    const days = new Map<string, number>();
    for (let d = from; d <= to; d = addDays(d, 1)) if (routinesDone(h, index, routineIndex, d).has(routine.id)) days.set(d, 1);
    view.set(h.id, days);
  }
  return { habits: items.map((h) => ({ ...h, target: 1 })), index: view };
}

/**
 * Serie ganzer Tage: Tage am Stück, an denen alles Fällige der Habits erledigt war (z. B. eine Routine komplett).
 * Tage ohne Fälliges überspringt sie, heute zählt erst, wenn geschafft.
 */
export function completeDayStreak(habits: Habit[], index: CheckIndex, today: string, historyFrom: string): { current: number; best: number } {
  const rates = dayRates(habits, index, historyFrom, today, today).reverse();
  let current = 0;
  let run = 0;
  let best = 0;
  let open = true;
  for (const r of rates) {
    if (r.due === 0) continue;
    if (r.done >= r.due) {
      run++;
      if (open) current = run;
    } else if (r.date === today) {
      continue;
    } else {
      open = false;
      best = Math.max(best, run);
      run = 0;
    }
  }
  return { current, best: Math.max(best, run) };
}

/**
 * Neue Gesamtreihenfolge (IDs) nach dem Verschieben innerhalb einer Teilliste (z. B. „Weitere Habits“): die Teilliste
 * belegt dieselben Plätze wie vorher, nur in neuer Reihenfolge; alle anderen Habits bleiben, wo sie sind.
 */
export function reorderWithin(all: Pick<Habit, "id" | "position">[], subsetIds: string[]): string[] {
  const sorted = [...all].sort((a, b) => a.position - b.position);
  const subset = new Set(subsetIds);
  const queue = subsetIds.filter((id) => sorted.some((h) => h.id === id));
  return sorted.map((h) => (subset.has(h.id) ? (queue.shift() ?? h.id) : h.id));
}

/** Wie viele der heute fälligen täglichen Gewohnheiten erledigt sind (Ziel erreicht). */
export function daySummary(habits: Habit[], index: CheckIndex, date: string): { done: number; due: number } {
  const daily = habits.filter((h) => h.frequency === "daily" && isDueOn(h, date));
  return { done: daily.filter((h) => countOn(index, h.id, date) >= h.target).length, due: daily.length };
}

// ---------------------------------------------------------------------------
// Serien
// ---------------------------------------------------------------------------

export type Streak = { current: number; best: number; unit: "Tag" | "Woche" | "Monat" };

/** Zeiträume rückwärts von heute bis `from`: Liste von {from, to}. */
function periodsBack(frequency: HabitFrequency, from: string, today: string): { from: string; to: string }[] {
  const list: { from: string; to: string }[] = [];
  let cursor = periodOf(frequency, today);
  while (cursor.to >= from) {
    list.push(cursor);
    cursor = periodOf(frequency, addDays(cursor.from, -1));
  }
  return list;
}

/**
 * Aktuelle und beste Serie: erfüllte Tage (Wochen, Monate) am Stück. Der laufende Zeitraum zählt erst, wenn er
 * erfüllt ist (bis dahin bricht er die Serie nicht). Tage, an denen die Gewohnheit nicht dran ist, überspringt die
 * Serie. Gezählt wird höchstens bis `historyFrom` zurück (so weit reichen die geladenen Daten).
 */
export function habitStreak(h: Habit, index: CheckIndex, today: string, historyFrom: string): Streak {
  const unit = h.frequency === "daily" ? "Tag" : h.frequency === "weekly" ? "Woche" : "Monat";
  const start = h.startDate > historyFrom ? h.startDate : historyFrom;
  const periods = periodsBack(h.frequency, start, today);
  let current = 0;
  let run = 0;
  let best = 0;
  let currentOpen = true;
  for (const [i, p] of periods.entries()) {
    // Tägliche: nur fällige Tage; Woche/Monat: nur Zeiträume, in denen die Gewohnheit lief
    const relevant = h.frequency === "daily" ? isDueOn(h, p.from) : activeBetween(h, p.from, p.to);
    if (!relevant) continue;
    const met = countBetween(index, h.id, p.from, p.to) >= h.target;
    if (met) {
      run++;
      if (currentOpen) current = run;
    } else if (i === 0) {
      // laufender Zeitraum noch nicht erfüllt: zählt nicht, bricht aber nichts
      continue;
    } else {
      currentOpen = false;
      best = Math.max(best, run);
      run = 0;
    }
  }
  best = Math.max(best, run);
  return { current, best, unit };
}

/** „3 Tage“, „1 Woche“, „5 Monate“ */
export function streakLabel(n: number, unit: Streak["unit"]): string {
  if (unit === "Tag") return n === 1 ? "1 Tag" : `${n} Tage`;
  if (unit === "Woche") return n === 1 ? "1 Woche" : `${n} Wochen`;
  return n === 1 ? "1 Monat" : `${n} Monate`;
}

// ---------------------------------------------------------------------------
// Statistik je Zeitraum
// ---------------------------------------------------------------------------

export type CellState = "done" | "partial" | "missed" | "open" | "off" | "checked" | "none" | "inactive" | "future";
export type HabitCell = { date: string; state: CellState; count: number };

export type HabitPeriodStats = {
  habit: Habit;
  /** fällige Einheiten im Zeitraum bis einschließlich heute (laufende Woche/laufender Monat mit dem ganzen Ziel) */
  due: number;
  done: number;
  /** null = im Zeitraum nichts fällig (bzw. Monatliche in der Wochenansicht) */
  rate: number | null;
  /** Abhak-Zahlen gesamt im Zeitraum */
  total: number;
  cells: HabitCell[];
  /** Woche/Monat: Stand je Zeitraum, z. B. [{label: "KW 44", done: 2, target: 3}] */
  periods: { from: string; to: string; done: number; target: number }[];
};

function cellState(h: Habit, count: number, date: string, today: string): CellState {
  if (date > today) return "future";
  if (!isActiveOn(h, date)) return "inactive";
  if (h.frequency !== "daily") return count > 0 ? "checked" : "none";
  if (!isDueOn(h, date)) return "off";
  if (count >= h.target) return "done";
  if (date === today) return count > 0 ? "partial" : "open";
  return count > 0 ? "partial" : "missed";
}

/**
 * Zeiträume einer wöchentlichen/monatlichen Gewohnheit, die zur Ansicht gehören: Wochen, deren Donnerstag in
 * [from, to] liegt (ISO-Zuordnung, im Monat 4–5 Wochen), bzw. Monate, deren Erster darin liegt. Monatliche in der
 * Wochenansicht: keine (Stand des Monats zeigt die Seite getrennt).
 */
function viewPeriods(frequency: HabitFrequency, from: string, to: string): { from: string; to: string }[] {
  if (frequency === "weekly") {
    const list: { from: string; to: string }[] = [];
    for (let monday = mondayOf(from); monday <= to; monday = addDays(monday, 7)) {
      const thursday = addDays(monday, 3);
      if (thursday >= from && thursday <= to) list.push({ from: monday, to: addDays(monday, 6) });
    }
    return list;
  }
  if (frequency === "monthly") {
    const first = `${from.slice(0, 7)}-01`;
    return first >= from && first <= to ? [periodRange("monat", first)] : [];
  }
  return [];
}

/** Erledigt/fällig, Zellen je Tag und Stand je Zeitraum für eine Gewohnheit von `from` bis `to`. */
export function habitPeriodStats(h: Habit, index: CheckIndex, from: string, to: string, today: string): HabitPeriodStats {
  const cells: HabitCell[] = [];
  let due = 0;
  let done = 0;
  let total = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const count = countOn(index, h.id, d);
    if (d <= today) total += count;
    const state = cellState(h, count, d, today);
    cells.push({ date: d, state, count });
    if (h.frequency === "daily" && (state === "done" || state === "partial" || state === "missed" || state === "open")) {
      due += h.target;
      done += Math.min(count, h.target);
    }
  }

  const periods = viewPeriods(h.frequency, from, to)
    .filter((p) => p.from <= today && activeBetween(h, p.from, p.to))
    .map((p) => ({ ...p, done: countBetween(index, h.id, p.from, p.to), target: h.target }));
  for (const p of periods) {
    due += p.target;
    done += Math.min(p.done, p.target);
  }
  return { habit: h, due, done, rate: due > 0 ? done / due : null, total, cells, periods };
}

export type DayRate = { date: string; done: number; due: number; future: boolean };

/** Je Tag: erledigte und fällige Einheiten der täglichen Gewohnheiten (künftige Tage: 0). */
export function dayRates(habits: Habit[], index: CheckIndex, from: string, to: string, today: string): DayRate[] {
  const out: DayRate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    let due = 0;
    let done = 0;
    if (d <= today) {
      for (const h of habits) {
        if (h.frequency !== "daily" || !isDueOn(h, d)) continue;
        due += h.target;
        done += Math.min(countOn(index, h.id, d), h.target);
      }
    }
    out.push({ date: d, done, due, future: d > today });
  }
  return out;
}

/** Kennzahlen über alle Gewohnheiten eines Zeitraums. */
export function periodKpis(stats: HabitPeriodStats[], rates: DayRate[], today: string) {
  const due = stats.reduce((s, x) => s + x.due, 0);
  const done = stats.reduce((s, x) => s + x.done, 0);
  // Perfekte Tage: alle fälligen täglichen erledigt; heute nur, wenn schon geschafft
  const elapsed = rates.filter((r) => !r.future && r.due > 0 && (r.date < today || r.done >= r.due));
  return {
    rate: due > 0 ? done / due : null,
    perfect: elapsed.filter((r) => r.done >= r.due).length,
    days: elapsed.length,
    total: stats.reduce((s, x) => s + x.total, 0),
  };
}

/**
 * Quote je Wochentag (Mo–So) der täglichen Gewohnheiten in den letzten `weeks` Wochen bis gestern (heute läuft noch,
 * zählt nur, wenn erledigt): Wo hakt es?
 */
export function weekdayRates(habits: Habit[], index: CheckIndex, today: string, weeks = 12): { weekday: number; due: number; done: number; rate: number | null }[] {
  const from = addDays(today, -7 * weeks + 1);
  const sums = WEEKDAYS.map((w) => ({ weekday: w.n, due: 0, done: 0 }));
  for (const r of dayRates(habits, index, from, today, today)) {
    if (r.date === today && r.done < r.due) continue;
    const s = sums[isoWeekday(r.date) - 1];
    s.due += r.due;
    s.done += r.done;
  }
  return sums.map((s) => ({ ...s, rate: s.due > 0 ? s.done / s.due : null }));
}

// ---------------------------------------------------------------------------
// Trainings-Wochenplan
// ---------------------------------------------------------------------------

export type ScheduleCategory = "kraft" | "ausdauer" | "mobility" | "sport" | "erholung";

export const SCHEDULE_CATEGORIES: { key: ScheduleCategory; label: string; color: string }[] = [
  { key: "kraft", label: "Kraft", color: "var(--sport)" },
  { key: "ausdauer", label: "Ausdauer", color: "var(--cardio)" },
  { key: "mobility", label: "Mobility", color: "var(--sage)" },
  { key: "sport", label: "Sport", color: "#8b5cf6" },
  { key: "erholung", label: "Erholung", color: "#8a8f98" },
];
export const SCHEDULE_CATEGORY_KEYS = SCHEDULE_CATEGORIES.map((c) => c.key);

export function categoryOf(key: string) {
  return SCHEDULE_CATEGORIES.find((c) => c.key === key) ?? SCHEDULE_CATEGORIES[0];
}

/** Vorschläge für den Titel mit passender Art. */
export const SCHEDULE_PRESETS: { title: string; category: ScheduleCategory }[] = [
  { title: "Gym", category: "kraft" },
  { title: "Laufen", category: "ausdauer" },
  { title: "Radfahren", category: "ausdauer" },
  { title: "Schwimmen", category: "ausdauer" },
  { title: "Dehnen / Mobility", category: "mobility" },
  { title: "Yoga", category: "mobility" },
  { title: "Spaziergang", category: "erholung" },
];

export type ScheduleEntry = {
  id: string;
  weekday: number;
  /** optional wie die Uhrzeit */
  daytime: Daytime | null;
  atTime: string | null;
  title: string;
  category: ScheduleCategory;
  durationMin: number | null;
  notes: string | null;
  /** Reihenfolge innerhalb des Tages (Drag & Drop) */
  position: number;
};

/** Nach Wochentag, dann eigener Reihenfolge; bei gleicher Stelle nach Uhrzeit (bzw. Beginn der Tageszeit) und Titel. */
export function sortSchedule<T extends Pick<ScheduleEntry, "weekday" | "daytime" | "atTime" | "title" | "position">>(entries: T[]): T[] {
  return [...entries].sort(
    (a, b) =>
      a.weekday - b.weekday ||
      a.position - b.position ||
      timeKey(a.daytime, a.atTime).localeCompare(timeKey(b.daytime, b.atTime)) ||
      a.title.localeCompare(b.title, "de"),
  );
}

/** Einheiten, Minuten und Einheiten je Art einer Woche. */
export function scheduleSummary(entries: ScheduleEntry[]) {
  const byCategory = SCHEDULE_CATEGORIES.map((c) => ({
    ...c,
    count: entries.filter((e) => e.category === c.key).length,
    minutes: entries.filter((e) => e.category === c.key).reduce((s, e) => s + (e.durationMin ?? 0), 0),
  })).filter((c) => c.count > 0);
  return {
    count: entries.length,
    minutes: entries.reduce((s, e) => s + (e.durationMin ?? 0), 0),
    days: new Set(entries.map((e) => e.weekday)).size,
    byCategory,
  };
}

/** „45 min“, „1 h“, „1 h 30 min“ */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** „Morgens · 07:00“, „Abends“, „07:00“ bzw. leer (ohne Tageszeit und Uhrzeit) */
export function slotLabel(e: Pick<ScheduleEntry, "daytime" | "atTime">): string {
  return [e.daytime ? daytimeLabel(e.daytime) : null, e.atTime].filter(Boolean).join(" · ");
}
