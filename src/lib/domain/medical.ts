// Medizin & Vorsorge: Krankheitstage (mit Fieber), Medikamente und Vorsorge-Termine.

import { addDays, daysBetween } from "./week";

// ---------------------------------------------------------------------------
// Krankheitstage
// ---------------------------------------------------------------------------

export const SICK_TITLES = ["Erkältung", "Grippe", "Corona", "Magen-Darm", "Migräne", "Halsentzündung", "Verletzung", "Allergie"] as const;

export const SYMPTOMS = [
  "Fieber",
  "Schüttelfrost",
  "Husten",
  "Schnupfen",
  "Halsschmerzen",
  "Kopfschmerzen",
  "Gliederschmerzen",
  "Müdigkeit",
  "Übelkeit",
  "Erbrechen",
  "Durchfall",
  "Bauchschmerzen",
  "Schwindel",
  "Atemnot",
  "Geschmacksverlust",
] as const;

export type Temperature = { date: string; time: string | null; celsius: number };

export type SickEpisode = {
  id: string;
  title: string;
  start: string;
  /** null = noch krank */
  end: string | null;
  symptoms: string[];
  sickNote: boolean;
  temperatures: Temperature[];
  note: string | null;
};

/** Fiebermessungen aus der Datenbank (jsonb) prüfen, zeitlich sortieren. */
export function normalizeTemperatures(raw: unknown): Temperature[] {
  if (!Array.isArray(raw)) return [];
  const out: Temperature[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    if (typeof r.celsius !== "number" || r.celsius < 30 || r.celsius > 45) continue;
    const time = typeof r.time === "string" && /^\d{2}:\d{2}$/.test(r.time) ? r.time : null;
    out.push({ date: r.date, time, celsius: r.celsius });
  }
  return sortTemperatures(out);
}

export const sortTemperatures = (list: Temperature[]) =>
  [...list].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));

/** Fieber ab 38,0 °C, erhöhte Temperatur ab 37,5 °C. */
export function feverLevel(celsius: number): "fieber" | "erhoeht" | "normal" {
  if (celsius >= 38) return "fieber";
  if (celsius >= 37.5) return "erhoeht";
  return "normal";
}

export const maxTemperature = (e: SickEpisode) => (e.temperatures.length ? Math.max(...e.temperatures.map((t) => t.celsius)) : null);

/** Dauer in Tagen (beide Tage mitgezählt); laufende Krankheit bis heute. */
export function episodeDays(e: Pick<SickEpisode, "start" | "end">, today: string): number {
  const end = e.end ?? today;
  return Math.max(1, daysBetween(e.start, end < e.start ? e.start : end) + 1);
}

/** Krankheitstage innerhalb eines Zeitraums [from, to] (Überschneidungen von Krankheiten zählen einmal). */
export function sickDaysBetween(episodes: SickEpisode[], from: string, to: string, today: string): number {
  const days = new Set<string>();
  for (const e of episodes) {
    const start = e.start > from ? e.start : from;
    const rawEnd = e.end ?? today;
    const end = rawEnd < to ? rawEnd : to;
    for (let d = start; d <= end; d = addDays(d, 1)) days.add(d);
  }
  return days.size;
}

export type SickStats = { thisYear: number; last12Months: number; episodesThisYear: number; withSickNote: number };

export function sickStats(episodes: SickEpisode[], today: string): SickStats {
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const thisYear = episodes.filter((e) => (e.end ?? today) >= yearStart);
  return {
    thisYear: sickDaysBetween(episodes, yearStart, today, today),
    last12Months: sickDaysBetween(episodes, addDays(today, -364), today, today),
    episodesThisYear: thisYear.length,
    withSickNote: thisYear.filter((e) => e.sickNote).length,
  };
}

/** Häufigste Symptome (für die Übersicht). */
export function topSymptoms(episodes: SickEpisode[], limit = 5): { symptom: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of episodes) for (const s of e.symptoms) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()]
    .map(([symptom, count]) => ({ symptom, count }))
    .sort((a, b) => b.count - a.count || a.symptom.localeCompare(b.symptom, "de"))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Medikamente
// ---------------------------------------------------------------------------

export type MedicationIntake = {
  id: string;
  name: string;
  dose: string | null;
  date: string;
  time: string | null;
  reason: string | null;
  episodeId: string | null;
  note: string | null;
};

/** Neueste zuerst. */
export const sortIntakes = (list: MedicationIntake[]) =>
  [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? "").localeCompare(a.time ?? ""));

export type MedicationSummary = {
  name: string;
  count: number;
  lastDate: string;
  lastTime: string | null;
  /** zuletzt genutzte Dosis und Gründe (für „Nochmal nehmen“) */
  lastDose: string | null;
  lastReason: string | null;
  reasons: string[];
};

/** Medikamente nach Name zusammengefasst (Groß-/Kleinschreibung egal), zuletzt genommen zuerst. */
export function medicationSummaries(intakes: MedicationIntake[]): MedicationSummary[] {
  const map = new Map<string, MedicationSummary>();
  for (const i of sortIntakes(intakes)) {
    const key = i.name.trim().toLowerCase();
    const s = map.get(key);
    if (!s) {
      map.set(key, { name: i.name, count: 1, lastDate: i.date, lastTime: i.time, lastDose: i.dose, lastReason: i.reason, reasons: i.reason ? [i.reason] : [] });
    } else {
      s.count++;
      if (i.reason && !s.reasons.some((r) => r.toLowerCase() === i.reason!.toLowerCase())) s.reasons.push(i.reason);
    }
  }
  return [...map.values()];
}

/** Einnahmen nach Tag gruppiert (neueste zuerst). */
export function intakesByDay(intakes: MedicationIntake[]): { date: string; items: MedicationIntake[] }[] {
  const groups: { date: string; items: MedicationIntake[] }[] = [];
  for (const i of sortIntakes(intakes)) {
    const last = groups.at(-1);
    if (last?.date === i.date) last.items.push(i);
    else groups.push({ date: i.date, items: [i] });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Vorsorge
// ---------------------------------------------------------------------------

export type CheckupVisit = { id: string; date: string; note: string | null };

export type Checkup = {
  id: string;
  name: string;
  doctor: string | null;
  intervalMonths: number | null;
  /** fest ausgemachter Termin */
  nextOn: string | null;
  note: string | null;
  /** neueste zuerst */
  visits: CheckupVisit[];
};

/** Vorschläge mit üblichem Rhythmus (gesetzliche Vorsorge bzw. gängige Empfehlung). */
export const CHECKUP_PRESETS: { name: string; months: number | null; hint: string }[] = [
  { name: "Zahnarzt-Kontrolle", months: 6, hint: "halbjährlich (Bonusheft)" },
  { name: "Professionelle Zahnreinigung", months: 12, hint: "ein- bis zweimal im Jahr" },
  { name: "Hausarzt Check-up", months: 36, hint: "ab 35 alle 3 Jahre, 18–34 einmal" },
  { name: "Hautkrebs-Screening", months: 24, hint: "ab 35 alle 2 Jahre" },
  { name: "Augenarzt", months: 24, hint: "nach Bedarf, z. B. alle 2 Jahre" },
  { name: "Frauenarzt", months: 12, hint: "jährlich" },
  { name: "Urologe / Prostata", months: 12, hint: "ab 45 jährlich" },
  { name: "Grippeimpfung", months: 12, hint: "jeden Herbst" },
  { name: "Tetanus/Diphtherie-Impfung", months: 120, hint: "alle 10 Jahre" },
  { name: "Blutabnahme", months: 12, hint: "nach Absprache" },
];

/** Datum + Monate (Monatsende bleibt Monatsende: 31.08. + 6 → 28./29.02.). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export type DueInfo = {
  lastVisit: string | null;
  /** nächster Termin: fest ausgemacht oder aus dem Rhythmus berechnet */
  due: string | null;
  source: "termin" | "rhythmus" | null;
  /** Tage bis zum Termin (negativ = überfällig) */
  daysLeft: number | null;
  state: "ueberfaellig" | "bald" | "geplant" | "offen";
};

/**
 * Fälligkeit: ein fest ausgemachter Termin gilt, solange er nach dem letzten Besuch liegt; sonst letzter Besuch +
 * Rhythmus. „bald“ = innerhalb von 30 Tagen. Ohne beides „offen“.
 */
export function dueInfo(c: Pick<Checkup, "intervalMonths" | "nextOn" | "visits">, today: string): DueInfo {
  const lastVisit = c.visits.reduce<string | null>((max, v) => (max == null || v.date > max ? v.date : max), null);
  let due: string | null = null;
  let source: DueInfo["source"] = null;
  if (c.nextOn && (lastVisit == null || c.nextOn > lastVisit)) {
    due = c.nextOn;
    source = "termin";
  } else if (c.intervalMonths && lastVisit) {
    due = addMonths(lastVisit, c.intervalMonths);
    source = "rhythmus";
  }
  if (!due) return { lastVisit, due: null, source: null, daysLeft: null, state: "offen" };
  const daysLeft = daysBetween(today, due);
  return { lastVisit, due, source, daysLeft, state: daysLeft < 0 ? "ueberfaellig" : daysLeft <= 30 ? "bald" : "geplant" };
}

/** Reihenfolge der Vorsorge-Liste: überfällig, bald, geplant (nach Datum), dann offen (A–Z). */
export function sortCheckups<T extends Checkup>(list: T[], today: string): (T & { info: DueInfo })[] {
  const rank = { ueberfaellig: 0, bald: 1, geplant: 2, offen: 3 } as const;
  return list
    .map((c) => ({ ...c, info: dueInfo(c, today) }))
    .sort((a, b) => rank[a.info.state] - rank[b.info.state] || (a.info.due ?? "").localeCompare(b.info.due ?? "") || a.name.localeCompare(b.name, "de"));
}

/** „in 3 Wochen“, „vor 2 Monaten“, „heute“ – grob gerundet. */
export function relativeDays(days: number): string {
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  if (days === -1) return "gestern";
  const abs = Math.abs(days);
  let text: string;
  if (abs < 14) text = `${abs} Tagen`;
  else if (abs < 60) text = `${Math.round(abs / 7)} Wochen`;
  else if (abs < 730) text = `${Math.round(abs / 30.4)} Monaten`;
  else text = `${Math.round(abs / 365)} Jahren`;
  return days > 0 ? `in ${text}` : `vor ${text}`;
}
