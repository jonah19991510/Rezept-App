import "server-only";
import { authorName } from "@/lib/domain/community";
import { parsePostSummary, type PostSummary } from "@/lib/domain/posts";
import { todayInBerlin } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";

// Geteilte Trainings (Feed) lesen. Posts, Kudos und Kommentare sind für alle Eingeloggten sichtbar.

export type FeedComment = { id: string; userId: string; name: string; body: string; createdAt: string; isMine: boolean };

export type FeedPost = {
  id: string;
  userId: string;
  authorName: string;
  isMine: boolean;
  workoutId: string;
  body: string | null;
  summary: PostSummary;
  trainedAt: string;
  /** Kalendertag des Trainings in deutscher Zeit */
  trainedOn: string;
  kudos: { userId: string; name: string }[];
  kudoedByMe: boolean;
  comments: FeedComment[];
};

const POST_COLUMNS =
  "id, user_id, workout_id, body, summary, trained_at, profiles!workout_posts_user_id_fkey(display_name), post_kudos(user_id, created_at, profiles!post_kudos_user_id_fkey(display_name)), post_comments(id, user_id, body, created_at, profiles!post_comments_user_id_fkey(display_name))";

/** Die neuesten geteilten Trainings (nach Trainingszeit), mit Kudos und Kommentaren. */
export async function getFeed(userId: string, limit = 50): Promise<FeedPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_posts").select(POST_COLUMNS).order("trained_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Feed konnte nicht geladen werden (${error.code})`);
  return data.map((p) => {
    const kudos = [...p.post_kudos]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((k) => ({ userId: k.user_id, name: authorName(k.profiles?.display_name) }));
    return {
      id: p.id,
      userId: p.user_id,
      authorName: authorName(p.profiles?.display_name),
      isMine: p.user_id === userId,
      workoutId: p.workout_id,
      body: p.body,
      summary: parsePostSummary(p.summary),
      trainedAt: p.trained_at,
      trainedOn: todayInBerlin(new Date(p.trained_at)),
      kudos,
      kudoedByMe: kudos.some((k) => k.userId === userId),
      comments: [...p.post_comments]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((c) => ({ id: c.id, userId: c.user_id, name: authorName(c.profiles?.display_name), body: c.body, createdAt: c.created_at, isMine: c.user_id === userId })),
    };
  });
}

/** Geteilter Post zu einem eigenen Training (für „Teilen“ im Verlauf). */
export async function getPostForWorkout(workoutId: string): Promise<{ id: string; body: string | null; kudos: number; comments: number } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("workout_posts").select("id, body, post_kudos(count), post_comments(count)").eq("workout_id", workoutId).maybeSingle();
  if (!data) return null;
  return { id: data.id, body: data.body, kudos: data.post_kudos[0]?.count ?? 0, comments: data.post_comments[0]?.count ?? 0 };
}
