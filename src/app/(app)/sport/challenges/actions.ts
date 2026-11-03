"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";
import { challengeEntrySchema, challengeInputSchema, type ChallengeInput } from "@/lib/validation/challenges";
import { flattenIssues } from "@/lib/validation/recipe";

// Challenges anlegen, bearbeiten, mitmachen, eintragen. Wer was darf (eigene Challenges, gesperrte Regeln, Zeitfenster
// fürs Eintragen), entscheidet zusätzlich die Datenbank (RLS und Trigger).

const idSchema = z.uuid();

type Result = { ok: true } | { ok: false; message: string };
export type SaveResult = { ok: true; id: string } | { ok: false; message?: string; fieldErrors?: Record<string, string[]> };

function revalidateChallenges(id?: string) {
  revalidatePath("/sport/entdecken", "layout");
  if (id) revalidatePath(`/sport/challenges/${id}`);
  // Challenges stehen auch unter Habits „Heute“ und auf der Startseite
  revalidatePath("/sport/habits");
  revalidatePath("/");
}

/** Challenge anlegen (`challengeId` null, auf Wunsch gleich mitmachen) oder ändern. */
export async function saveChallengeAction(challengeId: string | null, input: ChallengeInput): Promise<SaveResult> {
  await requireUser();
  if (challengeId && !idSchema.safeParse(challengeId).success) return { ok: false, message: "Ungültige Challenge." };
  const parsed = challengeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: flattenIssues(parsed.error) };
  const { title, description, icon, color, isPublic, join, rules } = parsed.data;
  const row = {
    title,
    is_public: isPublic,
    description,
    icon,
    color,
    metric: rules.metric,
    source: rules.source,
    unit: rules.unit,
    daily_target: rules.dailyTarget,
    total_target: rules.totalTarget,
    frequency: rules.frequency,
    days_per_week: rules.daysPerWeek,
    duration_days: rules.durationDays,
    start_mode: rules.startMode,
    starts_on: rules.startsOn,
    late_join_days: rules.lateJoinDays,
    missed_rule: rules.missedRule,
    jokers: rules.jokers,
    min_periods: rules.minPeriods,
    backfill_days: rules.backfillDays,
    period_kind: rules.period,
    repeats: rules.repeats,
  };

  const supabase = await createClient();
  const today = todayInBerlin();
  if (challengeId) {
    const current = await supabase.from("challenges").select("starts_on").eq("id", challengeId).maybeSingle();
    if (current.error || !current.data) return { ok: false, message: "Die Challenge gibt es nicht mehr." };
    if (rules.startsOn && rules.startsOn !== current.data.starts_on && rules.startsOn < today) {
      return { ok: false, fieldErrors: { startsOn: ["Der Start darf nicht in der Vergangenheit liegen."] } };
    }
    const { data, error } = await supabase.from("challenges").update(row).eq("id", challengeId).select("id");
    // Die Sperren der Datenbank (Regeln, privat werden) melden sich mit verständlichem Text
    if (error?.code === "42501") return { ok: false, message: error.message || "Es machen schon andere mit, das lässt sich nicht mehr ändern." };
    if (error) return { ok: false, message: "Die Challenge konnte nicht gespeichert werden." };
    if (!data.length) return { ok: false, message: "Du darfst diese Challenge nicht bearbeiten." };
    revalidateChallenges(challengeId);
    return { ok: true, id: challengeId };
  }

  if (rules.startsOn && rules.startsOn < today) return { ok: false, fieldErrors: { startsOn: ["Der Start darf nicht in der Vergangenheit liegen."] } };
  const { data, error } = await supabase.from("challenges").insert(row).select("id").single();
  if (error) return { ok: false, message: "Die Challenge konnte nicht gespeichert werden." };
  if (join) await supabase.from("challenge_participants").insert({ challenge_id: data.id });
  revalidateChallenges(data.id);
  return { ok: true, id: data.id };
}

export async function joinChallengeAction(challengeId: string): Promise<Result> {
  await requireUser();
  if (!idSchema.safeParse(challengeId).success) return { ok: false, message: "Ungültige Challenge." };
  const supabase = await createClient();
  const { error } = await supabase.from("challenge_participants").insert({ challenge_id: challengeId });
  if (error?.code === "23505") return { ok: true };
  if (error?.code === "42501") return { ok: false, message: "Der Einstieg ist nicht mehr möglich." };
  if (error) return { ok: false, message: "Mitmachen hat nicht geklappt." };
  revalidateChallenges(challengeId);
  return { ok: true };
}

/** Austreten: löscht die eigene Teilnahme samt aller Einträge. */
export async function leaveChallengeAction(challengeId: string): Promise<Result> {
  const user = await requireUser();
  if (!idSchema.safeParse(challengeId).success) return { ok: false, message: "Ungültige Challenge." };
  const supabase = await createClient();
  const { error } = await supabase.from("challenge_participants").delete().eq("challenge_id", challengeId).eq("user_id", user.id);
  if (error) return { ok: false, message: "Austreten hat nicht geklappt." };
  revalidateChallenges(challengeId);
  return { ok: true };
}

/** Löschen: Ersteller, solange niemand sonst mitmacht; Admins immer. */
export async function deleteChallengeAction(challengeId: string): Promise<Result> {
  await requireUser();
  if (!idSchema.safeParse(challengeId).success) return { ok: false, message: "Ungültige Challenge." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("challenges").delete().eq("id", challengeId).select("id");
  if (error) return { ok: false, message: "Die Challenge konnte nicht gelöscht werden." };
  if (!data.length) return { ok: false, message: "Es machen schon andere mit. Löschen kann dann nur ein Admin." };
  revalidateChallenges();
  return { ok: true };
}

/** Wert eines Tages setzen (abhaken: 1, Menge: Tageswert; 0 = austragen). */
export async function setChallengeEntryAction(challengeId: string, date: string, value: number): Promise<Result> {
  await requireUser();
  const parsed = challengeEntrySchema.safeParse({ challengeId, date, value });
  if (!parsed.success) return { ok: false, message: "Ungültige Angaben." };
  if (parsed.data.date > todayInBerlin()) return { ok: false, message: "Tage in der Zukunft lassen sich noch nicht eintragen." };
  const supabase = await createClient();
  // Mengen auf zwei Nachkommastellen (wie in der Datenbank)
  const rounded = Math.round(parsed.data.value * 100) / 100;
  const { error } =
    rounded === 0
      ? await supabase.from("challenge_entries").delete().eq("challenge_id", challengeId).eq("day", date)
      : await supabase.from("challenge_entries").upsert({ challenge_id: challengeId, day: date, value: rounded }, { onConflict: "challenge_id,user_id,day" });
  if (error?.code === "42501") return { ok: false, message: "Dieser Tag lässt sich nicht mehr ändern." };
  if (error) return { ok: false, message: "Das konnte nicht gespeichert werden." };
  revalidateChallenges(challengeId);
  return { ok: true };
}

/** In der Gesamtrangliste zeigen oder ausblenden (nur das eigene Profil). */
export async function setLeaderboardHiddenAction(hidden: boolean): Promise<Result> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ hide_from_leaderboard: Boolean(hidden) }).eq("id", user.id);
  if (error) return { ok: false, message: "Das konnte nicht gespeichert werden." };
  revalidatePath("/sport/entdecken", "layout");
  revalidatePath("/einstellungen");
  return { ok: true };
}
