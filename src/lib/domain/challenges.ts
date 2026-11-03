// Challenges (Sport & Gesundheit, 03.11.2026): reine Logik ohne Datenbank.
// Regeln in Klartext, Fortschritt je Teilnehmer (erfüllte Tage, Joker, Serie, Status), Punkte, Rangliste, Statistik.
// Tage sind Kalendertage in deutscher Zeit („YYYY-MM-DD“).

import { formatNumber } from "@/lib/format";
import { addDays, daysBetween, weekdayShort } from "./week";

export type ChallengeMetric = "check" | "daily" | "total";
export type ChallengeSource = "manual" | "workouts";
export type ChallengeFrequency = "daily" | "weekly";
export type StartMode = "fixed" | "join";
export type MissedRule = "strict" | "streak" | "relaxed";

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

/** Joker gibt es nur bei „Streng“ und „Serie zählt“. */
export function jokersOf(r: Pick<ChallengeRules, "missedRule" | "jokers" | "metric">): number {
  return r.metric === "total" || r.missedRule === "relaxed" ? 0 : r.jokers;
}

/** Zählt die Serie (und damit der Serienbonus)? */
export function hasStreak(r: Pick<ChallengeRules, "missedRule" | "metric">): boolean {
  return r.metric !== "total" && r.missedRule !== "relaxed";
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
  | { kind: "running"; day: number; of: number; endsOn: string }
  | { kind: "over"; endedOn: string }
  | { kind: "open" };

export function challengePhase(r: Pick<ChallengeRules, "startMode" | "startsOn" | "durationDays">, today: string): ChallengePhase {
  if (r.startMode === "join" || !r.startsOn) return { kind: "open" };
  const end = addDays(r.startsOn, r.durationDays - 1);
  if (today < r.startsOn) return { kind: "upcoming", startsOn: r.startsOn, daysUntil: daysBetween(today, r.startsOn) };
  if (today > end) return { kind: "over", endedOn: end };
  return { kind: "running", day: daysBetween(r.startsOn, today) + 1, of: r.durationDays, endsOn: end };
}

/** Kann man (noch) mitmachen? Fester Start: bis zum Start plus „späterer Einstieg“. */
export function canJoin(r: Pick<ChallengeRules, "startMode" | "startsOn" | "lateJoinDays">, today: string): boolean {
  if (r.startMode === "join" || !r.startsOn) return true;
  return today <= addDays(r.startsOn, r.lateJoinDays);
}

// ---------------------------------------------------------------------------
// Fortschritt einer Teilnahme
// ---------------------------------------------------------------------------

/** met: erfüllt · partial: Menge eingetragen, Ziel nicht erreicht · joker: per Joker gerettet · missed: verpasst ·
 * open: noch änderbar, (noch) nicht erfüllt · future: kommt noch · empty: kein Eintrag, zählt nicht (Wochen, Gesamtmenge) */
export type CellState = "met" | "partial" | "joker" | "missed" | "open" | "future" | "empty";
export type DayCell = { date: string; state: CellState; value: number };
export type PeriodCell = { index: number; from: string; to: string; state: CellState; metDays: number };

export type ParticipationStatus = "upcoming" | "active" | "completed" | "failed" | "ended";

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
  metDays: number;
  completedOn: string | null;
  failedOn: string | null;
  points: { days: number; streak: number; completion: number; total: number };
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
  const periodTotal = r.metric === "total" ? 1 : periodCount(r);
  const required = r.metric === "total" ? 1 : requiredPeriods(r);
  const jokers = jokersOf(r);
  const dayNumber = today < from ? 0 : today > to ? r.durationDays : daysBetween(from, today) + 1;

  const days: DayCell[] = [];
  let sum = 0;
  let metDays = 0;
  for (let i = 0; i < r.durationDays; i++) {
    const date = addDays(from, i);
    const value = values.get(date) ?? 0;
    if (date > today) {
      days.push({ date, state: "future", value: 0 });
      continue;
    }
    sum += value;
    const met = dayMet(r, value);
    if (met) metDays++;
    const open = isDayOpen(date, today, r.backfillDays);
    let state: CellState;
    if (met) state = "met";
    else if (value > 0) state = "partial";
    else if (open) state = "open";
    // Bei Wochen und Gesamtmenge ist ein einzelner leerer Tag nicht „verpasst“ (das entscheidet die Woche)
    else state = r.metric === "total" || r.frequency === "weekly" ? "empty" : "missed";
    days.push({ date, state, value });
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
      metDays,
      completedOn,
      failedOn: null,
      points: { days: pointsDays, streak: 0, completion, total: pointsDays + completion },
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
    metDays,
    completedOn,
    failedOn,
    points: { days: pointsDays, streak: streakBonus, completion, total: pointsDays + streakBonus + completion },
    pointLog,
  };
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
 * Rangliste einer Challenge. Gesamtmenge: nach Menge. Sonst nach Punkten, dann erfüllten Zeiträumen, dann Menge;
 * Ausgeschiedene stehen unten. Gleichstand = gleicher Platz.
 */
export function rankBoard(r: Pick<ChallengeRules, "metric">, rows: Omit<BoardRow, "rank">[]): BoardRow[] {
  const key = (row: Omit<BoardRow, "rank">) =>
    r.metric === "total"
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
};

export function challengeStats(r: ChallengeRules, board: Pick<BoardRow, "progress">[], today: string): ChallengeStats {
  const byStatus: Record<ParticipationStatus, number> = { upcoming: 0, active: 0, completed: 0, failed: 0, ended: 0 };
  let sum = 0;
  const todayCount = { met: 0, due: 0 };
  const perDay = new Map<string, DayRate>();
  for (const { progress } of board) {
    byStatus[progress.status]++;
    sum += progress.sum;
    for (const d of progress.days) {
      if (d.state === "future") continue;
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
  return { participants: board.length, byStatus, today: todayCount, sum, rates };
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

/** „30 Tage“ bzw. „4 Wochen“ */
export function durationLabel(r: Pick<ChallengeRules, "frequency" | "durationDays">): string {
  return r.frequency === "weekly" ? periodsLabel(Math.floor(r.durationDays / 7), "weekly") : periodsLabel(r.durationDays, "daily");
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
  if (r.metric === "total") {
    goal = `${goalLabel(r)} sammeln. Wann und wie viel pro Tag, ist egal.`;
  } else if (r.source === "workouts") {
    goal = r.frequency === "weekly" ? `${goalLabel(r)}.` : "An jedem Tag mindestens ein Training.";
  } else if (r.metric === "daily") {
    goal = `${goalLabel(r)}. Ein Tag zählt, wenn das Tagesziel erreicht ist.`;
  } else {
    goal = r.frequency === "weekly" ? `${goalLabel(r)}, wenn du es geschafft hast.` : "Jeden Tag abhaken, wenn du es geschafft hast.";
  }
  if (r.source === "workouts") goal += " Zählt automatisch aus deinen beendeten Trainings.";
  lines.push({ key: "goal", title: "Was zählt", text: goal });

  // Dauer und Start
  let time = durationLabel(r);
  if (r.startMode === "fixed" && r.startsOn) {
    time += `, Start am ${dateLabel(r.startsOn)} für alle (Ende am ${dateLabel(addDays(r.startsOn, r.durationDays - 1))}).`;
    time +=
      r.lateJoinDays > 0
        ? ` Einstieg bis ${r.lateJoinDays === 1 ? "1 Tag" : `${r.lateJoinDays} Tage`} nach dem Start möglich; Tage davor zählen als nicht erfüllt.`
        : " Mitmachen nur bis zum Start.";
  } else {
    time += ", Start ab deinem Beitritt. Jeder kann jederzeit einsteigen.";
  }
  lines.push({ key: "time", title: "Dauer", text: time });

  // Verpasste Tage
  if (r.metric !== "total") {
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

  // Geschafft
  let done: string;
  if (r.metric === "total") done = `Sobald ${amount(r.totalTarget ?? 0)} ${unitOf(r, r.totalTarget ?? 0)} zusammen sind.`;
  else {
    const need = requiredPeriods(r);
    done =
      need >= total
        ? `Wenn alle ${periodsLabel(total, r.frequency)} erfüllt sind`
        : `Mit mindestens ${need} von ${total} ${r.frequency === "weekly" ? "Wochen" : "Tagen"}`;
    done += jokers ? " (Joker zählen mit)." : ".";
  }
  lines.push({ key: "done", title: "Geschafft", text: done });

  // Nachtragen
  let backfill: string;
  if (r.source === "workouts") backfill = "Nachgetragene Trainings zählen am Tag, an dem sie stattfanden.";
  else if (r.backfillDays === 0) backfill = "Eintragen nur am selben Tag.";
  else if (r.backfillDays === 1) backfill = "Nachtragen bis gestern möglich.";
  else backfill = `Nachtragen bis zu ${r.backfillDays} Tage zurück möglich.`;
  lines.push({ key: "backfill", title: "Eintragen", text: backfill });

  // Punkte
  let points: string;
  if (r.metric === "total") points = `Bis zu ${formatNumber(POINTS.day * r.durationDays)} Punkte je nach Fortschritt, +${POINTS.completion} fürs Schaffen.`;
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
    default:
      return `Tag ${p.dayNumber} von ${p.durationDays}`;
  }
}

/** Fortschritt als Text: „12 von 30 Tagen“ bzw. „640 von 1.000 Liegestütze“. */
export function progressLabel(r: ChallengeRules, p: Progress): string {
  if (r.metric === "total") return `${amount(p.sum)} von ${amount(r.totalTarget ?? 0)} ${unitOf(r, r.totalTarget ?? 0)}`;
  const unit = r.frequency === "weekly" ? (p.periodTotal === 1 ? "Woche" : "Wochen") : p.periodTotal === 1 ? "Tag" : "Tagen";
  return `${p.covered} von ${p.periodTotal} ${unit}`;
}

/** Anteil für Fortschrittsbalken (0–1): Gesamtmenge nach Menge, sonst gerettete Zeiträume gegen die nötigen. */
export function progressShare(r: ChallengeRules, p: Progress): number {
  if (r.metric === "total") return Math.min(1, p.sum / (r.totalTarget ?? Infinity));
  return Math.min(1, p.covered / Math.max(1, p.required));
}

// ---------------------------------------------------------------------------
// Gesamtrangliste (alle Challenges)
// ---------------------------------------------------------------------------

export type Participation = { userId: string; name: string; hidden: boolean; progress: Progress };

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
  for (const p of participations) {
    if (p.hidden && p.userId !== meId) continue;
    if (range && (p.progress.to < range.from || p.progress.from > range.to)) continue;
    const row = byUser.get(p.userId) ?? { userId: p.userId, name: p.name, isMe: p.userId === meId, hidden: p.hidden, points: 0, challenges: 0, completed: 0, bestStreak: 0 };
    row.points += range ? pointsBetween(p.progress, range.from, range.to) : p.progress.points.total;
    row.challenges++;
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
