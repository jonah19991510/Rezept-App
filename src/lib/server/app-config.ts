import "server-only";
import { cache } from "react";
import { dilutionFromConfig, type DilutionConfig } from "@/lib/domain/cocktail";
import { thresholdsFromConfig, type NutritionThresholds } from "@/lib/domain/nutrition";
import { createClient } from "@/lib/supabase/server";

const getConfigRows = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_config").select("key, value");
  return data ?? [];
});

/** Schwellenwerte für die Auto-Tags, dieselben wie in der View recipe_nutrition. */
export const getNutritionThresholds = cache(async (): Promise<NutritionThresholds> => thresholdsFromConfig(await getConfigRows()));

/** Phase 15: Verdünnung je Methode, dieselbe wie in der View recipe_alcohol. */
export const getDilutionConfig = cache(async (): Promise<DilutionConfig> => dilutionFromConfig(await getConfigRows()));
