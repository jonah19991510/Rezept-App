"use client";

import { useState, useTransition } from "react";
import { createIngredientAction } from "@/app/(app)/rezepte/ingredient-actions";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import type { IngredientOption } from "@/lib/domain/ingredient-option";
import { DIET_LABELS, FOOD_GROUP_LABELS } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";
import { flattenIssues, ingredientInputSchema, type IngredientInput } from "@/lib/validation/recipe";

export type IngredientFormInitial = {
  name?: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  food_group?: Enums<"food_group">;
  diet?: Enums<"ingredient_diet"> | null;
  externalId?: string | null;
  sourceLabel?: string;
};

const NUTRIENTS = [
  { key: "kcal", label: "kcal" },
  { key: "protein", label: "Protein (g)" },
  { key: "carbs", label: "Kohlenhydrate (g)" },
  { key: "fat", label: "Fett (g)" },
  { key: "fiber", label: "Ballaststoffe (g)" },
  { key: "sugar", label: "davon Zucker (g)" },
] as const;

type NutrientKey = (typeof NUTRIENTS)[number]["key"];

/** Neue Zutat anlegen: manuell oder als Vorschlag aus Open Food Facts (vorausgefüllt, prüfbar). */
export function IngredientForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: IngredientFormInitial;
  onSaved: (ingredient: IngredientOption) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [nutrients, setNutrients] = useState<Record<NutrientKey, string>>(() => ({
    kcal: formatDecimalInput(initial.kcal ?? null, 1),
    protein: formatDecimalInput(initial.protein ?? null, 1),
    carbs: formatDecimalInput(initial.carbs ?? null, 1),
    fat: formatDecimalInput(initial.fat ?? null, 1),
    fiber: formatDecimalInput(initial.fiber ?? null, 1),
    sugar: formatDecimalInput(initial.sugar ?? null, 1),
  }));
  const [foodGroup, setFoodGroup] = useState<Enums<"food_group">>(initial.food_group ?? "other");
  const [diet, setDiet] = useState<Enums<"ingredient_diet"> | "">(initial.diet ?? "");
  const [pieceWeight, setPieceWeight] = useState("");
  const [density, setDensity] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit() {
    const input: IngredientInput = {
      name,
      kcal: parseDecimal(nutrients.kcal) ?? Number.NaN,
      protein: parseDecimal(nutrients.protein) ?? Number.NaN,
      carbs: parseDecimal(nutrients.carbs) ?? Number.NaN,
      fat: parseDecimal(nutrients.fat) ?? Number.NaN,
      // Ballaststoffe und Zucker dürfen leer bleiben
      fiber: parseDecimal(nutrients.fiber) ?? 0,
      sugar: parseDecimal(nutrients.sugar) ?? 0,
      food_group: foodGroup,
      diet: diet || null,
      piece_weight_g: parseDecimal(pieceWeight),
      density_g_per_ml: parseDecimal(density),
      external_id: initial.externalId ?? null,
    };
    const parsed = ingredientInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(flattenIssues(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await createIngredientAction(input);
      if (result.ok) onSaved(result.ingredient);
      else {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <FormMessage message={message} />
      {initial.sourceLabel ? <p className="text-sm text-muted-foreground">{initial.sourceLabel}</p> : null}
      <FormField label="Name" name="ingredient-name" value={name} onChange={(e) => setName(e.target.value)} errors={errors.name} />

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">Nährwerte pro 100 g</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {NUTRIENTS.map((n) => (
            <FormField
              key={n.key}
              label={n.label}
              name={`ingredient-${n.key}`}
              inputMode="decimal"
              value={nutrients[n.key]}
              onChange={(e) => setNutrients((prev) => ({ ...prev, [n.key]: e.target.value }))}
              errors={errors[n.key]}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="ingredient-group">Zutatengruppe</Label>
          <NativeSelect
            id="ingredient-group"
            value={foodGroup}
            onChange={(e) => setFoodGroup(e.target.value as Enums<"food_group">)}
          >
            {Object.entries(FOOD_GROUP_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ingredient-diet">Ernährungsform</Label>
          <NativeSelect
            id="ingredient-diet"
            value={diet}
            onChange={(e) => setDiet(e.target.value as Enums<"ingredient_diet"> | "")}
          >
            <option value="">Automatisch aus der Gruppe</option>
            {Object.entries(DIET_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <details className="rounded-2xl border p-3">
        <summary className="min-h-8 cursor-pointer text-sm font-medium">Für Stück- und ml-Angaben (optional)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FormField
            label="Gewicht pro Stück (g)"
            name="ingredient-piece"
            inputMode="decimal"
            value={pieceWeight}
            onChange={(e) => setPieceWeight(e.target.value)}
            hint="z. B. 60 für ein Ei"
            errors={errors.piece_weight_g}
          />
          <FormField
            label="Dichte (g pro ml)"
            name="ingredient-density"
            inputMode="decimal"
            value={density}
            onChange={(e) => setDensity(e.target.value)}
            hint="z. B. 0,92 für Öl, leer = wie Wasser"
            errors={errors.density_g_per_ml}
          />
        </div>
      </details>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Zurück
        </Button>
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Wird gespeichert …" : "Zutat speichern und übernehmen"}
        </Button>
      </div>
    </div>
  );
}
