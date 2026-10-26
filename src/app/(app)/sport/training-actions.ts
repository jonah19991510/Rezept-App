"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, requireUser } from "@/lib/auth";
import {
  berlinToIso,
  differsFromPlan,
  emptySet,
  nextPlanDay,
  planDayFromWorkout,
  toSyncPayload,
  uuid,
  type LastSet,
  type Session,
} from "@/lib/domain/workout";
import { getTrainingPlan } from "@/lib/server/sport";
import { getActiveWorkout, getLastPlanDayId, getLastSets, getWorkoutSession } from "@/lib/server/workouts";
import { createClient } from "@/lib/supabase/server";
import { workoutPayloadSchema } from "@/lib/validation/workout";

// Sport & Gesundheit, Phase S2: Training starten, Stand speichern, abschließen, verwerfen, in den Plan übernehmen.

const idSchema = z.uuid();

function revalidateSport(workoutId?: string) {
  revalidatePath("/sport/plaene", "layout");
  revalidatePath("/sport/verlauf", "layout");
  if (workoutId) revalidatePath(`/training/${workoutId}`);
  revalidatePath("/");
}

/** Neues Training mit den Übungen eines Plan-Tages (ohne Tag: der nächste der Reihe) oder frei ohne Übungen. */
async function buildSession(userId: string, planId: string | null, dayId: string | null): Promise<{ ok: true; session: Session } | { ok: false; message: string }> {
  const session: Session = {
    id: uuid(),
    planId: null,
    planDayId: null,
    title: "Freies Training",
    startedAt: new Date().toISOString(),
    endedAt: null,
    note: "",
    version: 1,
    exercises: [],
  };

  if (planId) {
    const plan = await getTrainingPlan(planId, userId);
    if (!plan) return { ok: false, message: "Den Plan gibt es nicht mehr." };
    const day = dayId
      ? plan.days.find((d) => d.id === dayId)
      : nextPlanDay(plan.days, await getLastPlanDayId(userId, plan.id));
    if (!day) return { ok: false, message: "Den Trainingstag gibt es nicht mehr." };
    session.planId = plan.id;
    session.planDayId = day.id;
    session.title = `${plan.title} · ${day.name}`;
    session.exercises = day.exercises.map((e) => ({
      id: uuid(),
      exercise: e.exercise,
      repsMin: e.repsMin,
      repsMax: e.repsMax,
      targetSeconds: e.targetSeconds,
      restSeconds: e.restSeconds,
      warmup: e.warmup,
      note: e.note ?? "",
      sets: Array.from({ length: e.sets }, () => emptySet()),
    }));
  }

  return { ok: true, session };
}

export type StartWorkoutResult = { ok: true; id: string } | { ok: false; message: string; activeId?: string };

/**
 * Training starten: mit Plan (Tag nach Wahl, sonst der nächste in der Reihe) oder frei ohne Übungen. Läuft schon eins,
 * kommt dessen ID zurück (Fortsetzen oder Verwerfen entscheidet der Nutzer).
 */
export async function startWorkoutAction(input: { planId: string | null; dayId: string | null }): Promise<StartWorkoutResult> {
  const user = await requireUser();
  if ((input.planId && !idSchema.safeParse(input.planId).success) || (input.dayId && !idSchema.safeParse(input.dayId).success)) {
    return { ok: false, message: "Ungültiger Plan." };
  }
  const active = await getActiveWorkout(user.id);
  if (active) return { ok: false, message: "Es läuft schon ein Training.", activeId: active.id };

  const built = await buildSession(user.id, input.planId, input.dayId);
  if (!built.ok) return built;
  const session = built.session;

  const supabase = await createClient();
  const { error } = await supabase.rpc("sync_workout", { p_workout: toSyncPayload(session) });
  if (error) {
    if (error.code === "23505") {
      const again = await getActiveWorkout(user.id);
      return { ok: false, message: "Es läuft schon ein Training.", activeId: again?.id };
    }
    return { ok: false, message: "Das Training konnte nicht gestartet werden. Bitte versuch es noch einmal." };
  }
  revalidateSport();
  return { ok: true, id: session.id };
}

export type SyncWorkoutResult = { ok: true; version: number } | { ok: false; message: string };

/**
 * Stand vom Handy speichern (das ganze Training; ältere Stände ignoriert die Datenbank). Ohne Anmeldung (z. B. Sitzung
 * abgelaufen) kein Umleiten zum Login mitten im Training: Der Stand bleibt auf dem Handy, bis man wieder angemeldet ist.
 */
export async function syncWorkoutAction(payload: unknown): Promise<SyncWorkoutResult> {
  if (!(await getCurrentUser())) return { ok: false, message: "Nicht angemeldet." };
  const parsed = workoutPayloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "Ungültige Trainingsdaten." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sync_workout", { p_workout: parsed.data });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Es läuft schon ein anderes Training." };
    return { ok: false, message: "Speichern fehlgeschlagen." };
  }
  if (parsed.data.ended_at) revalidateSport(parsed.data.id);
  return { ok: true, version: data };
}

/** Training verwerfen bzw. aus dem Verlauf löschen. */
export async function deleteWorkoutAction(workoutId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!idSchema.safeParse(workoutId).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("workouts").delete().eq("id", workoutId).eq("user_id", user.id);
  revalidateSport(workoutId);
  return { ok: !error };
}

/** Werte vom letzten Mal für Übungen, die im Training dazukommen. */
export async function lastSetsAction(exerciseIds: string[], workoutId: string): Promise<Record<string, LastSet[]>> {
  if (!(await getCurrentUser())) return {};
  const ids = exerciseIds.filter((id) => idSchema.safeParse(id).success).slice(0, 60);
  if (!idSchema.safeParse(workoutId).success) return {};
  return getLastSets(ids, workoutId);
}

/**
 * Nach dem Training: Übungen, Reihenfolge und Satzzahl in den Plan-Tag übernehmen (Vorgaben wie Wiederholungen und
 * Pause bleiben aus dem Plan). Nur für eigene Pläne.
 */
export async function applyWorkoutToPlanAction(workoutId: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  if (!idSchema.safeParse(workoutId).success) return { ok: false, message: "Ungültiges Training." };
  const session = await getWorkoutSession(workoutId, user.id);
  if (!session?.planId || !session.planDayId) return { ok: false, message: "Das Training gehört zu keinem Plan." };
  const plan = await getTrainingPlan(session.planId, user.id);
  const dayIndex = plan?.days.findIndex((d) => d.id === session.planDayId) ?? -1;
  if (!plan || !plan.isOwn || dayIndex < 0) return { ok: false, message: "Den Plan oder Tag gibt es nicht mehr." };

  const toPlan = (e: (typeof plan.days)[number]["exercises"][number]) => ({
    exerciseId: e.exercise.id,
    sets: e.sets,
    repsMin: e.repsMin,
    repsMax: e.repsMax,
    targetSeconds: e.targetSeconds,
    restSeconds: e.restSeconds,
    warmup: e.warmup,
    note: e.note,
  });
  const current = plan.days[dayIndex].exercises.map(toPlan);
  const next = planDayFromWorkout(
    current,
    session.exercises.map((e) => ({
      exerciseId: e.exercise.id,
      normalSets: e.sets.filter((s) => s.kind === "normal").length,
      repsMin: e.repsMin,
      repsMax: e.repsMax,
      targetSeconds: e.targetSeconds,
      restSeconds: e.restSeconds,
      warmup: e.warmup,
      note: e.note || null,
    })),
  );
  if (!differsFromPlan(current, next)) return { ok: true, message: "Der Plan ist schon auf diesem Stand." };

  const days = plan.days.map((d, i) => ({
    id: d.id,
    name: d.name,
    focus: d.focus ?? "",
    exercises: (i === dayIndex ? next : d.exercises.map(toPlan)).map((e) => ({
      exercise_id: e.exerciseId,
      sets: e.sets,
      reps_min: e.repsMin,
      reps_max: e.repsMax,
      target_seconds: e.targetSeconds,
      rest_seconds: e.restSeconds,
      warmup: e.warmup,
      note: e.note ?? "",
    })),
  }));
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_training_plan", {
    p_plan: { id: plan.id, title: plan.title, description: plan.description ?? "" },
    p_days: days,
  });
  if (error) return { ok: false, message: "Der Plan konnte nicht geändert werden." };
  revalidatePath(`/sport/plaene/${plan.id}`);
  revalidateSport(workoutId);
  return { ok: true, message: `„${plan.days[dayIndex].name}“ in „${plan.title}“ ist aktualisiert.` };
}

const pastWorkoutSchema = z.object({
  planId: z.uuid().nullable(),
  dayId: z.uuid().nullable(),
  date: z.iso.date(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMin: z.number().int().min(1, "Mindestens 1 Minute.").max(600, "Höchstens 10 Stunden."),
});

/**
 * Training nachtragen: legt ein beendetes Training mit Datum, Uhrzeit und Dauer an (mit den Übungen eines Plan-Tages
 * oder frei); die Sätze trägt man danach in der Bearbeiten-Ansicht ein.
 */
export async function createPastWorkoutAction(input: z.input<typeof pastWorkoutSchema>): Promise<StartWorkoutResult> {
  const user = await requireUser();
  const parsed = pastWorkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Bitte prüfe Datum, Uhrzeit und Dauer." };
  const { planId, dayId, date, time, durationMin } = parsed.data;
  const startedAt = berlinToIso(date, time);
  if (!startedAt) return { ok: false, message: "Bitte prüfe Datum und Uhrzeit." };
  if (new Date(startedAt).getTime() > Date.now()) return { ok: false, message: "Nachtragen geht nur für vergangene Trainings." };

  const built = await buildSession(user.id, planId, planId ? dayId : null);
  if (!built.ok) return built;
  const session: Session = {
    ...built.session,
    startedAt,
    endedAt: new Date(new Date(startedAt).getTime() + durationMin * 60_000).toISOString(),
  };
  const supabase = await createClient();
  const { error } = await supabase.rpc("sync_workout", { p_workout: toSyncPayload(session) });
  if (error) return { ok: false, message: "Das Training konnte nicht angelegt werden." };
  revalidateSport(session.id);
  return { ok: true, id: session.id };
}
