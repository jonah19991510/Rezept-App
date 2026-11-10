"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { targetForRoutines } from "@/lib/domain/habits";
import { todayInBerlin } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";
import {
  habitCheckSchema,
  habitInputSchema,
  routineDaySchema,
  routineInputSchema,
  scheduleInputSchema,
  type HabitInput,
  type RoutineInput,
  type ScheduleInput,
} from "@/lib/validation/habits";
import { flattenIssues } from "@/lib/validation/recipe";

// Habit Tracker, Routinen und Trainings-Wochenplan speichern. Wer was darf, entscheidet die RLS (nur eigene Daten).

const idSchema = z.uuid();

type Result = { ok: true } | { ok: false; message: string };
export type SaveResult = { ok: true; id: string } | { ok: false; message?: string; fieldErrors?: Record<string, string[]> };
type Supabase = Awaited<ReturnType<typeof createClient>>;

function revalidateHabits() {
  revalidatePath("/sport/habits", "layout");
  revalidatePath("/");
}

/**
 * Wie oft eine Gewohnheit an einem Tag erledigt wurde (0 = nicht). Nicht für Tage in der Zukunft. Sinkt die Zahl
 * unter die Häkchen in Routinen, fallen diese weg (die Routinen füllen sich dann der Reihe nach aus der Zahl).
 */
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
  const marked = await supabase.from("habit_routine_checks").select("routine_id", { count: "exact", head: true }).eq("habit_id", habitId).eq("day", date);
  if (!marked.error && (marked.count ?? 0) > parsed.data.count) {
    await supabase.from("habit_routine_checks").delete().eq("habit_id", habitId).eq("day", date);
  }
  revalidateHabits();
  return { ok: true };
}

/**
 * Punkte einer Routine an einem Tag abhaken (auch mehrere auf einmal, z. B. „alle“): je Punkt die Zahl des Tages und
 * die Routinen, in denen er abgehakt ist.
 */
export async function setRoutineDaysAction(updates: { habitId: string; date: string; count: number; routineIds: string[] }[]): Promise<Result> {
  await requireUser();
  const parsed = z.array(routineDaySchema).min(1).max(100).safeParse(updates);
  if (!parsed.success) return { ok: false, message: "Ungültige Angaben." };
  const today = todayInBerlin();
  if (parsed.data.some((u) => u.date > today)) return { ok: false, message: "Tage in der Zukunft lassen sich noch nicht abhaken." };
  const supabase = await createClient();
  const results = await Promise.all(
    parsed.data.map(async (u) => {
      const count =
        u.count === 0
          ? await supabase.from("habit_checks").delete().eq("habit_id", u.habitId).eq("day", u.date)
          : await supabase.from("habit_checks").upsert({ habit_id: u.habitId, day: u.date, count: u.count }, { onConflict: "habit_id,day" });
      if (count.error) return false;
      let removed = supabase.from("habit_routine_checks").delete().eq("habit_id", u.habitId).eq("day", u.date);
      if (u.routineIds.length) removed = removed.not("routine_id", "in", `(${u.routineIds.join(",")})`);
      const del = await removed;
      if (del.error) return false;
      if (u.routineIds.length === 0) return true;
      const ins = await supabase
        .from("habit_routine_checks")
        .upsert(
          u.routineIds.map((routineId) => ({ routine_id: routineId, habit_id: u.habitId, day: u.date })),
          { onConflict: "routine_id,habit_id,day", ignoreDuplicates: true },
        );
      return !ins.error;
    }),
  );
  if (results.some((ok) => !ok)) return { ok: false, message: "Das konnte nicht gespeichert werden." };
  revalidateHabits();
  return { ok: true };
}

/** Gewohnheit anlegen (`habitId` null, ans Ende der Liste) oder ändern, samt der Routinen, in denen sie steht. */
export async function saveHabitAction(habitId: string | null, input: HabitInput): Promise<SaveResult> {
  const user = await requireUser();
  if (habitId && !idSchema.safeParse(habitId).success) return { ok: false, message: "Ungültige Gewohnheit." };
  const parsed = habitInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: flattenIssues(parsed.error) };
  const d = parsed.data;
  // Routinen gibt es nur bei täglichen; Punkte einer Routine haben keine eigene Uhrzeit
  const routineIds = d.frequency === "daily" ? d.routineIds : [];
  const row = {
    name: d.name,
    kind: d.kind,
    frequency: d.frequency,
    // Tagesziel mindestens die Zahl der Routinen (je Routine ein Häkchen)
    target: Math.max(d.target, routineIds.length),
    // Wochentage gibt es nur bei täglichen; alle sieben = jeden Tag
    weekdays: d.frequency === "daily" && d.weekdays.length < 7 ? [...d.weekdays].sort((a, b) => a - b) : [],
    daytime: d.daytime,
    at_time: routineIds.length ? null : d.atTime,
    // alte Spalte (bis 10.11.2026): Routinen stehen jetzt in habit_routine_items
    routine: null,
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
  const id = result.data[0].id;

  const membership = await setHabitRoutines(supabase, id, routineIds);
  if (!membership) return { ok: false, message: "Gespeichert, aber die Routinen konnten nicht angepasst werden." };
  revalidateHabits();
  return { ok: true, id };
}

/** Routinen eines Habits setzen: aus anderen entfernen, in neue ans Ende. */
async function setHabitRoutines(supabase: Supabase, habitId: string, routineIds: string[]): Promise<boolean> {
  const current = await supabase.from("habit_routine_items").select("routine_id").eq("habit_id", habitId);
  if (current.error) return false;
  const have = new Set(current.data.map((i) => i.routine_id));
  const remove = [...have].filter((id) => !routineIds.includes(id));
  const add = routineIds.filter((id) => !have.has(id));
  if (remove.length) {
    const { error } = await supabase.from("habit_routine_items").delete().eq("habit_id", habitId).in("routine_id", remove);
    if (error) return false;
  }
  for (const routineId of add) {
    const last = await supabase.from("habit_routine_items").select("position").eq("routine_id", routineId).order("position", { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from("habit_routine_items").insert({ routine_id: routineId, habit_id: habitId, position: (last.data?.position ?? -1) + 1 });
    if (error) return false;
  }
  return true;
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

/** Gewohnheit samt aller Häkchen löschen (auch aus allen Routinen). */
export async function deleteHabitAction(habitId: string): Promise<Result> {
  await requireUser();
  if (!idSchema.safeParse(habitId).success) return { ok: false, message: "Ungültige Gewohnheit." };
  const supabase = await createClient();
  const { error } = await supabase.from("habits").delete().eq("id", habitId);
  if (error) return { ok: false, message: "Die Gewohnheit konnte nicht gelöscht werden." };
  revalidateHabits();
  return { ok: true };
}

/**
 * Tagesziele anpassen, nachdem Habits in Routinen hinzugekommen oder herausgefallen sind (`changes`: Habit-ID → +1 / −1,
 * gelesen wird der Stand danach).
 */
async function adjustTargets(supabase: Supabase, changes: Map<string, number>): Promise<boolean> {
  if (changes.size === 0) return true;
  const ids = [...changes.keys()];
  const [habits, items] = await Promise.all([
    supabase.from("habits").select("id, target").in("id", ids),
    supabase.from("habit_routine_items").select("habit_id").in("habit_id", ids),
  ]);
  if (habits.error || items.error) return false;
  const results = await Promise.all(
    habits.data.map((h) => {
      const after = items.data.filter((i) => i.habit_id === h.id).length;
      const before = after - (changes.get(h.id) ?? 0);
      const target = targetForRoutines(h.target, before, after);
      return target === h.target ? Promise.resolve({ error: null }) : supabase.from("habits").update({ target }).eq("id", h.id);
    }),
  );
  return results.every((r) => !r.error);
}

/**
 * Routine anlegen (`routineId` null, ans Ende) oder ändern: Name, Platz unter „Heute“, Farbe und Punkte in
 * Reihenfolge. Nur tägliche Habits können Punkte sein; das Tagesziel neuer und entfernter Punkte folgt der Zahl ihrer
 * Routinen.
 */
export async function saveRoutineAction(routineId: string | null, input: RoutineInput): Promise<SaveResult> {
  const user = await requireUser();
  if (routineId && !idSchema.safeParse(routineId).success) return { ok: false, message: "Ungültige Routine." };
  const parsed = routineInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: flattenIssues(parsed.error) };
  const d = parsed.data;
  const supabase = await createClient();

  // Nur eigene tägliche Habits
  const allowed = d.habitIds.length
    ? await supabase.from("habits").select("id").eq("user_id", user.id).eq("frequency", "daily").in("id", d.habitIds)
    : { data: [] as { id: string }[], error: null };
  if (allowed.error) return { ok: false, message: "Die Routine konnte nicht gespeichert werden." };
  const okIds = new Set(allowed.data.map((h) => h.id));
  const habitIds = d.habitIds.filter((id) => okIds.has(id));

  const row = { name: d.name, daytime: d.daytime, color: d.color };
  let id: string;
  if (routineId) {
    const result = await supabase.from("habit_routines").update(row).eq("id", routineId).eq("user_id", user.id).select("id");
    if (result.error) return { ok: false, message: "Die Routine konnte nicht gespeichert werden." };
    if (!result.data.length) return { ok: false, message: "Die Routine gibt es nicht mehr." };
    id = routineId;
  } else {
    const last = await supabase.from("habit_routines").select("position").eq("user_id", user.id).order("position", { ascending: false }).limit(1).maybeSingle();
    const result = await supabase
      .from("habit_routines")
      .insert({ ...row, position: (last.data?.position ?? -1) + 1 })
      .select("id")
      .single();
    if (result.error) return { ok: false, message: "Die Routine konnte nicht gespeichert werden." };
    id = result.data.id;
  }

  const current = await supabase.from("habit_routine_items").select("habit_id").eq("routine_id", id);
  if (current.error) return { ok: false, message: "Die Punkte konnten nicht gespeichert werden." };
  const have = new Set(current.data.map((i) => i.habit_id));
  const removed = [...have].filter((h) => !habitIds.includes(h));
  const added = habitIds.filter((h) => !have.has(h));
  if (removed.length) {
    const { error } = await supabase.from("habit_routine_items").delete().eq("routine_id", id).in("habit_id", removed);
    if (error) return { ok: false, message: "Die Punkte konnten nicht gespeichert werden." };
  }
  const saved = await Promise.all(
    habitIds.map((habitId, position) =>
      have.has(habitId)
        ? supabase.from("habit_routine_items").update({ position }).eq("routine_id", id).eq("habit_id", habitId)
        : supabase.from("habit_routine_items").insert({ routine_id: id, habit_id: habitId, position }),
    ),
  );
  if (saved.some((r) => r.error)) return { ok: false, message: "Die Punkte konnten nicht gespeichert werden." };
  const changes = new Map<string, number>([...added.map((h) => [h, 1] as const), ...removed.map((h) => [h, -1] as const)]);
  if (!(await adjustTargets(supabase, changes))) return { ok: false, message: "Gespeichert, aber die Tagesziele konnten nicht angepasst werden." };
  revalidateHabits();
  return { ok: true, id };
}

/** Reihenfolge der Punkte einer Routine (Drag & Drop): Position = Index in `habitIds`. */
export async function reorderRoutineAction(routineId: string, habitIds: string[]): Promise<Result> {
  await requireUser();
  const parsed = z.array(idSchema).max(100).safeParse(habitIds);
  if (!idSchema.safeParse(routineId).success || !parsed.success || new Set(parsed.data).size !== parsed.data.length) return { ok: false, message: "Ungültige Reihenfolge." };
  const supabase = await createClient();
  const results = await Promise.all(parsed.data.map((habitId, position) => supabase.from("habit_routine_items").update({ position }).eq("routine_id", routineId).eq("habit_id", habitId)));
  if (results.some((r) => r.error)) return { ok: false, message: "Die Reihenfolge konnte nicht gespeichert werden." };
  revalidateHabits();
  return { ok: true };
}

/** Routine löschen. Ihre Punkte bleiben als Habits erhalten (samt Häkchen), nur das Häkchen je Routine fällt weg. */
export async function deleteRoutineAction(routineId: string): Promise<Result> {
  const user = await requireUser();
  if (!idSchema.safeParse(routineId).success) return { ok: false, message: "Ungültige Routine." };
  const supabase = await createClient();
  const items = await supabase.from("habit_routine_items").select("habit_id").eq("routine_id", routineId);
  if (items.error) return { ok: false, message: "Die Routine konnte nicht gelöscht werden." };
  const { error } = await supabase.from("habit_routines").delete().eq("id", routineId).eq("user_id", user.id);
  if (error) return { ok: false, message: "Die Routine konnte nicht gelöscht werden." };
  await adjustTargets(supabase, new Map(items.data.map((i) => [i.habit_id, -1])));
  revalidateHabits();
  return { ok: true };
}

/** Nächste freie Position je Wochentag (neue Einheiten kommen ans Ende des Tages). */
async function nextSchedulePositions(supabase: Supabase, userId: string, weekdays: number[]): Promise<Map<number, number>> {
  const { data } = await supabase.from("training_schedule").select("weekday, position").eq("user_id", userId).in("weekday", weekdays);
  return new Map(weekdays.map((w) => [w, Math.max(-1, ...(data ?? []).filter((e) => e.weekday === w).map((e) => e.position)) + 1]));
}

/** Einheit im Wochenplan anlegen (an mehreren Tagen auf einmal, je ans Ende des Tages) oder ändern (genau ein Tag). */
export async function saveScheduleAction(entryId: string | null, input: ScheduleInput): Promise<SaveResult> {
  const user = await requireUser();
  if (entryId && !idSchema.safeParse(entryId).success) return { ok: false, message: "Ungültiger Eintrag." };
  const parsed = scheduleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: flattenIssues(parsed.error) };
  const d = parsed.data;
  if (entryId && d.weekdays.length !== 1) return { ok: false, fieldErrors: { weekdays: ["Genau einen Tag wählen."] } };
  const row = { daytime: d.daytime, at_time: d.atTime, title: d.title, category: d.category, duration_min: d.durationMin, notes: d.notes };
  const weekdays = [...new Set(d.weekdays)];

  const supabase = await createClient();
  let result;
  if (entryId) {
    const current = await supabase.from("training_schedule").select("weekday").eq("id", entryId).eq("user_id", user.id).maybeSingle();
    if (current.error || !current.data) return { ok: false, message: "Den Eintrag gibt es nicht mehr." };
    // Anderer Tag: ans Ende dieses Tages
    const moved = current.data.weekday !== weekdays[0] ? { position: (await nextSchedulePositions(supabase, user.id, weekdays)).get(weekdays[0]) ?? 0 } : {};
    result = await supabase
      .from("training_schedule")
      .update({ ...row, ...moved, weekday: weekdays[0] })
      .eq("id", entryId)
      .eq("user_id", user.id)
      .select("id");
  } else {
    const positions = await nextSchedulePositions(supabase, user.id, weekdays);
    result = await supabase
      .from("training_schedule")
      .insert(weekdays.map((weekday) => ({ ...row, weekday, position: positions.get(weekday) ?? 0 })))
      .select("id");
  }
  if (result.error) return { ok: false, message: "Der Eintrag konnte nicht gespeichert werden." };
  if (!result.data.length) return { ok: false, message: "Den Eintrag gibt es nicht mehr." };
  revalidateHabits();
  return { ok: true, id: result.data[0].id };
}

/** Reihenfolge der Einheiten eines Tages (Drag & Drop): Position = Index in `ids`. */
export async function reorderScheduleAction(ids: string[]): Promise<Result> {
  const user = await requireUser();
  const parsed = z.array(idSchema).max(50).safeParse(ids);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) return { ok: false, message: "Ungültige Reihenfolge." };
  const supabase = await createClient();
  const results = await Promise.all(parsed.data.map((id, position) => supabase.from("training_schedule").update({ position }).eq("id", id).eq("user_id", user.id)));
  if (results.some((r) => r.error)) return { ok: false, message: "Die Reihenfolge konnte nicht gespeichert werden." };
  revalidateHabits();
  return { ok: true };
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
