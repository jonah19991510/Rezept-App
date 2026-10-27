"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { EnergyProfile } from "@/lib/domain/energy";
import { createClient } from "@/lib/supabase/server";
import { energyProfileSchema } from "@/lib/validation/energy";

// Energiebedarfsrechner: Eingaben im Konto merken (gleich auf PC und Handy).

export async function saveEnergyProfileAction(profile: EnergyProfile): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsed = energyProfileSchema.safeParse(profile);
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").update({ energy_profile: parsed.data }).eq("user_id", user.id);
  if (!error) revalidatePath("/sport/energie");
  return { ok: !error };
}
