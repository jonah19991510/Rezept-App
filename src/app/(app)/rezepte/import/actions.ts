"use server";

import { requireUser } from "@/lib/auth";
import type { ImportDraft, ImportLine } from "@/lib/domain/import-draft";
import { extractRecipe } from "@/lib/domain/recipe-import";
import { FetchPageError, fetchPublicPage } from "@/lib/server/fetch-page";
import { createIngredientMatcher } from "@/lib/server/ingredient-match";
import { importUrlSchema, markdownMatchSchema, type MarkdownMatchInput } from "@/lib/validation/import";

export type ImportResult = { ok: true; draft: ImportDraft } | { ok: false; message: string };

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

  const matchLine = await createIngredientMatcher();
  const lines: ImportLine[] = await Promise.all(recipe.ingredientLines.map(matchLine));

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

export type MarkdownMatchResult = { ok: true; lines: ImportLine[][] } | { ok: false; message: string };

/**
 * Markdown-Import (Phase 13): Die Datei liest der Browser selbst; hierher kommen nur die Zutatenzeilen
 * der ausgewählten Rezepte (in Paketen), damit der Server Vorschläge aus der Zutatentabelle sucht.
 * Zusätze aus der Datei (Gruppe wie „Teig“, „optional“) kommen vor die erkannte Notiz.
 */
export async function matchMarkdownIngredientsAction(input: MarkdownMatchInput): Promise<MarkdownMatchResult> {
  await requireUser();
  const parsed = markdownMatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Die Rezepte konnten nicht gelesen werden." };

  const matchLine = await createIngredientMatcher();
  const lines = await Promise.all(
    parsed.data.recipes.map((recipe) =>
      Promise.all(
        recipe.ingredients.map(async ({ text, extraNote }) => {
          const line = await matchLine(text);
          const note = [extraNote, line.note].filter(Boolean).join(", ").slice(0, 200);
          return { ...line, note };
        }),
      ),
    ),
  );
  return { ok: true, lines };
}
