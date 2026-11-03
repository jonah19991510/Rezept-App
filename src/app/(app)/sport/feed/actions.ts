"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { buildPostSummary, parsePostSummary, planDayFromPost } from "@/lib/domain/posts";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getWorkoutStatsData } from "@/lib/server/workouts";

// Trainings teilen, anfeuern, kommentieren, nachmachen. Die Zusammenfassung baut der Server aus dem eigenen
// Training; wer was darf, entscheidet zusätzlich die RLS.

const idSchema = z.uuid();
const bodySchema = z.string().trim().max(1000, "Höchstens 1000 Zeichen.");
const commentSchema = z.string().trim().min(1, "Bitte etwas schreiben.").max(500, "Höchstens 500 Zeichen.");

type Result = { ok: true } | { ok: false; message: string };

function revalidateFeed(workoutId?: string) {
  revalidatePath("/sport/entdecken", "layout");
  if (workoutId) revalidatePath(`/sport/verlauf/${workoutId}`);
}

/**
 * Training teilen bzw. den Text eines geteilten Trainings ändern. Die Zusammenfassung (Übungen, bester Satz, Volumen,
 * Bestwerte) wird dabei aus dem aktuellen Stand des Trainings neu gebaut.
 */
export async function shareWorkoutAction(workoutId: string, body: string): Promise<Result> {
  const user = await requireUser();
  if (!idSchema.safeParse(workoutId).success) return { ok: false, message: "Ungültiges Training." };
  const text = bodySchema.safeParse(body);
  if (!text.success) return { ok: false, message: text.error.issues[0].message };

  const history = await getWorkoutStatsData(user.id);
  const workout = history.find((w) => w.id === workoutId);
  if (!workout) return { ok: false, message: "Nur beendete eigene Trainings lassen sich teilen." };
  const summary = buildPostSummary(workout, history) as unknown as Json;

  const supabase = await createClient();
  const { data: started } = await supabase.from("workouts").select("started_at").eq("id", workoutId).single();
  const existing = await supabase.from("workout_posts").select("id").eq("workout_id", workoutId).maybeSingle();
  const { error } = existing.data
    ? await supabase.from("workout_posts").update({ body: text.data || null, summary }).eq("id", existing.data.id)
    : await supabase.from("workout_posts").insert({ workout_id: workoutId, body: text.data || null, summary, trained_at: started?.started_at ?? new Date().toISOString() });
  if (error) return { ok: false, message: "Das Training konnte nicht geteilt werden." };
  revalidateFeed(workoutId);
  return { ok: true };
}

/** Post löschen (eigener; Admins jeden). Das Training selbst bleibt. */
export async function deletePostAction(postId: string): Promise<Result> {
  await requireUser();
  if (!idSchema.safeParse(postId).success) return { ok: false, message: "Ungültiger Post." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_posts").delete().eq("id", postId).select("workout_id");
  if (error || !data.length) return { ok: false, message: "Der Post konnte nicht gelöscht werden." };
  revalidateFeed(data[0].workout_id);
  return { ok: true };
}

/** Kudos geben bzw. zurücknehmen. */
export async function setKudosAction(postId: string, on: boolean): Promise<Result> {
  const user = await requireUser();
  if (!idSchema.safeParse(postId).success) return { ok: false, message: "Ungültiger Post." };
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("post_kudos").insert({ post_id: postId })
    : await supabase.from("post_kudos").delete().eq("post_id", postId).eq("user_id", user.id);
  if (error && error.code !== "23505") return { ok: false, message: error.code === "42501" ? "Eigene Trainings kannst du nicht anfeuern." : "Das hat nicht geklappt." };
  revalidateFeed();
  return { ok: true };
}

export async function addCommentAction(postId: string, body: string): Promise<Result> {
  await requireUser();
  if (!idSchema.safeParse(postId).success) return { ok: false, message: "Ungültiger Post." };
  const text = commentSchema.safeParse(body);
  if (!text.success) return { ok: false, message: text.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("post_comments").insert({ post_id: postId, body: text.data });
  if (error) return { ok: false, message: "Der Kommentar konnte nicht gespeichert werden." };
  revalidateFeed();
  return { ok: true };
}

/** Kommentar löschen: eigener, unter dem eigenen Post oder als Admin. */
export async function deleteCommentAction(commentId: string): Promise<Result> {
  await requireUser();
  if (!idSchema.safeParse(commentId).success) return { ok: false, message: "Ungültiger Kommentar." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("post_comments").delete().eq("id", commentId).select("id");
  if (error || !data.length) return { ok: false, message: "Der Kommentar konnte nicht gelöscht werden." };
  revalidateFeed();
  return { ok: true };
}

/** „Nachmachen“: legt einen eigenen Plan mit einem Trainingstag aus den Übungen des Posts an und öffnet ihn. */
export async function copyPostAsPlanAction(postId: string): Promise<{ ok: false; message: string }> {
  await requireUser();
  if (!idSchema.safeParse(postId).success) return { ok: false, message: "Ungültiger Post." };
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("workout_posts")
    .select("summary, profiles!workout_posts_user_id_fkey(display_name)")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return { ok: false, message: "Den Post gibt es nicht mehr." };
  const summary = parsePostSummary(post.summary);
  const exercises = planDayFromPost(summary);
  if (!exercises.length) return { ok: false, message: "In diesem Training gibt es keine Übungen zum Nachmachen." };
  const author = post.profiles?.display_name?.trim();
  const { data: planId, error } = await supabase.rpc("save_training_plan", {
    p_plan: { id: null, title: summary.title.slice(0, 100), description: author ? `Nachgemacht: Training von ${author}`.slice(0, 1000) : "" },
    p_days: [{ id: null, name: summary.title.slice(0, 60), focus: "", exercises }],
  });
  if (error || !planId) return { ok: false, message: "Der Plan konnte nicht angelegt werden." };
  revalidatePath("/sport/plaene");
  redirect(`/sport/plaene/${planId}?uebernommen=1`);
}
