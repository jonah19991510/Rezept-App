import "server-only";
import {
  participantProgress,
  rankBoard,
  type BoardRow,
  type Challenge,
  type ChallengeFrequency,
  type ChallengeMetric,
  type ChallengeSource,
  type DayValues,
  type MissedRule,
  type Progress,
  type StartMode,
} from "@/lib/domain/challenges";
import { authorName } from "@/lib/domain/community";
import { todayInBerlin } from "@/lib/domain/week";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// Challenges lesen. Challenges, Teilnahmen und Einträge sind für alle Eingeloggten sichtbar (Ranglisten);
// Trainings zählt die Datenbank-Funktion `challenge_workout_days` (nur Anzahl je Tag).

const CHALLENGE_COLUMNS =
  "id, title, description, icon, color, metric, source, unit, daily_target, total_target, frequency, days_per_week, duration_days, start_mode, starts_on, late_join_days, missed_rule, jokers, min_periods, backfill_days, created_by, created_at, profiles!challenges_created_by_fkey(display_name)";

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
  };
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
  /** eigene Teilnahme mit Fortschritt */
  mine: Progress | null;
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
  for (const p of participants.data) {
    counts.set(p.challenge_id, (counts.get(p.challenge_id) ?? 0) + 1);
    if (p.user_id === userId) myStart.set(p.challenge_id, p.start_date);
  }
  const today = todayInBerlin();
  const list = (challenges.data as ChallengeRow[]).map(toChallenge);
  const mine = await Promise.all(
    list.map(async (c) => {
      const start = myStart.get(c.id);
      if (!start) return null;
      const values = (await dayValues(c, userId)).get(userId) ?? new Map();
      return participantProgress(c, start, values, today);
    }),
  );
  return list.map((challenge, i) => ({
    challenge,
    participantCount: counts.get(challenge.id) ?? 0,
    isOwn: challenge.createdBy === userId,
    mine: mine[i],
  }));
}

export type ChallengeDetail = {
  challenge: Challenge;
  board: BoardRow[];
  me: BoardRow | null;
  /** eigene Einträge (Tag → Wert), zum Bearbeiten */
  myValues: Record<string, number>;
  /** Regeln gesperrt (andere machen mit) */
  locked: boolean;
};

/** Eine Challenge mit allen Teilnehmern, ihrem Fortschritt und der Rangliste. */
export async function getChallengeDetail(id: string, userId: string): Promise<ChallengeDetail | null> {
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
  const board = rankBoard(
    c,
    participants.data.map((p) => ({
      userId: p.user_id,
      name: authorName(p.profiles?.display_name),
      isMe: p.user_id === userId,
      joinedAt: p.joined_at,
      progress: participantProgress(c, p.start_date, values.get(p.user_id) ?? new Map(), today),
    })),
  );
  return {
    challenge: c,
    board,
    me: board.find((r) => r.isMe) ?? null,
    myValues: Object.fromEntries(values.get(userId) ?? []),
    locked: participants.data.some((p) => p.user_id !== c.createdBy),
  };
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
