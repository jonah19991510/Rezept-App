// Challenges (Sport & Gesundheit, 03.11.2026): reine Logik ohne Datenbank.
// Regeln in Klartext, Fortschritt je Teilnehmer (erfüllte Tage, Joker, Serie, Status), Punkte, Rangliste, Statistik.
// Tage sind Kalendertage in deutscher Zeit („YYYY-MM-DD“).

import { formatNumber } from "@/lib/format";
import { addDays, daysBetween, weekdayShort } from "./week";

/** check: abhaken · daily: Tagesziel · total: Gesamtziel · most: Wettkampf, wer am meisten schafft */
export type ChallengeMetric = "check" | "daily" | "total" | "most";
export type ChallengeSource = "manual" | "workouts";
export type ChallengeFrequency = "daily" | "weekly";
export type StartMode = "fixed" | "join";
export type MissedRule = "strict" | "streak" | "relaxed";
/** days: feste Anzahl Tage · month: bis Ende des Monats · year: bis Ende des Jahres */
export type ChallengePeriod = "days" | "month" | "year";

/** Alles, was festlegt, wie eine Challenge gewertet wird (gesperrt, sobald andere mitmachen). */
export type ChallengeRules = {
  metric: ChallengeMetric;
  source: ChallengeSource;
  unit: string | null;
  dailyTarget: number | null;
  totalTarget: number | null;
  frequency: ChallengeFrequency;
  daysPerWeek: number | null;
  durationDays: number;
  startMode: StartMode;
  startsOn: string | null;
  lateJoinDays: number;
  missedRule: MissedRule;
  jokers: number;
  minPeriods: number | null;
  backfillDays: number;
  period: ChallengePeriod;
  /** nach dem Ende beginnt am nächsten Tag die nächste Runde (nur mit gemeinsamem Start) */
  repeats: boolean;
};

export type Challenge = ChallengeRules & {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  color: string;
  createdBy: string | null;
  creatorName: string;
  createdAt: string;
  /** privat: nur für die Person sichtbar, die sie angelegt hat; zählt nicht für die Gesamtrangliste */
  isPublic: boolean;
};

export type Participant = { userId: string; name: string; startDate: string; joinedAt: string };

/** Wert je Tag (abhaken: 1, Menge: Tageswert, Trainings: Anzahl) */
export type DayValues = Map<string, number>;

// ---------------------------------------------------------------------------
// Punkte
// ---------------------------------------------------------------------------

export const POINTS = {
  /** je erfülltem Tag (bei „x Tage pro Woche“ höchstens x je Woche) */
  day: 10,
  /** je volle Woche ohne Unterbrechung (nur „Streng“ und „Serie zählt“) */
  streakWeek: 20,
  /** fürs Schaffen */
  completion: 50,
  /** „Wer schafft mehr?“ mit gemeinsamem Start: Platz 1, 2, 3 am Ende */
  place: [50, 30, 20],
} as const;

// ---------------------------------------------------------------------------
// Symbole und Vorlagen
// ---------------------------------------------------------------------------

/** Symbol-Schlüssel (die Komponenten ordnen sie lucide-Icons zu). */
export const CHALLENGE_ICONS = [
  "dumbbell",
  "footprints",
  "bike",
  "waves",
  "flame",
  "heart",
  "droplet",
  "wine-off",
  "cigarette-off",
  "candy-off",
  "apple",
  "salad",
  "moon",
  "sun",
  "brain",
  "book-open",
  "smartphone",
  "snowflake",
  "target",
  "trophy",
] as const;
export type ChallengeIcon = (typeof CHALLENGE_ICONS)[number];

export type ChallengePreset = { name: string; title: string; icon: ChallengeIcon; color: string } & Partial<ChallengeRules>;

/** Vorlagen zum schnellen Anlegen; alles danach änderbar. */
export const CHALLENGE_PRESETS: ChallengePreset[] = [
  { name: "Liegestütze", title: "30 Tage Liegestütze", icon: "dumbbell", color: "orange", metric: "daily", dailyTarget: 50, unit: "Liegestütze", durationDays: 30, missedRule: "streak", jokers: 2 },
  { name: "Kein Alkohol", title: "30 Tage kein Alkohol", icon: "wine-off", color: "lila", metric: "check", durationDays: 30, missedRule: "strict", jokers: 0 },
  { name: "Trainieren", title: "3× pro Woche trainieren", icon: "dumbbell", color: "rot", metric: "check", source: "workouts", frequency: "weekly", daysPerWeek: 3, durationDays: 28, missedRule: "streak", jokers: 1 },
  { name: "Schritte", title: "10.000 Schritte am Tag", icon: "footprints", color: "gruen", metric: "daily", dailyTarget: 10000, unit: "Schritte", durationDays: 30, missedRule: "relaxed", minPeriods: 25 },
  { name: "Wasser", title: "Jeden Tag 2 Liter Wasser", icon: "droplet", color: "hellblau", metric: "daily", dailyTarget: 2, unit: "Liter", durationDays: 30, missedRule: "relaxed" },
  { name: "Laufen", title: "100 km laufen", icon: "footprints", color: "blau", metric: "total", totalTarget: 100, unit: "km", durationDays: 30 },
  { name: "Ohne Süßes", title: "21 Tage ohne Süßes", icon: "candy-off", color: "pink", metric: "check", durationDays: 21, missedRule: "strict", jokers: 1 },
  { name: "Liegestütz-Duell", title: "Wer schafft die meisten Liegestütze?", icon: "trophy", color: "orange", metric: "most", unit: "Liegestütze", durationDays: 7 },
  { name: "Schritte-Wettkampf", title: "Schritte-Wettkampf", icon: "footprints", color: "tuerkis", metric: "most", unit: "Schritte", durationDays: 30 },
  { name: "Lesen", title: "Jeden Tag lesen", icon: "book-open", color: "braun", metric: "daily", dailyTarget: 10, unit: "Seiten", durationDays: 30, missedRule: "relaxed", minPeriods: 25 },
];

// ---------------------------------------------------------------------------
// Zeitraum
// ---------------------------------------------------------------------------

/** Anzahl der gewerteten Zeiträume: Tage (täglich) bzw. Wochen (x Tage pro Woche). */
export function periodCount(r: Pick<ChallengeRules, "frequency" | "durationDays">): number {
  return r.frequency === "weekly" ? Math.floor(r.durationDays / 7) : r.durationDays;
}

/** Erster und letzter Tag einer Teilnahme. */
export function windowOf(startDate: string, r: Pick<ChallengeRules, "durationDays">): { from: string; to: string } {
  return { from: startDate, to: addDays(startDate, r.durationDays - 1) };
}

/** Wie viele erfüllte (bzw. per Joker gerettete) Zeiträume zum Schaffen nötig sind. */
export function requiredPeriods(r: Pick<ChallengeRules, "frequency" | "durationDays" | "missedRule" | "minPeriods">): number {
  const all = periodCount(r);
  return r.missedRule === "strict" ? all : Math.min(all, r.minPeriods ?? all);
}

/** Gibt es Regeln je Tag (Rhythmus, verpasste Tage, „geschafft“)? Nicht bei Gesamtmenge und Wettkampf. */
export function hasDayRules(r: Pick<ChallengeRules, "metric">): boolean {
  return r.metric !== "total" && r.metric !== "most";
}

/** Joker gibt es nur bei „Streng“ und „Serie zählt“. */
export function jokersOf(r: Pick<ChallengeRules, "missedRule" | "jokers" | "metric">): number {
  return !hasDayRules(r) || r.missedRule === "relaxed" ? 0 : r.jokers;
}

/** Zählt die Serie (und damit der Serienbonus)? */
export function hasStreak(r: Pick<ChallengeRules, "missedRule" | "metric">): boolean {
  return hasDayRules(r) && r.missedRule !== "relaxed";
}

/** Gibt es am Ende Punkte für die Plätze 1–3? Nur beim Wettkampf mit gemeinsamem Start (gemeinsames Ende). */
export function hasPlaceBonus(r: Pick<ChallengeRules, "metric" | "startMode">): boolean {
  return r.metric === "most" && r.startMode === "fixed";
}

/** Ist ein Tageswert „erfüllt“? */
export function dayMet(r: Pick<ChallengeRules, "metric" | "dailyTarget">, value: number): boolean {
  if (r.metric === "daily") return value >= (r.dailyTarget ?? Infinity);
  return value > 0;
}

/** Lässt sich ein Tag noch ändern (nachtragen)? Danach ist er endgültig. */
export function isDayOpen(day: string, today: string, backfillDays: number): boolean {
  return day <= today && day >= addDays(today, -backfillDays);
}

/** Status der Challenge selbst (nicht der Teilnahme). */
export type ChallengePhase =
  | { kind: "upcoming"; startsOn: string; daysUntil: number }
  | { kind: "running"; day: number; of: number; endsOn: string; round: number; repeats: boolean }
  | { kind: "over"; endedOn: string }
  | { kind: "open" };

type RoundRules = Pick<ChallengeRules, "startMode" | "startsOn" | "durationDays" | "period" | "repeats">;

export function challengePhase(r: RoundRules, today: string): ChallengePhase {
  if (r.startMode === "join" || !r.startsOn) return { kind: "open" };
  if (today < r.startsOn) return { kind: "upcoming", startsOn: r.startsOn, daysUntil: daysBetween(today, r.startsOn) };
  const index = roundIndexOn(r, today);
  const round = roundAt(r, index);
  if (today > round.to) return { kind: "over", endedOn: round.to };
  return { kind: "running", day: daysBetween(round.from, today) + 1, of: round.days, endsOn: round.to, round: index, repeats: r.repeats };
}

/** Kann man (noch) mitmachen? Wiederholung: immer. Fester Start: bis zum Start plus „späterer Einstieg“. */
export function canJoin(r: Pick<ChallengeRules, "startMode" | "startsOn" | "lateJoinDays" | "repeats">, today: string): boolean {
  if (r.startMode === "join" || !r.startsOn || r.repeats) return true;
  return today <= addDays(r.startsOn, r.lateJoinDays);
}

// ---------------------------------------------------------------------------
// Runden (bis Monats-/Jahresende, Wiederholung)
// ---------------------------------------------------------------------------

export type Round = { index: number; from: string; to: string; days: number };

const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Erster Tag des Monats, `months` Monate nach dem von `iso`. */
function monthStart(iso: string, months = 0): string {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return d.toISOString().slice(0, 10);
}

function monthEnd(iso: string): string {
  return addDays(monthStart(iso, 1), -1);
}

function yearEnd(iso: string): string {
  return `${iso.slice(0, 4)}-12-31`;
}

/** Runde Nummer `index` (0 = erste) einer Challenge mit gemeinsamem Start. Die erste beginnt am Starttag. */
export function roundAt(r: Pick<ChallengeRules, "startsOn" | "durationDays" | "period">, index: number): Round {
  const start = r.startsOn ?? "1970-01-01";
  let from: string;
  let to: string;
  if (r.period === "month") {
    from = index === 0 ? start : monthStart(start, index);
    to = monthEnd(from);
  } else if (r.period === "year") {
    from = index === 0 ? start : `${Number(start.slice(0, 4)) + index}-01-01`;
    to = yearEnd(from);
  } else {
    from = addDays(start, index * r.durationDays);
    to = addDays(from, r.durationDays - 1);
  }
  return { index, from, to, days: daysBetween(from, to) + 1 };
}

/** Nummer der Runde, die `date` enthält (vor dem Start und ohne Wiederholung: 0). */
export function roundIndexOn(r: Pick<ChallengeRules, "startsOn" | "durationDays" | "period" | "repeats">, date: string): number {
  if (!r.repeats || !r.startsOn || date <= r.startsOn) return 0;
  const start = r.startsOn;
  if (r.period === "month") return (Number(date.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(date.slice(5, 7)) - Number(start.slice(5, 7));
  if (r.period === "year") return Number(date.slice(0, 4)) - Number(start.slice(0, 4));
  return Math.floor(daysBetween(start, date) / r.durationDays);
}

/** Alle Runden vom Start bis zu der, die `today` enthält (ohne Wiederholung genau eine). */
export function roundsUntil(r: Pick<ChallengeRules, "startsOn" | "durationDays" | "period" | "repeats">, today: string): Round[] {
  const last = roundIndexOn(r, today);
  return Array.from({ length: last + 1 }, (_, i) => roundAt(r, i));
}

/**
 * Regeln und Starttag einer Teilnahme in einer Runde. „Ab Beitritt“: eigener Zeitraum (Runde egal). Gemeinsamer
 * Start: die Runde; null, wenn man erst ab einer späteren Runde dabei ist.
 */
export function participationIn<R extends ChallengeRules>(r: R, participantStart: string, round: Round): { rules: R; start: string } | null {
  if (r.startMode === "join") return { rules: r, start: participantStart };
  if (participantStart > round.from) return null;
  // Eine Runde ist für sich ein fester Zeitraum ohne weitere Runden
  return { rules: { ...r, startsOn: round.from, durationDays: round.days, period: "days", repeats: false }, start: round.from };
}

/** Runde, die für eine Teilnahme gerade zählt: die laufende, bzw. die erste eigene, wenn man erst später dabei ist. */
export function currentRoundFor(r: ChallengeRules, participantStart: string, today: string): Round {
  return roundAt(r, roundIndexOn(r, participantStart > today ? participantStart : today));
}

/** „November 2026“, „2026“, „Runde 3 (1.12.–30.12.)“ */
export function roundLabel(r: Pick<ChallengeRules, "period" | "repeats">, round: Round): string {
  const dm = (iso: string) => `${Number(iso.slice(8))}.${Number(iso.slice(5, 7))}.`;
  if (r.period === "month") return `${MONTH_NAMES[Number(round.from.slice(5, 7)) - 1]} ${round.from.slice(0, 4)}`;
  if (r.period === "year") return round.from.slice(0, 4);
  return r.repeats ? `Runde ${round.index + 1} (${dm(round.from)}–${dm(round.to)})` : `${dm(round.from)}–${dm(round.to)}`;
}

// ---------------------------------------------------------------------------
// Fortschritt einer Teilnahme
// ---------------------------------------------------------------------------

/** met: erfüllt · partial: Menge eingetragen, Ziel nicht erreicht · joker: per Joker gerettet · missed: verpasst ·
 * open: noch änderbar, (noch) nicht erfüllt · future: kommt noch · empty: kein Eintrag, zählt nicht (Wochen, Gesamtmenge) */
export type CellState = "met" | "partial" | "joker" | "missed" | "open" | "future" | "empty";
export type DayCell = { date: string; state: CellState; value: number };
export type PeriodCell = { index: number; from: string; to: string; state: CellState; metDays: number };

/** ended: vorbei, nicht geschafft · finished: Wettkampf vorbei (da gibt es kein „geschafft“) */
export type ParticipationStatus = "upcoming" | "active" | "completed" | "failed" | "ended" | "finished";

export type Progress = {
  status: ParticipationStatus;
  /** aktueller Tag (1 … Dauer), vor dem Start 0, danach = Dauer */
  dayNumber: number;
  durationDays: number;
  from: string;
  to: string;
  days: DayCell[];
  periods: PeriodCell[];
  periodTotal: number;
  required: number;
  metPeriods: number;
  jokersUsed: number;
  jokersLeft: number;
  missedPeriods: number;
  /** erfüllt + per Joker gerettet */
  covered: number;
  /** Kann das Ziel noch erreicht werden? */
  reachable: boolean;
  streak: number;
  bestStreak: number;
  /** Summe aller Tageswerte im Zeitraum (Menge bzw. Trainings) */
  sum: number;
  /** größter Tageswert */
  bestDay: number;
  metDays: number;
  completedOn: string | null;
  failedOn: string | null;
  points: { days: number; streak: number; completion: number; place: number; total: number };
  /** Wann welche Punkte dazukamen (für „Dieser Monat“) */
  pointLog: [date: string, points: number][];
};

/**
 * Fortschritt einer Teilnahme: wertet Tag für Tag (bzw. Woche für Woche) bis heute. Verpasst ist ein Zeitraum erst,
 * wenn er sich nicht mehr nachtragen lässt. Joker retten verpasste Zeiträume der Reihe nach; bei „Streng“ scheidet
 * aus, wer danach noch einen verpasst, bei „Serie zählt“ beginnt die Serie von vorn.
 */
export function participantProgress(r: ChallengeRules, startDate: string, values: DayValues, today: string): Progress {
  const { from, to } = windowOf(startDate, r);
  const periodTotal = r.metric === "total" ? 1 : r.metric === "most" ? r.durationDays : periodCount(r);
  const required = r.metric === "total" ? 1 : r.metric === "most" ? 0 : requiredPeriods(r);
  const jokers = jokersOf(r);
  const dayNumber = today < from ? 0 : today > to ? r.durationDays : daysBetween(from, today) + 1;

  const days: DayCell[] = [];
  let sum = 0;
  let bestDay = 0;
  let metDays = 0;
  for (let i = 0; i < r.durationDays; i++) {
    const date = addDays(from, i);
    const value = values.get(date) ?? 0;
    if (date > today) {
      days.push({ date, state: "future", value: 0 });
      continue;
    }
    sum += value;
    bestDay = Math.max(bestDay, value);
    const met = dayMet(r, value);
    if (met) metDays++;
    const open = isDayOpen(date, today, r.backfillDays);
    let state: CellState;
    if (met) state = "met";
    else if (value > 0) state = "partial";
    else if (open) state = "open";
    // Bei Wochen und Gesamtmenge ist ein einzelner leerer Tag nicht „verpasst“ (das entscheidet die Woche)
    else state = !hasDayRules(r) || r.frequency === "weekly" ? "empty" : "missed";
    days.push({ date, state, value });
  }

  if (r.metric === "most") {
    // Wettkampf: Punkte für jeden Tag mit Eintrag, kein „geschafft“; Platzbonus erst mit `withPlaceBonus`
    const pointLog: [string, number][] = days.filter((d) => d.state === "met").map((d) => [d.date, POINTS.day]);
    const pointsDays = pointLog.length * POINTS.day;
    return {
      status: today < from ? "upcoming" : today > to ? "finished" : "active",
      dayNumber,
      durationDays: r.durationDays,
      from,
      to,
      days,
      periods: [],
      periodTotal,
      required,
      metPeriods: metDays,
      jokersUsed: 0,
      jokersLeft: 0,
      missedPeriods: 0,
      covered: metDays,
      reachable: true,
      streak: 0,
      bestStreak: 0,
      sum,
      bestDay,
      metDays,
      completedOn: null,
      failedOn: null,
      points: { days: pointsDays, streak: 0, completion: 0, place: 0, total: pointsDays },
      pointLog,
    };
  }

  if (r.metric === "total") {
    const target = r.totalTarget ?? Infinity;
    let running = 0;
    let completedOn: string | null = null;
    for (const d of days) {
      running += d.value;
      if (!completedOn && running >= target) completedOn = d.date;
    }
    // Punkte nach Anteil; jeder Tag bekommt den Zuwachs, den er gebracht hat
    const maxPoints = POINTS.day * r.durationDays;
    const pointLog: [string, number][] = [];
    let cumulative = 0;
    let given = 0;
    for (const d of days) {
      if (!d.value) continue;
      cumulative += d.value;
      const now = Math.round(maxPoints * Math.min(1, cumulative / target));
      if (now > given) pointLog.push([d.date, now - given]);
      given = now;
    }
    const pointsDays = given;
    const completion = completedOn ? POINTS.completion : 0;
    if (completedOn) pointLog.push([completedOn, completion]);
    const status: ParticipationStatus = today < from ? "upcoming" : completedOn ? "completed" : today > to ? "ended" : "active";
    return {
      status,
      dayNumber,
      durationDays: r.durationDays,
      from,
      to,
      days,
      periods: [{ index: 0, from, to, state: completedOn ? "met" : today > to ? "missed" : "open", metDays }],
      periodTotal,
      required,
      metPeriods: completedOn ? 1 : 0,
      jokersUsed: 0,
      jokersLeft: 0,
      missedPeriods: 0,
      covered: completedOn ? 1 : 0,
      reachable: completedOn != null || today <= to,
      streak: 0,
      bestStreak: 0,
      sum,
      bestDay,
      metDays,
      completedOn,
      failedOn: null,
      points: { days: pointsDays, streak: 0, completion, place: 0, total: pointsDays + completion },
      pointLog,
    };
  }

  // Zeiträume bilden: Tage oder Wochen ab dem eigenen Start
  const periodLength = r.frequency === "weekly" ? 7 : 1;
  const needDays = r.frequency === "weekly" ? (r.daysPerWeek ?? 7) : 1;
  const periods: PeriodCell[] = [];
  let jokersUsed = 0;
  let missedPeriods = 0;
  let metPeriods = 0;
  let streak = 0;
  let bestStreak = 0;
  let streakBonus = 0;
  let pointsDays = 0;
  let completedOn: string | null = null;
  let failedOn: string | null = null;
  const streakCounts = hasStreak(r);
  const pointLog: [string, number][] = [];

  for (let p = 0; p < periodTotal; p++) {
    const slice = days.slice(p * periodLength, (p + 1) * periodLength);
    const pFrom = slice[0].date;
    const pTo = slice[slice.length - 1].date;
    const metCells = slice.filter((d) => d.state === "met");
    const met = metCells.length;
    // Nach dem Ausscheiden gibt es keine Punkte mehr; bei „pro Woche“ zählen die ersten x Tage
    if (!failedOn) {
      for (const d of metCells.slice(0, needDays)) pointLog.push([d.date, POINTS.day]);
      pointsDays += POINTS.day * Math.min(met, needDays);
    }
    // Tag, an dem der Zeitraum erfüllt war (bei Wochen der x-te erfüllte Tag), sonst sein Ende
    const settledOn = met >= needDays ? metCells[needDays - 1].date : pTo;
    let state: CellState;
    if (pFrom > today) state = "future";
    else if (met >= needDays) state = "met";
    else if (isDayOpen(pTo, today, r.backfillDays) || pTo > today) state = "open";
    else if (failedOn) state = "missed";
    else if (jokersUsed < jokers) {
      state = "joker";
      jokersUsed++;
    } else {
      state = "missed";
      missedPeriods++;
    }
    // Bei Tagen bekommt die Zelle des Tages den Joker-Zustand
    if (periodLength === 1 && (state === "joker" || state === "missed")) slice[0].state = state;
    if (state === "missed" && r.missedRule === "strict" && !failedOn) failedOn = pTo;
    periods.push({ index: p, from: pFrom, to: pTo, state, metDays: met });

    if (state === "met") metPeriods++;
    if (state === "met" || state === "joker") {
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      // Volle Woche am Stück: bei Tagen jeder 7., bei Wochen jede
      if (streakCounts && !failedOn && (periodLength === 7 || streak % 7 === 0)) {
        streakBonus += POINTS.streakWeek;
        pointLog.push([settledOn, POINTS.streakWeek]);
      }
    } else if (state === "missed") {
      streak = 0;
    }
    if (!completedOn && !failedOn && metPeriods + jokersUsed >= required) completedOn = settledOn;
  }

  const covered = metPeriods + jokersUsed;
  const remaining = periods.filter((p) => p.state === "open" || p.state === "future").length;
  const completion = completedOn ? POINTS.completion : 0;
  if (completedOn) pointLog.push([completedOn, completion]);
  const status: ParticipationStatus =
    today < from ? "upcoming" : failedOn ? "failed" : completedOn ? "completed" : today > to && remaining === 0 ? "ended" : "active";
  return {
    status,
    dayNumber,
    durationDays: r.durationDays,
    from,
    to,
    days,
    periods,
    periodTotal,
    required,
    metPeriods,
    jokersUsed,
    jokersLeft: jokers - jokersUsed,
    missedPeriods,
    covered,
    reachable: !failedOn && (completedOn != null || covered + remaining >= required),
    streak,
    bestStreak,
    sum,
    bestDay,
    metDays,
    completedOn,
    failedOn,
    points: { days: pointsDays, streak: streakBonus, completion, place: 0, total: pointsDays + streakBonus + completion },
    pointLog,
  };
}

/**
 * Platzbonus beim Wettkampf mit gemeinsamem Start: Ist er vorbei, bekommen Platz 1–3 (nach Menge, gleiche Menge =
 * gleicher Platz, nur mit Eintrag) Punkte am letzten Tag. Sonst bleibt alles, wie es ist.
 */
export function withPlaceBonus(r: Pick<ChallengeRules, "metric" | "startMode" | "startsOn" | "durationDays">, progresses: Progress[], today: string): Progress[] {
  if (!hasPlaceBonus(r) || !r.startsOn) return progresses;
  const end = addDays(r.startsOn, r.durationDays - 1);
  if (today <= end) return progresses;
  return progresses.map((p) => {
    if (p.sum <= 0) return p;
    const place = progresses.filter((o) => o.sum > p.sum).length + 1;
    const bonus = POINTS.place[place - 1] ?? 0;
    if (!bonus) return p;
    return { ...p, points: { ...p.points, place: bonus, total: p.points.total + bonus }, pointLog: [...p.pointLog, [end, bonus]] };
  });
}

/** Punkte, die zwischen `from` und `to` (einschließlich) dazukamen. */
export function pointsBetween(p: Pick<Progress, "pointLog">, from: string, to: string): number {
  return p.pointLog.reduce((sum, [date, points]) => (date >= from && date <= to ? sum + points : sum), 0);
}

// ---------------------------------------------------------------------------
// Rangliste und Statistik
// ---------------------------------------------------------------------------

export type BoardRow = { userId: string; name: string; isMe: boolean; joinedAt: string; progress: Progress; rank: number };

/**
 * Rangliste einer Challenge. Gesamtmenge und Wettkampf: nach Menge. Sonst nach Punkten, dann erfüllten Zeiträumen, dann Menge;
 * Ausgeschiedene stehen unten. Gleichstand = gleicher Platz.
 */
export function rankBoard(r: Pick<ChallengeRules, "metric">, rows: Omit<BoardRow, "rank">[]): BoardRow[] {
  const key = (row: Omit<BoardRow, "rank">) =>
    !hasDayRules(r)
      ? [row.progress.sum, row.progress.points.total]
      : [row.progress.status === "failed" ? 0 : 1, row.progress.points.total, row.progress.covered, row.progress.sum];
  const sorted = [...rows].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i];
    return a.joinedAt.localeCompare(b.joinedAt);
  });
  let rank = 0;
  let previous: number[] | null = null;
  return sorted.map((row, i) => {
    const k = key(row);
    if (!previous || k.some((v, j) => v !== previous![j])) rank = i + 1;
    previous = k;
    return { ...row, rank };
  });
}

export type DayRate = { date: string; met: number; due: number };

export type ChallengeStats = {
  participants: number;
  byStatus: Record<ParticipationStatus, number>;
  /** heute dran (Zeitraum läuft) und davon heute erfüllt */
  today: { met: number; due: number };
  /** Summe aller Mengen bzw. Trainings */
  sum: number;
  /** Anteil erfüllt je Tag (fester Start: ganzer bisheriger Zeitraum, sonst die letzten 30 Tage) */
  rates: DayRate[];
  /** größter Tageswert aller Teilnehmer (Mengen) */
  bestDay: { value: number; date: string; name: string } | null;
};

export function challengeStats(r: ChallengeRules, board: (Pick<BoardRow, "progress"> & { name?: string })[], today: string): ChallengeStats {
  const byStatus: Record<ParticipationStatus, number> = { upcoming: 0, active: 0, completed: 0, failed: 0, ended: 0, finished: 0 };
  let bestDay: ChallengeStats["bestDay"] = null;
  let sum = 0;
  const todayCount = { met: 0, due: 0 };
  const perDay = new Map<string, DayRate>();
  for (const { progress, name } of board) {
    byStatus[progress.status]++;
    sum += progress.sum;
    for (const d of progress.days) {
      if (d.state === "future") continue;
      if (d.value > (bestDay?.value ?? 0)) bestDay = { value: d.value, date: d.date, name: name ?? "" };
      const rate = perDay.get(d.date) ?? { date: d.date, met: 0, due: 0 };
      rate.due++;
      if (d.state === "met") rate.met++;
      perDay.set(d.date, rate);
      if (d.date === today) {
        todayCount.due++;
        if (d.state === "met") todayCount.met++;
      }
    }
  }
  const phase = challengePhase(r, today);
  const first = phase.kind === "open" ? addDays(today, -29) : (r.startsOn ?? today);
  const last = phase.kind === "over" ? phase.endedOn : today;
  const rates: DayRate[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) rates.push(perDay.get(d) ?? { date: d, met: 0, due: 0 });
  return { participants: board.length, byStatus, today: todayCount, sum, rates, bestDay };
}

// ---------------------------------------------------------------------------
// Texte
// ---------------------------------------------------------------------------

/** „1.000“, „2,5“ */
export const amount = (n: number) => formatNumber(n, 2);

/** Einheit der Mengen: eigene Einheit bzw. „Trainings“. */
export function unitOf(r: Pick<ChallengeRules, "unit" | "source">, n?: number): string {
  if (r.source === "workouts") return n === 1 ? "Training" : "Trainings";
  return r.unit ?? "";
}

/** „5 Tage“, „1 Woche“ */
export function periodsLabel(n: number, frequency: ChallengeFrequency): string {
  return frequency === "weekly" ? `${n} ${n === 1 ? "Woche" : "Wochen"}` : `${n} ${n === 1 ? "Tag" : "Tage"}`;
}

/** „30 Tage“, „4 Wochen“, „bis Monatsende“, „jeden Monat“, „30 Tage, wiederholt“ */
export function durationLabel(r: Pick<ChallengeRules, "frequency" | "durationDays" | "period" | "repeats">): string {
  if (r.period === "month") return r.repeats ? "jeden Monat neu" : "bis Monatsende";
  if (r.period === "year") return r.repeats ? "jedes Jahr neu" : "bis Jahresende";
  const base = r.frequency === "weekly" ? periodsLabel(Math.floor(r.durationDays / 7), "weekly") : periodsLabel(r.durationDays, "daily");
  return r.repeats ? `${base}, wiederholt` : base;
}

/** „Mo, 1.12.“ */
export function dateLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${weekdayShort(iso)}, ${Number(d)}.${Number(m)}.`;
}

/** Was jeden Tag (bzw. jede Woche) zu tun ist, kurz: „Jeden Tag 50 Liegestütze“. */
export function goalLabel(r: ChallengeRules): string {
  const weekly = r.frequency === "weekly" ? `An ${r.daysPerWeek} ${r.daysPerWeek === 1 ? "Tag" : "Tagen"} pro Woche` : "Jeden Tag";
  if (r.metric === "total") return `Insgesamt ${amount(r.totalTarget ?? 0)} ${unitOf(r, r.totalTarget ?? 0)}`;
  if (r.metric === "most") return r.source === "workouts" ? "Wer trainiert am häufigsten?" : `Wer schafft die meisten ${unitOf(r)}?`;
  if (r.source === "workouts") return r.frequency === "weekly" ? `${weekly} trainieren` : "Jeden Tag ein Training";
  if (r.metric === "daily") return `${weekly} ${amount(r.dailyTarget ?? 0)} ${unitOf(r)}`;
  return r.frequency === "weekly" ? `${weekly} abhaken` : "Jeden Tag abhaken";
}

/** Kurzfassung für Karten: „Jeden Tag 50 Liegestütze · 30 Tage“. */
export function ruleSummary(r: ChallengeRules): string {
  return `${goalLabel(r)} · ${durationLabel(r)}`;
}

export const MISSED_RULES: { key: MissedRule; label: string; hint: string }[] = [
  { key: "strict", label: "Streng", hint: "Wer mehr verpasst, als er Joker hat, scheidet aus." },
  { key: "streak", label: "Serie zählt", hint: "Man bleibt dabei; ohne Joker beginnt die Serie von vorn." },
  { key: "relaxed", label: "Locker", hint: "Keine Strafe: Ein verpasster Tag zählt einfach nicht." },
];

export type RuleLine = { key: "goal" | "time" | "missed" | "done" | "backfill" | "points"; title: string; text: string };

/** Die Regel-Karte in Klartext, Zeile für Zeile. */
export function ruleLines(r: ChallengeRules): RuleLine[] {
  const unitWord = r.frequency === "weekly" ? "Woche" : "Tag";
  const unitPlural = r.frequency === "weekly" ? "Wochen" : "Tage";
  const total = periodCount(r);
  const jokers = jokersOf(r);
  const lines: RuleLine[] = [];

  // Was zählt
  let goal: string;
  if (r.metric === "most") {
    goal =
      r.source === "workouts"
        ? "Jedes beendete Training zählt automatisch. Es gewinnt, wer am Ende die meisten Trainings hat."
        : `Trag jeden Tag ein, wie viele ${unitOf(r)} du geschafft hast. Es gewinnt, wer am Ende insgesamt die meisten hat.`;
  } else if (r.metric === "total") {
    goal = `${goalLabel(r)} sammeln. Wann und wie viel pro Tag, ist egal.`;
  } else if (r.source === "workouts") {
    goal = r.frequency === "weekly" ? `${goalLabel(r)}.` : "An jedem Tag mindestens ein Training.";
  } else if (r.metric === "daily") {
    goal = `${goalLabel(r)}. Ein Tag zählt, wenn das Tagesziel erreicht ist.`;
  } else {
    goal = r.frequency === "weekly" ? `${goalLabel(r)}, wenn du es geschafft hast.` : "Jeden Tag abhaken, wenn du es geschafft hast.";
  }
  if (r.source === "workouts" && r.metric !== "most") goal += " Zählt automatisch aus deinen beendeten Trainings.";
  lines.push({ key: "goal", title: "Was zählt", text: goal });

  // Dauer und Start
  let time = durationLabel(r);
  if (r.startMode === "fixed" && r.startsOn) {
    const first = roundAt(r, 0);
    const late = r.lateJoinDays === 1 ? "1 Tag" : `${r.lateJoinDays} Tage`;
    if (r.period === "month" || r.period === "year") {
      const unit = r.period === "month" ? "Monats" : "Jahres";
      time = r.repeats
        ? `Jeden ${r.period === "month" ? "Monat" : "Jahr"} neu: Die erste Runde läuft vom ${dateLabel(first.from)} bis ${dateLabel(first.to)}, danach beginnt am 1. jedes ${unit} eine neue.`
        : `Vom ${dateLabel(first.from)} bis zum Ende des ${unit} (${dateLabel(first.to)}), für alle gleich.`;
    } else if (r.repeats) {
      time = `${periodsLabel(r.durationDays, "daily")} je Runde, die erste ab ${dateLabel(first.from)}; danach beginnt sofort die nächste.`;
    } else {
      time += `, Start am ${dateLabel(r.startsOn)} für alle (Ende am ${dateLabel(first.to)}).`;
    }
    if (r.repeats) {
      time += " Wer mitmacht, ist in jeder Runde automatisch wieder dabei. Ergebnisse früherer Runden bleiben in der Statistik.";
      time +=
        r.lateJoinDays > 0
          ? ` Einsteigen geht jederzeit; nach den ersten ${late} einer Runde zählt man ab der nächsten.`
          : " Einsteigen geht jederzeit; läuft eine Runde schon, zählt man ab der nächsten.";
    } else {
      time +=
        r.lateJoinDays > 0
          ? ` Einstieg bis ${late} nach dem Start möglich; Tage davor zählen als nicht erfüllt.`
          : " Mitmachen nur bis zum Start.";
    }
  } else {
    time += ", Start ab deinem Beitritt. Jeder kann jederzeit einsteigen.";
  }
  lines.push({ key: "time", title: "Dauer", text: time });

  // Verpasste Tage
  if (hasDayRules(r)) {
    const jokerText = jokers === 0 ? "" : `${jokers} Joker (${jokers === 1 ? `1 ${unitWord}` : `${jokers} ${unitPlural}`} ohne Folgen)`;
    let missed: string;
    if (r.missedRule === "strict") {
      missed = jokers
        ? `Streng: ${jokerText}. Wer danach noch ${r.frequency === "weekly" ? "eine Woche" : "einen Tag"} verpasst, scheidet aus.`
        : `Streng: Kein ${unitWord} darf fehlen, sonst scheidest du aus.`;
    } else if (r.missedRule === "streak") {
      missed = jokers
        ? `Serie zählt: ${jokerText} retten deine Serie. Ohne Joker beginnt die Serie von vorn, du bleibst aber dabei.`
        : "Serie zählt: Ein verpasster " + unitWord + " lässt die Serie von vorn beginnen, du bleibst aber dabei.";
    } else {
      missed = `Locker: Verpasste ${unitPlural} sind kein Problem, sie zählen einfach nicht.`;
    }
    lines.push({ key: "missed", title: "Verpasste " + unitPlural, text: missed });
  }

  // Geschafft bzw. wer gewinnt
  let done = "";
  if (r.metric === "most") {
    lines.push({
      key: "done",
      title: "Wer gewinnt",
      text:
        r.startMode === "fixed"
          ? "Am Ende steht vorn, wer insgesamt am meisten hat. Gleiche Menge = gleicher Platz."
          : "Die Rangliste vergleicht die Menge in den eigenen Tagen; ein gemeinsames Ende gibt es nicht.",
    });
  } else if (r.metric === "total") done = `Sobald ${amount(r.totalTarget ?? 0)} ${unitOf(r, r.totalTarget ?? 0)} zusammen sind${r.repeats ? " (je Runde neu)" : ""}.`;
  else {
    const need = requiredPeriods(r);
    done =
      r.period !== "days"
        ? `Wenn alle Tage ${r.repeats ? "der Runde" : r.period === "month" ? "bis Monatsende" : "bis Jahresende"} erfüllt sind`
        : need >= total
          ? `Wenn alle ${periodsLabel(total, r.frequency)} erfüllt sind${r.repeats ? " (je Runde)" : ""}`
          : `Mit mindestens ${need} von ${total} ${r.frequency === "weekly" ? "Wochen" : "Tagen"}${r.repeats ? " je Runde" : ""}`;
    done += jokers ? " (Joker zählen mit)." : ".";
  }
  if (r.metric !== "most") lines.push({ key: "done", title: "Geschafft", text: done });

  // Nachtragen
  let backfill: string;
  if (r.source === "workouts") backfill = "Nachgetragene Trainings zählen am Tag, an dem sie stattfanden.";
  else if (r.backfillDays === 0) backfill = "Eintragen nur am selben Tag.";
  else if (r.backfillDays === 1) backfill = "Nachtragen bis gestern möglich.";
  else backfill = `Nachtragen bis zu ${r.backfillDays} Tage zurück möglich.`;
  lines.push({ key: "backfill", title: "Eintragen", text: backfill });

  // Punkte
  let points: string;
  if (r.metric === "most") {
    points = `${POINTS.day} je Tag mit Eintrag`;
    points += hasPlaceBonus(r) ? `, am Ende ${r.repeats ? "jeder Runde " : ""}+${POINTS.place.join(" / +")} für Platz 1 bis 3.` : ".";
  } else if (r.metric === "total")
    points =
      r.period === "days"
        ? `Bis zu ${formatNumber(POINTS.day * r.durationDays)} Punkte je nach Fortschritt, +${POINTS.completion} fürs Schaffen.`
        : `Bis zu ${POINTS.day} je Tag der Runde, je nach Fortschritt; +${POINTS.completion} fürs Schaffen.`;
  else {
    points = `${POINTS.day} je erfülltem Tag`;
    if (r.frequency === "weekly") points += ` (höchstens ${r.daysPerWeek} je Woche)`;
    if (hasStreak(r)) points += `, +${POINTS.streakWeek} je volle Woche am Stück`;
    points += `, +${POINTS.completion} fürs Schaffen.`;
  }
  lines.push({ key: "points", title: "Punkte", text: points });

  return lines;
}

/** Status-Text einer Teilnahme: „Tag 12 von 30“, „Geschafft“, „Ausgeschieden“ … */
export function statusLabel(p: Progress): string {
  switch (p.status) {
    case "upcoming":
      return `Startet am ${dateLabel(p.from)}`;
    case "completed":
      return "Geschafft";
    case "failed":
      return "Ausgeschieden";
    case "ended":
      return "Nicht geschafft";
    case "finished":
      return "Beendet";
    default:
      return `Tag ${p.dayNumber} von ${p.durationDays}`;
  }
}

/** Fortschritt als Text: „12 von 30 Tagen“ bzw. „640 von 1.000 Liegestütze“. */
export function progressLabel(r: ChallengeRules, p: Progress): string {
  if (r.metric === "most") return `${amount(p.sum)} ${unitOf(r, p.sum)}`;
  if (r.metric === "total") return `${amount(p.sum)} von ${amount(r.totalTarget ?? 0)} ${unitOf(r, r.totalTarget ?? 0)}`;
  const unit = r.frequency === "weekly" ? (p.periodTotal === 1 ? "Woche" : "Wochen") : p.periodTotal === 1 ? "Tag" : "Tagen";
  return `${p.covered} von ${p.periodTotal} ${unit}`;
}

/**
 * Anteil für Fortschrittsbalken (0–1): Gesamtmenge nach Menge, Wettkampf nach vergangenen Tagen, sonst gerettete
 * Zeiträume gegen die nötigen.
 */
export function progressShare(r: ChallengeRules, p: Progress): number {
  if (r.metric === "most") return Math.min(1, p.dayNumber / Math.max(1, p.durationDays));
  if (r.metric === "total") return Math.min(1, p.sum / (r.totalTarget ?? Infinity));
  return Math.min(1, p.covered / Math.max(1, p.required));
}

// ---------------------------------------------------------------------------
// Gesamtrangliste (alle Challenges)
// ---------------------------------------------------------------------------

/** Eine Teilnahme an einer Challenge (bei Wiederholung je Runde eine). */
export type Participation = { challengeId: string; userId: string; name: string; hidden: boolean; progress: Progress };

export type LeaderRow = {
  userId: string;
  name: string;
  isMe: boolean;
  /** hat sich aus der Rangliste ausgeblendet (nur bei einem selbst sichtbar) */
  hidden: boolean;
  points: number;
  /** Challenges, bei denen man im Zeitraum dabei war */
  challenges: number;
  completed: number;
  bestStreak: number;
  rank: number;
};

/** „Dieser Monat“: erster bis letzter Tag des Monats von `today`. */
export function monthRange(today: string): { from: string; to: string } {
  const from = `${today.slice(0, 7)}-01`;
  const [y, m] = today.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from, to: `${today.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

/**
 * Gesamtrangliste: Punkte je Person über alle Challenges, im Zeitraum (`range`) oder insgesamt. Es zählt nur, wer
 * bei mindestens einer Challenge mitmacht (im Zeitraum: deren Zeitraum überschneidet ihn). Ausgeblendete fehlen,
 * außer man selbst. Gleiche Punkte = gleicher Platz.
 */
export function globalLeaderboard(participations: Participation[], meId: string, range: { from: string; to: string } | null): LeaderRow[] {
  const byUser = new Map<string, Omit<LeaderRow, "rank">>();
  const seen = new Set<string>();
  for (const p of participations) {
    if (p.hidden && p.userId !== meId) continue;
    if (range && (p.progress.to < range.from || p.progress.from > range.to)) continue;
    const row = byUser.get(p.userId) ?? { userId: p.userId, name: p.name, isMe: p.userId === meId, hidden: p.hidden, points: 0, challenges: 0, completed: 0, bestStreak: 0 };
    row.points += range ? pointsBetween(p.progress, range.from, range.to) : p.progress.points.total;
    // Runden derselben Challenge zählen als eine
    if (!seen.has(`${p.userId}|${p.challengeId}`)) row.challenges++;
    seen.add(`${p.userId}|${p.challengeId}`);
    const done = p.progress.completedOn;
    if (done && (!range || (done >= range.from && done <= range.to))) row.completed++;
    row.bestStreak = Math.max(row.bestStreak, p.progress.bestStreak);
    byUser.set(p.userId, row);
  }
  const sorted = [...byUser.values()].sort((a, b) => b.points - a.points || b.completed - a.completed || a.name.localeCompare(b.name, "de"));
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || row.points !== sorted[i - 1].points) rank = i + 1;
    return { ...row, rank };
  });
}

/**
 * Fortschritt aller Teilnehmer in einer Runde (Platzbonus eingerechnet). Wer erst ab einer späteren Runde dabei ist,
 * fehlt. „Ab Beitritt“: jeder in seinem eigenen Zeitraum.
 */
export function progressInRound<P extends { start: string }>(
  r: ChallengeRules,
  people: P[],
  round: Round,
  valuesOf: (person: P) => DayValues,
  today: string,
): { person: P; rules: ChallengeRules; progress: Progress }[] {
  const inRound = people.flatMap((person) => {
    const p = participationIn(r, person.start, round);
    return p ? [{ person, rules: p.rules, start: p.start }] : [];
  });
  const progresses = withPlaceBonus(
    inRound[0]?.rules ?? r,
    inRound.map((x) => participantProgress(x.rules, x.start, valuesOf(x.person), today)),
    today,
  );
  return inRound.map((x, i) => ({ person: x.person, rules: x.rules, progress: progresses[i] }));
}
