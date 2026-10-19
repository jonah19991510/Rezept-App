import "server-only";
import { cache } from "react";
import { thresholdsFromConfig, type NutritionThresholds } from "@/lib/domain/nutrition";
import { createClient } from "@/lib/supabase/server";

/** Schwellenwerte für die Auto-Tags, dieselben wie in der View recipe_nutrition. */
export const getNutritionThresholds = cache(async (): Promise<NutritionThresholds> => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_config").select("key, value");
  return thresholdsFromConfig(data ?? []);
});
