"use server";

import { requireUser } from "@/lib/auth";
import type { ImportDraft, ImportLine } from "@/lib/domain/import-draft";
import { toIngredientOption, type IngredientOption } from "@/lib/domain/ingredient-option";
import { parseIngredientLine, searchTermsFor } from "@/lib/domain/ingredient-line";
import { extractRecipe } from "@/lib/domain/recipe-import";
import { FetchPageError, fetchPublicPage } from "@/lib/server/fetch-page";
import { createClient } from "@/lib/supabase/server";
import { importUrlSchema } from "@/lib/validation/import";

export type ImportResult = { ok: true; draft: ImportDraft } | { ok: false; message: string };

const normalize = (s: string) => s.toLocaleLowerCase("de-DE").normalize("NFKD").replace(/\p{Diacritic}/gu, "").trim();

/**
 * Import per Link: Seite serverseitig laden, schema.org/Recipe lesen, Zutatenzeilen zerlegen und
 * Vorschläge aus der eigenen Zutatentabelle suchen. Gespeichert wird hier noch nichts.
 */
export async function importFromUrlAction(input: { url: string }): Promise<ImportResult> {
  await requireUser();
  const parsed = importUrlSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ungültige Adresse." };

  let page: { html: string; url: string };
  try {
    page = await fetchPublicPage(parsed.data.url);
  } catch (e) {
    return { ok: false, message: e instanceof FetchPageError ? e.message : "Die Webseite konnte nicht geladen werden." };
  }

  const recipe = extractRecipe(page.html, page.url);
  if (!recipe) {
    return {
      ok: false,
      message: "Auf dieser Seite wurde kein Rezept im Standardformat gefunden. Du kannst es von Hand anlegen.",
    };
  }

  const supabase = await createClient();
  const cache = new Map<string, IngredientOption | null>();
  async function search(term: string): Promise<IngredientOption | null> {
    const key = normalize(term);
    if (!cache.has(key)) {
      const { data } = await supabase.rpc("search_ingredients", { p_query: term, p_limit: 1 });
      cache.set(key, data?.[0] ? toIngredientOption(data[0]) : null);
    }
    return cache.get(key) ?? null;
  }

  const lines: ImportLine[] = await Promise.all(
    recipe.ingredientLines.map(async (raw) => {
      const line = parseIngredientLine(raw);
      for (const term of searchTermsFor(line.name)) {
        const match = await search(term);
        if (match) return { ...line, match, exact: normalize(match.name) === normalize(line.name) };
      }
      return { ...line, match: null, exact: false };
    }),
  );

  return {
    ok: true,
    draft: {
      sourceUrl: page.url,
      title: recipe.title || "Importiertes Rezept",
      description: recipe.description,
      servings: recipe.servings,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      category: recipe.category,
      lines,
      steps: recipe.steps,
    },
  };
}
