import "server-only";
import type { ExerciseOption } from "@/lib/domain/exercises";
import { todayInBerlin } from "@/lib/domain/week";
import { setInputs, type LastSet, type Session } from "@/lib/domain/workout";
import type { StatsWorkout } from "@/lib/domain/workout-stats";
import { createClient } from "@/lib/supabase/server";

// Sport & Gesundheit, Phase S2: Trainings lesen.

const EXERCISE_COLUMNS = "id, name, muscle_group, secondary_muscles, equipment, tracking, created_by";

export type ActiveWorkout = { id: string; title: string; startedAt: string };

/** Das laufende Training (höchstens eins), sonst null. */
export async function getActiveWorkout(userId: string): Promise<ActiveWorkout | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("workouts").select("id, title, started_at").eq("user_id", userId).is("ended_at", null).maybeSingle();
  return data ? { id: data.id, title: data.title, startedAt: data.started_at } : null;
}

/** Ein Training als Stand für die Live-Ansicht (Eingaben als Text); null, wenn es nicht (mehr) da ist. */
export async function getWorkoutSession(workoutId: string, userId: string): Promise<Session | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .select(
      `id, plan_id, plan_day_id, title, started_at, ended_at, note, version, workout_exercises!workout_exercises_workout_id_fkey(id, position, reps_min, reps_max, target_seconds, rest_seconds, warmup, note, exercises!workout_exercises_exercise_id_fkey(${EXERCISE_COLUMNS}), workout_sets!workout_sets_workout_exercise_id_fkey(id, position, kind, weight_kg, reps, seconds, distance_m, speed_kmh, done, done_at))`,
    )
    .eq("id", workoutId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Training konnte nicht geladen werden (${error.code})`);
  if (!data) return null;
  return {
    id: data.id,
    planId: data.plan_id,
    planDayId: data.plan_day_id,
    title: data.title,
    startedAt: data.started_at,
    endedAt: data.ended_at,
    note: data.note ?? "",
    version: data.version,
    exercises: [...data.workout_exercises]
      .sort((a, b) => a.position - b.position)
      .map((e) => {
        const x = e.exercises;
        const exercise: ExerciseOption = {
          id: x.id,
          name: x.name,
          muscleGroup: x.muscle_group,
          secondaryMuscles: x.secondary_muscles,
          equipment: x.equipment,
          tracking: x.tracking,
          own: x.created_by === userId,
        };
        return {
          id: e.id,
          exercise,
          repsMin: e.reps_min,
          repsMax: e.reps_max,
          targetSeconds: e.target_seconds,
          restSeconds: e.rest_seconds,
          warmup: e.warmup,
          note: e.note ?? "",
          sets: [...e.workout_sets]
            .sort((a, b) => a.position - b.position)
            .map((s) => ({
              id: s.id,
              kind: s.kind,
              ...setInputs({ weightKg: s.weight_kg, reps: s.reps, seconds: s.seconds, distanceM: s.distance_m, speedKmh: s.speed_kmh }),
              done: s.done,
              doneAt: s.done_at,
            })),
        };
      }),
  };
}

/** Erledigte Arbeitssätze vom letzten beendeten Training je Übung (ohne das aktuelle). */
export async function getLastSets(exerciseIds: string[], excludeWorkoutId: string | null): Promise<Record<string, LastSet[]>> {
  if (exerciseIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("last_exercise_sets", {
    p_exercise_ids: exerciseIds,
    p_exclude: excludeWorkoutId ?? undefined,
  });
  if (error) return {};
  const result: Record<string, LastSet[]> = {};
  for (const row of data) {
    (result[row.exercise_id] ??= [])[row.set_index] = {
      weightKg: row.weight_kg,
      reps: row.reps,
      seconds: row.seconds,
      distanceM: row.distance_m,
      // fehlt, solange die Migration workout_set_speed nicht eingespielt ist
      speedKmh: row.speed_kmh ?? null,
    };
  }
  return result;
}

/** Plan und Tag des zuletzt beendeten Trainings mit einem Plan (hervorgehobener Plan auf der Pläne-Seite). */
export async function getLastPlanWorkout(userId: string): Promise<{ planId: string; dayId: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workouts")
    .select("plan_id, plan_day_id")
    .eq("user_id", userId)
    .not("plan_id", "is", null)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.plan_id ? { planId: data.plan_id, dayId: data.plan_day_id ?? null } : null;
}

/** Tag des zuletzt beendeten Trainings mit diesem Plan (für „als Nächstes“). */
export async function getLastPlanDayId(userId: string, planId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workouts")
    .select("plan_day_id")
    .eq("user_id", userId)
    .eq("plan_id", planId)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.plan_day_id ?? null;
}

export type WorkoutListItem = {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  exercises: number;
  sets: number;
  volumeKg: number;
};

/** Beendete und laufende Trainings, neueste zuerst; optional ab einem Datum. */
export async function getWorkoutHistory(userId: string, options: { from?: string; limit?: number } = {}): Promise<WorkoutListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("workouts")
    .select(
      "id, title, started_at, ended_at, workout_exercises!workout_exercises_workout_id_fkey(id, workout_sets!workout_sets_workout_exercise_id_fkey(kind, done, weight_kg, reps))",
    )
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(options.limit ?? 200);
  if (options.from) query = query.gte("started_at", options.from);
  const { data, error } = await query;
  if (error) throw new Error(`Trainings konnten nicht geladen werden (${error.code})`);
  return data.map((w) => {
    let sets = 0;
    let volumeKg = 0;
    let exercises = 0;
    for (const e of w.workout_exercises) {
      const done = e.workout_sets.filter((s) => s.done && s.kind === "normal");
      if (done.length) exercises++;
      sets += done.length;
      for (const s of done) if (s.weight_kg != null && s.reps != null) volumeKg += s.weight_kg * s.reps;
    }
    return { id: w.id, title: w.title, startedAt: w.started_at, endedAt: w.ended_at, exercises, sets, volumeKg };
  });
}

/** Alle beendeten Trainings mit erledigten Sätzen für die Statistik (Tag in deutscher Zeit). */
export async function getWorkoutStatsData(userId: string): Promise<StatsWorkout[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .select(
      "id, title, started_at, ended_at, workout_exercises!workout_exercises_workout_id_fkey(position, exercises!workout_exercises_exercise_id_fkey(id, name, muscle_group, secondary_muscles, tracking), workout_sets!workout_sets_workout_exercise_id_fkey(position, kind, done, weight_kg, reps, seconds, distance_m, speed_kmh))",
    )
    .eq("user_id", userId)
    .not("ended_at", "is", null)
    .order("started_at");
  if (error) throw new Error(`Trainings konnten nicht geladen werden (${error.code})`);
  return data.map((w) => ({
    id: w.id,
    title: w.title,
    date: todayInBerlin(new Date(w.started_at)),
    durationSeconds: Math.max(0, Math.round((new Date(w.ended_at!).getTime() - new Date(w.started_at).getTime()) / 1000)),
    exercises: [...w.workout_exercises]
      .sort((a, b) => a.position - b.position)
      .map((e) => ({
        exerciseId: e.exercises.id,
        name: e.exercises.name,
        muscleGroup: e.exercises.muscle_group,
        secondaryMuscles: e.exercises.secondary_muscles,
        tracking: e.exercises.tracking,
        sets: [...e.workout_sets]
          .filter((s) => s.done)
          .sort((a, b) => a.position - b.position)
          .map((s) => ({ kind: s.kind, weightKg: s.weight_kg, reps: s.reps, seconds: s.seconds, distanceM: s.distance_m, speedKmh: s.speed_kmh })),
      })),
  }));
}
