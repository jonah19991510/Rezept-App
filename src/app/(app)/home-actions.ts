"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { HOME_WIDGETS, isHomeWidgetId, normalizeHomeLayout, type HomeWidget } from "@/lib/domain/home";
import { createClient } from "@/lib/supabase/server";

const layoutSchema = z
  .array(z.object({ id: z.string().refine(isHomeWidgetId), visible: z.boolean() }))
  .max(HOME_WIDGETS.length);

/** Startseite: Reihenfolge und Sichtbarkeit der Widgets speichern. */
export async function saveHomeLayoutAction(layout: HomeWidget[]): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsed = layoutSchema.safeParse(layout);
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, home_widgets: normalizeHomeLayout(parsed.data) }, { onConflict: "user_id" });
  revalidatePath("/");
  return { ok: !error };
}
