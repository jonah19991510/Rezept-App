import type { RecipeInput } from "@/lib/validation/recipe";
import { draftToEditorInitial, initialChoices, type DraftEditorInitial, type ImportDraft, type ImportLine, type LineChoice } from "./import-draft";
import type { MarkdownImportRecipe } from "./markdown-import";
import { resolveLineGrams } from "./units";

// Markdown-Import (Phase 13): aus erkanntem Rezept + zugeordneten Zutaten wird derselbe Entwurf wie beim
// Link-Import. „Sicher“ erkannte Rezepte speichert die App direkt, alle anderen gehen durch die Bestätigungsansicht.

export function toImportDraft(recipe: MarkdownImportRecipe, lines: ImportLine[]): ImportDraft {
  return {
    sourceUrl: recipe.sourceUrl,
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    category: recipe.category,
    lines,
    steps: recipe.steps.map((s) => s.text),
  };
}

/** Warum ein Rezept geprüft werden muss (leer = sicher erkannt, kann direkt gespeichert werden). */
export function reviewReasons(recipe: MarkdownImportRecipe, lines: ImportLine[]): string[] {
  const reasons = [...recipe.warnings];
  const unsure = lines.filter(
    (l) =>
      !l.match ||
      !l.exact ||
      l.us != null ||
      // Menge muss sich in Gramm umrechnen lassen, sonst fehlen Nährwerte
      (l.amount != null && resolveLineGrams(l.amount, l.unit, l.match) == null),
  ).length;
  if (unsure > 0) reasons.push(unsure === 1 ? "1 Zutat unsicher" : `${unsure} Zutaten unsicher`);
  return reasons;
}

/** Startwerte für den Editor: wie beim Link-Import, dazu Tags, Meal-Prep und Timer aus der Datei. */
export function markdownEditorInitial(
  recipe: MarkdownImportRecipe,
  draft: ImportDraft,
  choices: LineChoice[],
): { initial: DraftEditorInitial; dropped: string[] } {
  const { initial, dropped } = draftToEditorInitial(draft, choices);
  return {
    dropped,
    initial: {
      ...initial,
      servings: recipe.servings ?? initial.servings,
      tags: recipe.tags,
      is_meal_prep: recipe.isMealPrep,
      steps: recipe.steps.map((s) => ({ text: s.text, timer_seconds: s.timer_seconds })),
    },
  };
}

/** Für das direkte Speichern sicherer Rezepte: Editor-Startwerte → Eingabe für saveRecipe. */
export function toRecipeInput(initial: DraftEditorInitial): RecipeInput {
  return {
    title: initial.title,
    description: initial.description,
    servings: initial.servings,
    prep_minutes: initial.prep_minutes,
    cook_minutes: initial.cook_minutes,
    category: initial.category,
    tags: initial.tags,
    is_meal_prep: initial.is_meal_prep,
    source_url: initial.source_url,
    ingredients: initial.ingredients.map((l) => ({
      ingredient_id: l.ingredient.id,
      amount: l.amount,
      unit: l.unit,
      manual_grams: null,
      note: l.note,
      step_position: l.step_position,
    })),
    steps: initial.steps,
    change_note: "",
  };
}

/** Sicheres Rezept direkt in eine Speicher-Eingabe verwandeln (alle Vorschläge übernehmen). */
export function certainRecipeInput(recipe: MarkdownImportRecipe, lines: ImportLine[]): RecipeInput {
  const draft = toImportDraft(recipe, lines);
  return toRecipeInput(markdownEditorInitial(recipe, draft, initialChoices(draft)).initial);
}
