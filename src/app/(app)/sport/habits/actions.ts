"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";
import { habitCheckSchema, habitInputSchema, scheduleInputSchema, type HabitInput, type ScheduleInput } from "@/lib/validation/habits";
import { flattenIssues } from "@/lib/validation/recipe";

// Habit Tracker und Trainings-Wochenplan speichern. Wer was darf, entscheidet die RLS (nur eigene Daten).

const idSchema = z.uuid();

type Result = { ok: true } | { ok: false; message: string };
export type SaveResult = { ok: true; id: string } | { ok: false; message?: string; fieldErrors?: Record<string, string[]> };

function revalidateHabits() {
  revalidatePath("/sport/habits", "layout");
  revalidatePath("/");
}

/** Wie oft eine Gewohnheit an einem Tag erledigt wurde (0 = nicht). Nicht für Tage in der Zukunft. */
export async function setHabitCountAction(habitId: string, date: string, count: number): Promise<Result> {
  await requireUser();
  const parsed = habitCheckSchema.safeParse({ habitId, date, count });
  if (!parsed.success) return { ok: false, message: "Ungültige Angaben." };
  if (parsed.data.date > todayInBerlin()) return { ok: false, message: "Tage in der Zukunft lassen sich noch nicht abhaken." };
  const supabase = await createClient();
  const { error } =
    parsed.data.count === 0
      ? await supabase.from("habit_checks").delete().eq("habit_id", habitId).eq("day", date)
      : await supabase.from("habit_checks").upsert({ habit_id: habitId, day: date, count: parsed.data.count }, { onConflict: "habit_id,day" });
  if (error) return { ok: false, message: "Das konnte nicht gespeichert werden." };
  revalidateHabits();
  return { ok: true };
}

/** Gewohnheit anlegen (`habitId` null, ans Ende der Liste) oder ändern. */
export async function saveHabitAction(habitId: string | null, input: HabitInput): Promise<SaveResult> {
  const user = await requireUser();
  if (habitId && !idSchema.safeParse(habitId).success) return { ok: false, message: "Ungültige Gewohnheit." };
  const parsed = habitInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: flattenIssues(parsed.error) };
  const d = parsed.data;
  const row = {
    name: d.name,
    kind: d.kind,
    frequency: d.frequency,
    target: d.target,
    // Wochentage gibt es nur bei täglichen; alle sieben = jeden Tag
    weekdays: d.frequency === "daily" && d.weekdays.length < 7 ? [...d.weekdays].sort((a, b) => a - b) : [],
    daytime: d.daytime,
    at_time: d.atTime,
    dose: d.kind === "supplement" ? d.dose : null,
    notes: d.notes,
    color: d.color,
  };

  const supabase = await createClient();
  let result;
  if (habitId) {
    const current = await supabase.from("habits").select("paused_at").eq("id", habitId).eq("user_id", user.id).maybeSingle();
    if (current.error || !current.data) return { ok: false, message: "Die Gewohnheit gibt es nicht mehr." };
    // Pause: Zeitpunkt beim ersten Pausieren merken, beim Fortsetzen leeren
    const pausedAt = d.paused ? (current.data.paused_at ?? new Date().toISOString()) : null;
    result = await supabase.from("habits").update({ ...row, paused_at: pausedAt }).eq("id", habitId).eq("user_id", user.id).select("id");
  } else {
    const last = await supabase.from("habits").select("position").eq("user_id", user.id).order("position", { ascending: false }).limit(1).maybeSingle();
    result = await supabase
      .from("habits")
      .insert({ ...row, position: (last.data?.position ?? -1) + 1 })
      .select("id");
  }
  if (result.error) return { ok: false, message: "Die Gewohnheit konnte nicht gespeichert werden." };
  if (!result.data.length) return { ok: false, message: "Die Gewohnheit gibt es nicht mehr." };
  revalidateHabits();
  return { ok: true, id: result.data[0].id };
}

/** Reihenfolge speichern (Drag & Drop): Position = Index in `ids`. */
export async function reorderHabitsAction(ids: string[]): Promise<Result> {
  const user = await requireUser();
  const parsed = z.array(idSchema).max(200).safeParse(ids);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) return { ok: false, message: "Ungültige Reihenfolge." };
  const supabase = await createClient();
  const results = await Promise.all(parsed.data.map((id, position) => supabase.from("habits").update({ position }).eq("id", id).eq("user_id", user.id)));
  if (results.some((r) => r.error)) return { ok: false, message: "Die Reihenfolge konnte nicht gespeichert werden." };
  revalidateHabits();
  return { ok: true };
}

/** Gewohnheit samt aller Häkchen löschen. */
export async function deleteHabitAction(habitId: string): Promise<Result> {
  await requireUser();
  if (!idSchema.safeParse(habitId).success) return { ok: false, message: "Ungültige Gewohnheit." };
  const supabase = await createClient();
  const { error } = await supabase.from("habits").delete().eq("id", habitId);
  if (error) return { ok: false, message: "Die Gewohnheit konnte nicht gelöscht werden." };
  revalidateHabits();
  return { ok: true };
}

/** Einheit im Wochenplan anlegen (an mehreren Tagen auf einmal) oder ändern (genau ein Tag). */
export async function saveScheduleAction(entryId: string | null, input: ScheduleInput): Promise<SaveResult> {
  const user = await requireUser();
  if (entryId && !idSchema.safeParse(entryId).success) return { ok: false, message: "Ungültiger Eintrag." };
  const parsed = scheduleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: flattenIssues(parsed.error) };
  const d = parsed.data;
  if (entryId && d.weekdays.length !== 1) return { ok: false, fieldErrors: { weekdays: ["Genau einen Tag wählen."] } };
  const row = { daytime: d.daytime, at_time: d.atTime, title: d.title, category: d.category, duration_min: d.durationMin, notes: d.notes };

  const supabase = await createClient();
  const result = entryId
    ? await supabase.from("training_schedule").update({ ...row, weekday: d.weekdays[0] }).eq("id", entryId).eq("user_id", user.id).select("id")
    : await supabase
        .from("training_schedule")
        .insert([...new Set(d.weekdays)].map((weekday) => ({ ...row, weekday })))
        .select("id");
  if (result.error) return { ok: false, message: "Der Eintrag konnte nicht gespeichert werden." };
  if (!result.data.length) return { ok: false, message: "Den Eintrag gibt es nicht mehr." };
  revalidateHabits();
  return { ok: true, id: result.data[0].id };
}

export async function deleteScheduleAction(entryId: string): Promise<Result> {
  await requireUser();
  if (!idSchema.safeParse(entryId).success) return { ok: false, message: "Ungültiger Eintrag." };
  const supabase = await createClient();
  const { error } = await supabase.from("training_schedule").delete().eq("id", entryId);
  if (error) return { ok: false, message: "Der Eintrag konnte nicht gelöscht werden." };
  revalidateHabits();
  return { ok: true };
}
