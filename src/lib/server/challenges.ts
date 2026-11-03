import "server-only";
import {
  challengeStats,
  currentRoundFor,
  progressInRound,
  rankBoard,
  roundAt,
  roundIndexOn,
  roundLabel,
  roundsUntil,
  type BoardRow,
  type Challenge,
  type ChallengeFrequency,
  type ChallengeMetric,
  type ChallengePeriod,
  type ChallengeRules,
  type ChallengeSource,
  type ChallengeStats,
  type DayValues,
  type MissedRule,
  type ParticipationStatus,
  type Participation,
  type Progress,
  type Round,
  type StartMode,
} from "@/lib/domain/challenges";
import { authorName } from "@/lib/domain/community";
import { todayInBerlin } from "@/lib/domain/week";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// Challenges lesen. Challenges, Teilnahmen und Einträge sind für alle Eingeloggten sichtbar (Ranglisten);
// Trainings zählt die Datenbank-Funktion `challenge_workout_days` (nur Anzahl je Tag).

const CHALLENGE_COLUMNS =
  "id, title, description, icon, color, metric, source, unit, daily_target, total_target, frequency, days_per_week, duration_days, start_mode, starts_on, late_join_days, missed_rule, jokers, min_periods, backfill_days, period_kind, repeats, created_by, created_at, profiles!challenges_created_by_fkey(display_name)";

type ChallengeRow = Omit<Tables<"challenges">, "updated_at"> & { profiles: { display_name: string } | null };

function toChallenge(row: ChallengeRow): Challenge {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    color: row.color,
    createdBy: row.created_by,
    creatorName: authorName(row.profiles?.display_name),
    createdAt: row.created_at,
    metric: row.metric as ChallengeMetric,
    source: row.source as ChallengeSource,
    unit: row.unit,
    // numeric kommt als Zahl oder Text
    dailyTarget: row.daily_target == null ? null : Number(row.daily_target),
    totalTarget: row.total_target == null ? null : Number(row.total_target),
    frequency: row.frequency as ChallengeFrequency,
    daysPerWeek: row.days_per_week,
    durationDays: row.duration_days,
    startMode: row.start_mode as StartMode,
    startsOn: row.starts_on,
    lateJoinDays: row.late_join_days,
    missedRule: row.missed_rule as MissedRule,
    jokers: row.jokers,
    minPeriods: row.min_periods,
    backfillDays: row.backfill_days,
    period: (row.period_kind ?? "days") as ChallengePeriod,
    repeats: row.repeats ?? false,
  };
}

/** Runden einer Challenge bis heute (bzw. bis zur ersten eigenen, falls die später beginnt); „ab Beitritt“: eine. */
function roundsOf(c: Challenge, today: string): Round[] {
  return c.startMode === "fixed" ? roundsUntil(c, today) : [roundAt(c, 0)];
}

/** Werte je Person und Tag: Einträge bzw. Trainings. */
async function dayValues(challenge: Pick<Challenge, "id" | "source">, userId?: string): Promise<Map<string, DayValues>> {
  const supabase = await createClient();
  const out = new Map<string, DayValues>();
  const add = (user: string, day: string, value: number) => {
    let days = out.get(user);
    if (!days) out.set(user, (days = new Map()));
    days.set(day, value);
  };
  if (challenge.source === "workouts") {
    const { data, error } = await supabase.rpc("challenge_workout_days", { p_challenge_id: challenge.id });
    if (error) throw new Error(`Trainings der Challenge konnten nicht gelesen werden (${error.code})`);
    for (const r of data) if (!userId || r.user_id === userId) add(r.user_id, r.day, r.workouts);
    return out;
  }
  for (let page = 0; ; page++) {
    let query = supabase.from("challenge_entries").select("user_id, day, value").eq("challenge_id", challenge.id);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query.order("day").order("user_id").range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(`Einträge der Challenge konnten nicht gelesen werden (${error.code})`);
    for (const r of data) add(r.user_id, r.day, Number(r.value));
    if (data.length < 1000) return out;
  }
}

export type ChallengeListItem = {
  challenge: Challenge;
  participantCount: number;
  isOwn: boolean;
  /** eigene Teilnahme mit Fortschritt (laufende Runde bzw. die erste eigene) */
  mine: Progress | null;
  /** „November 2026“ bei Monats-/Jahres-Challenges und Wiederholung, sonst null */
  roundLabel: string | null;
};

/** Alle Challenges (neueste zuerst) mit Teilnehmerzahl und eigenem Fortschritt. */
export async function getChallenges(userId: string): Promise<ChallengeListItem[]> {
  const supabase = await createClient();
  const [challenges, participants] = await Promise.all([
    supabase.from("challenges").select(CHALLENGE_COLUMNS).order("created_at", { ascending: false }),
    supabase.from("challenge_participants").select("challenge_id, user_id, start_date"),
  ]);
  if (challenges.error) throw new Error(`Challenges konnten nicht geladen werden (${challenges.error.code})`);
  if (participants.error) throw new Error(`Teilnehmer konnten nicht geladen werden (${participants.error.code})`);

  const counts = new Map<string, number>();
  const myStart = new Map<string, string>();
  const starts = new Map<string, { userId: string; start: string }[]>();
  for (const p of participants.data) {
    counts.set(p.challenge_id, (counts.get(p.challenge_id) ?? 0) + 1);
    if (p.user_id === userId) myStart.set(p.challenge_id, p.start_date);
    starts.set(p.challenge_id, [...(starts.get(p.challenge_id) ?? []), { userId: p.user_id, start: p.start_date }]);
  }
  const today = todayInBerlin();
  const list = (challenges.data as ChallengeRow[]).map(toChallenge);
  const mine = await Promise.all(
    list.map(async (c) => {
      const start = myStart.get(c.id);
      if (!start) return null;
      const round = currentRoundFor(c, start, today);
      // Beendeter Wettkampf: Platzbonus braucht alle Teilnehmer
      const needsAll = c.metric === "most" && c.startMode === "fixed" && today > round.to;
      const values = await dayValues(c, needsAll ? undefined : userId);
      const people = needsAll ? (starts.get(c.id) ?? []) : [{ userId, start }];
      const rows = progressInRound(c, people, round, (p) => values.get(p.userId) ?? new Map(), today);
      return { progress: rows.find((x) => x.person.userId === userId)?.progress ?? null, round };
    }),
  );
  return list.map((challenge, i) => ({
    challenge,
    participantCount: counts.get(challenge.id) ?? 0,
    isOwn: challenge.createdBy === userId,
    mine: mine[i]?.progress ?? null,
    roundLabel: mine[i] && (challenge.repeats || challenge.period !== "days") ? roundLabel(challenge, mine[i]!.round) : null,
  }));
}

/** Ergebnis einer Runde für „Frühere Runden“. */
export type RoundSummary = {
  round: Round;
  label: string;
  participants: number;
  completed: number;
  /** Platz 1 (Name), wenn jemand etwas eingetragen hat */
  leader: string | null;
  mine: { status: ParticipationStatus; points: number; rank: number; sum: number; covered: number; periodTotal: number } | null;
};

export type ChallengeDetail = {
  challenge: Challenge;
  /** Regeln der gezeigten Runde (Dauer und Start der Runde) */
  rules: ChallengeRules;
  board: BoardRow[];
  me: BoardRow | null;
  stats: ChallengeStats;
  /** eigene Einträge (Tag → Wert), zum Bearbeiten */
  myValues: Record<string, number>;
  /** Regeln gesperrt (andere machen mit) */
  locked: boolean;
  /** alle Runden bis heute; gezeigt wird `selected` */
  rounds: { index: number; label: string }[];
  selected: number;
  current: number;
  history: RoundSummary[];
  /** Man macht mit, zählt aber erst ab einer späteren Runde */
  myNextRound: string | null;
  isParticipant: boolean;
};

/**
 * Eine Challenge mit allen Teilnehmern, ihrem Fortschritt und der Rangliste einer Runde (Standard: die laufende),
 * dazu die Ergebnisse aller Runden.
 */
export async function getChallengeDetail(id: string, userId: string, roundIndex?: number): Promise<ChallengeDetail | null> {
  const supabase = await createClient();
  const [challenge, participants] = await Promise.all([
    supabase.from("challenges").select(CHALLENGE_COLUMNS).eq("id", id).maybeSingle(),
    supabase
      .from("challenge_participants")
      .select("user_id, start_date, joined_at, profiles!challenge_participants_user_id_fkey(display_name)")
      .eq("challenge_id", id)
      .order("joined_at"),
  ]);
  if (challenge.error) throw new Error(`Challenge konnte nicht geladen werden (${challenge.error.code})`);
  if (!challenge.data) return null;
  if (participants.error) throw new Error(`Teilnehmer konnten nicht geladen werden (${participants.error.code})`);

  const c = toChallenge(challenge.data as ChallengeRow);
  const values = await dayValues(c);
  const today = todayInBerlin();
  const people = participants.data.map((p) => ({
    userId: p.user_id,
    start: p.start_date,
    name: authorName(p.profiles?.display_name),
    joinedAt: p.joined_at,
  }));
  const myStart = people.find((p) => p.userId === userId)?.start ?? null;

  const rounds = roundsOf(c, today);
  const boardOf = (round: Round) => {
    const rows = progressInRound(c, people, round, (p) => values.get(p.userId) ?? new Map(), today);
    const board = rankBoard(
      c,
      rows.map(({ person, progress }) => ({ userId: person.userId, name: person.name, isMe: person.userId === userId, joinedAt: person.joinedAt, progress })),
    );
    return { board, rules: rows[0]?.rules ?? roundRulesFallback(c, round) };
  };

  const current = rounds.length - 1;
  const selected = roundIndex != null && roundIndex >= 0 && roundIndex <= current ? roundIndex : current;
  const { board, rules } = boardOf(rounds[selected]);

  // Frühere Runden (bei Wiederholung): Ergebnis je Runde, neueste zuerst
  const history: RoundSummary[] =
    c.repeats && rounds.length > 1
      ? rounds
          .slice(0, -1)
          .map((round) => {
            const b = boardOf(round).board;
            const me = b.find((r) => r.isMe);
            return {
              round,
              label: roundLabel(c, round),
              participants: b.length,
              completed: b.filter((r) => r.progress.status === "completed").length,
              leader: b[0] && (b[0].progress.sum > 0 || b[0].progress.points.total > 0) ? b[0].name : null,
              mine: me
                ? { status: me.progress.status, points: me.progress.points.total, rank: me.rank, sum: me.progress.sum, covered: me.progress.covered, periodTotal: me.progress.periodTotal }
                : null,
            };
          })
          .reverse()
      : [];

  // Dabei, aber erst ab einer späteren Runde (bei Wiederholung nach dem Einstiegsfenster beigetreten)
  const myNextRound = myStart && c.startMode === "fixed" && myStart > rounds[current].to ? roundLabel(c, roundAt(c, roundIndexOn(c, myStart))) : null;

  return {
    challenge: c,
    rules,
    board,
    me: board.find((r) => r.isMe) ?? null,
    stats: challengeStats(rules, board, today),
    myValues: Object.fromEntries(values.get(userId) ?? []),
    locked: participants.data.some((p) => p.user_id !== c.createdBy),
    rounds: c.startMode === "fixed" && (c.repeats || c.period !== "days") ? rounds.map((r) => ({ index: r.index, label: roundLabel(c, r) })) : [],
    selected,
    current,
    history,
    myNextRound,
    isParticipant: myStart != null,
  };
}

/** Regeln einer Runde ohne Teilnehmer (für Statistik und Anzeige). */
function roundRulesFallback(c: Challenge, round: Round): ChallengeRules {
  return c.startMode === "fixed" ? { ...c, startsOn: round.from, durationDays: round.days, period: "days", repeats: false } : c;
}

/** Challenge zum Bearbeiten (nur Ersteller oder Admin); `locked`, wenn andere mitmachen. */
export async function getChallengeForEdit(id: string): Promise<{ challenge: Challenge; locked: boolean } | null> {
  const supabase = await createClient();
  const [challenge, others] = await Promise.all([
    supabase.from("challenges").select(CHALLENGE_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("challenge_participants").select("user_id").eq("challenge_id", id),
  ]);
  if (challenge.error) throw new Error(`Challenge konnte nicht geladen werden (${challenge.error.code})`);
  if (!challenge.data) return null;
  const c = toChallenge(challenge.data as ChallengeRow);
  return { challenge: c, locked: (others.data ?? []).some((p) => p.user_id !== c.createdBy) };
}

/** Eigene Challenges (aktive zuerst) für Habits „Heute“ und die Startseite. Fehler = keine. */
export async function getMyChallenges(userId: string): Promise<ChallengeListItem[] | null> {
  try {
    return (await getChallenges(userId)).filter((i) => i.mine);
  } catch {
    return null;
  }
}

export type Leaderboard = { participations: Participation[]; meHidden: boolean };

/**
 * Alle Teilnahmen aller Challenges mit Fortschritt (für die Gesamtrangliste). Die Rangliste selbst rechnet
 * `globalLeaderboard`; Ausgeblendete bleiben drin, damit man sich selbst trotzdem sieht.
 */
export async function getLeaderboard(userId: string): Promise<Leaderboard> {
  const supabase = await createClient();
  const [challenges, participants, me] = await Promise.all([
    supabase.from("challenges").select(CHALLENGE_COLUMNS),
    supabase.from("challenge_participants").select("challenge_id, user_id, start_date, profiles!challenge_participants_user_id_fkey(display_name, hide_from_leaderboard)"),
    supabase.from("profiles").select("hide_from_leaderboard").eq("id", userId).maybeSingle(),
  ]);
  if (challenges.error) throw new Error(`Challenges konnten nicht geladen werden (${challenges.error.code})`);
  if (participants.error) throw new Error(`Teilnehmer konnten nicht geladen werden (${participants.error.code})`);

  const list = (challenges.data as ChallengeRow[]).map(toChallenge);
  // Einträge aller selbst eingetragenen Challenges auf einmal, Trainings je Challenge
  const values = new Map<string, Map<string, DayValues>>();
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from("challenge_entries")
      .select("challenge_id, user_id, day, value")
      .order("challenge_id")
      .order("user_id")
      .order("day")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(`Einträge konnten nicht gelesen werden (${error.code})`);
    for (const r of data) {
      let users = values.get(r.challenge_id);
      if (!users) values.set(r.challenge_id, (users = new Map()));
      let days = users.get(r.user_id);
      if (!days) users.set(r.user_id, (days = new Map()));
      days.set(r.day, Number(r.value));
    }
    if (data.length < 1000) break;
  }
  await Promise.all(list.filter((c) => c.source === "workouts").map(async (c) => values.set(c.id, await dayValues(c))));

  const today = todayInBerlin();
  const participations: Participation[] = [];
  // Je Challenge und Runde rechnen, damit der Platzbonus (Wettkampf) alle Teilnehmer der Runde kennt
  for (const c of list) {
    const people = participants.data
      .filter((p) => p.challenge_id === c.id)
      .map((p) => ({ userId: p.user_id, start: p.start_date, name: authorName(p.profiles?.display_name), hidden: p.profiles?.hide_from_leaderboard ?? false }));
    for (const round of roundsOf(c, today)) {
      for (const { person, progress } of progressInRound(c, people, round, (p) => values.get(c.id)?.get(p.userId) ?? new Map(), today)) {
        participations.push({ challengeId: c.id, userId: person.userId, name: person.name, hidden: person.hidden, progress });
      }
    }
  }
  return { participations, meHidden: me.data?.hide_from_leaderboard ?? false };
}

/** Hat sich die Person aus der Gesamtrangliste ausgeblendet? (Fehler, z. B. Spalte fehlt = nein) */
export async function isLeaderboardHidden(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("hide_from_leaderboard").eq("id", userId).maybeSingle();
  return data?.hide_from_leaderboard ?? false;
}
