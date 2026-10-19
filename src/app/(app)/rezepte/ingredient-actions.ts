"use server";

import { z } from "zod";
import { INGREDIENT_OPTION_COLUMNS, toIngredientOption, type IngredientOption } from "@/lib/domain/ingredient-option";
import { mapOffHit, type IngredientCandidate, type OffHit } from "@/lib/domain/openfoodfacts";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { flattenIssues, ingredientInputSchema, type IngredientInput } from "@/lib/validation/recipe";

const querySchema = z.string().trim().min(1).max(100);

/** Suche in der eigenen Zutatentabelle (schnell, ohne externe Anfrage). */
export async function searchIngredientsAction(query: string): Promise<IngredientOption[]> {
  await requireUser();
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_ingredients", { p_query: parsed.data, p_limit: 12 });
  if (error) return [];
  return data.map(toIngredientOption);
}

const OFF_SEARCH_URL = "https://search.openfoodfacts.org/search";
const OFF_FIELDS =
  "code,product_name,product_name_de,generic_name_de,brands,nutriments,categories_tags,ingredients_analysis_tags";
// Keine Nutzerdaten: nur App-Name, kein Kontakt, keine IDs (SPEC „Keine Datenweitergabe an Dritte“)
const OFF_USER_AGENT = "Rezeptbuch/0.1 (private Familien-App)";

async function fetchOff(q: string): Promise<OffHit[]> {
  const url = new URL(OFF_SEARCH_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("langs", "de");
  url.searchParams.set("page_size", "20");
  url.searchParams.set("fields", OFF_FIELDS);
  const res = await fetch(url, {
    headers: { "User-Agent": OFF_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Open Food Facts antwortet mit ${res.status}`);
  const body = (await res.json()) as { hits?: OffHit[] };
  return Array.isArray(body.hits) ? body.hits : [];
}

export type OffSearchResult = { ok: true; candidates: IngredientCandidate[] } | { ok: false; message: string };

/**
 * Suche bei Open Food Facts, nur serverseitig und nur mit dem Suchbegriff.
 * Deutsche Produkte zuerst, bei zu wenig Treffern weltweit.
 */
export async function searchOpenFoodFactsAction(query: string): Promise<OffSearchResult> {
  await requireUser();
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) return { ok: false, message: "Bitte einen Suchbegriff eingeben." };
  // Suchsyntax-Zeichen entfernen, damit niemand die Abfrage verbiegt
  const term = parsed.data.replace(/[:"()[\]{}^~*?\\/]/g, " ").trim();
  if (!term) return { ok: false, message: "Bitte einen Suchbegriff eingeben." };

  try {
    let hits = await fetchOff(`${term} countries_tags:"en:germany"`);
    if (hits.length < 5) hits = [...hits, ...(await fetchOff(term))];

    const seen = new Set<string>();
    const candidates: IngredientCandidate[] = [];
    for (const hit of hits) {
      const c = mapOffHit(hit);
      if (c && !seen.has(c.externalId)) {
        seen.add(c.externalId);
        candidates.push(c);
      }
    }
    return { ok: true, candidates: candidates.slice(0, 15) };
  } catch {
    return {
      ok: false,
      message: "Open Food Facts ist gerade nicht erreichbar. Versuch es gleich noch einmal oder leg die Zutat selbst an.",
    };
  }
}

export type CreateIngredientResult =
  | { ok: true; ingredient: IngredientOption }
  | { ok: false; message?: string; fieldErrors?: Record<string, string[]> };

/** Neue Zutat speichern: manuell (source user) oder übernommen aus Open Food Facts (mit Barcode). */
export async function createIngredientAction(input: IngredientInput): Promise<CreateIngredientResult> {
  const user = await requireUser();
  const parsed = ingredientInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: flattenIssues(parsed.error) };

  const supabase = await createClient();
  const { external_id, ...values } = parsed.data;
  const row = {
    ...values,
    // Ohne Angabe leitet die Datenbank vegan/vegetarisch aus der Zutatengruppe ab
    diet: values.diet as NonNullable<typeof values.diet>,
    source: external_id ? ("openfoodfacts" as const) : ("user" as const),
    external_id,
    created_by: user.id,
  };

  if (external_id) {
    // Gibt es den Barcode schon (z. B. von jemand anderem übernommen), die vorhandene Zutat nehmen
    const { data: existing } = await supabase
      .from("ingredients")
      .select(INGREDIENT_OPTION_COLUMNS)
      .eq("source", "openfoodfacts")
      .eq("external_id", external_id)
      .maybeSingle();
    if (existing) return { ok: true, ingredient: toIngredientOption(existing) };
  }

  const { data, error } = await supabase.from("ingredients").insert(row).select(INGREDIENT_OPTION_COLUMNS).single();
  if (error || !data) {
    return { ok: false, message: "Die Zutat konnte nicht gespeichert werden. Bitte versuche es noch einmal." };
  }
  return { ok: true, ingredient: toIngredientOption(data) };
}
