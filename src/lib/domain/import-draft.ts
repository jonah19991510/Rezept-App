import type { Enums } from "@/lib/supabase/database.types";
import type { IngredientOption } from "./ingredient-option";
import { refineUsLine, type ParsedIngredientLine } from "./ingredient-line";
import type { Unit } from "./units";

/** Eine importierte Zutatenzeile mit dem Vorschlag aus der eigenen Zutatentabelle. */
export type ImportLine = ParsedIngredientLine & {
  match: IngredientOption | null;
  /** Name stimmt genau überein (sonst ist es nur ein Vorschlag, der geprüft werden sollte) */
  exact: boolean;
};

/** Ergebnis des Imports, das die Bestätigungsansicht anzeigt. */
export type ImportDraft = {
  sourceUrl: string;
  title: string;
  description: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  category: Enums<"recipe_category"> | null;
  lines: ImportLine[];
  steps: string[];
};

/** Entscheidung des Nutzers je Zeile: gewählte Zutat oder weglassen. */
export type LineChoice = { ingredient: IngredientOption | null; skip: boolean };

export type DraftEditorInitial = {
  title: string;
  description: string;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  category: Enums<"recipe_category"> | null;
  tags: string[];
  is_meal_prep: boolean;
  source_url: string;
  ingredients: {
    ingredient: IngredientOption;
    amount: number | null;
    unit: Unit | null;
    grams: number | null;
    note: string;
    step_position: number | null;
  }[];
  steps: { text: string; timer_seconds: number | null }[];
};

/** Anfangsentscheidung: der Vorschlag, falls es einen gibt. */
export function initialChoices(draft: ImportDraft): LineChoice[] {
  return draft.lines.map((l) => ({ ingredient: l.match, skip: false }));
}

/**
 * Baut aus Import und Entscheidungen die Startwerte für den Rezept-Editor.
 * Zeilen ohne Zutat oder mit „weglassen“ fallen weg und werden zurückgegeben, damit die Ansicht sie nennen kann.
 */
export function draftToEditorInitial(
  draft: ImportDraft,
  choices: LineChoice[],
): { initial: DraftEditorInitial; dropped: string[] } {
  const ingredients: DraftEditorInitial["ingredients"] = [];
  const dropped: string[] = [];
  draft.lines.forEach((line, i) => {
    const choice = choices[i];
    if (!choice || choice.skip || !choice.ingredient) {
      dropped.push(line.raw);
      return;
    }
    // US-Volumen (cups) über die Dichte der gewählten Zutat umrechnen: 1 cup Mehl → 127 g
    const refined = refineUsLine(line, choice.ingredient.density_g_per_ml);
    ingredients.push({
      ingredient: choice.ingredient,
      amount: refined.amount,
      unit: refined.amount == null ? null : refined.unit,
      grams: null,
      note: line.note,
      step_position: null,
    });
  });
  return {
    dropped,
    initial: {
      title: draft.title,
      description: draft.description,
      servings: draft.servings ?? 2,
      prep_minutes: draft.prepMinutes,
      cook_minutes: draft.cookMinutes,
      category: draft.category,
      tags: [],
      is_meal_prep: false,
      source_url: draft.sourceUrl,
      ingredients,
      steps: draft.steps.map((text) => ({ text, timer_seconds: null })),
    },
  };
}
