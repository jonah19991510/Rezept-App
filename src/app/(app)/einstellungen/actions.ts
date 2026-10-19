"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { goalsSchema, type GoalsInput } from "@/lib/validation/plan";
import { flattenIssues } from "@/lib/validation/recipe";

export type GoalsResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

/** Tagesziele speichern (leere Felder = kein Ziel für diesen Wert). */
export async function saveGoalsAction(input: GoalsInput): Promise<GoalsResult> {
  const user = await requireUser();
  const parsed = goalsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Bitte prüfe die Eingaben.", fieldErrors: flattenIssues(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("user_goals").upsert(
    {
      user_id: user.id,
      goal_type: "default",
      kcal: parsed.data.kcal == null ? null : Math.round(parsed.data.kcal),
      protein: parsed.data.protein,
      carbs: parsed.data.carbs,
      fat: parsed.data.fat,
    },
    { onConflict: "user_id,goal_type" },
  );
  if (error) return { ok: false, message: "Die Ziele konnten nicht gespeichert werden." };

  revalidatePath("/einstellungen");
  revalidatePath("/wochenplan");
  return { ok: true };
}
