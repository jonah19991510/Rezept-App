"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, TriangleAlert } from "lucide-react";
import { saveRecipeAction } from "@/app/(app)/rezepte/actions";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MacroSummary } from "@/components/recipes/macro-summary";
import { RecipeTags } from "@/components/recipes/recipe-tags";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import type { IngredientOption } from "@/lib/domain/ingredient-option";
import { computeRecipeNutrition, type NutritionThresholds } from "@/lib/domain/nutrition";
import { needsManualGrams, resolveLineGrams, type Unit } from "@/lib/domain/units";
import { formatGrams, formatNumber } from "@/lib/format";
import { CATEGORY_LABELS, KITCHEN_UNITS, UNIT_LABELS, type AutoTag } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { recipeInputSchema, flattenIssues, type RecipeInput } from "@/lib/validation/recipe";
import { IngredientPicker } from "./ingredient-picker";
import { TagInput } from "./tag-input";

export type EditorInitial = {
  id?: string;
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

type Line = {
  key: number;
  ingredient: IngredientOption;
  amount: string;
  unit: Unit | "";
  manualGrams: string;
  note: string;
  step_position: number | null;
};

type Step = { key: number; text: string; timer_seconds: number | null };

// Stabile Schlüssel für Listeneinträge (nur für React, nicht gespeichert)
let keySequence = 0;
const nextKey = () => ++keySequence;

const PIECE_GROUPS: Enums<"food_group">[] = ["egg", "fruit", "vegetables"];

function defaultUnit(ingredient: IngredientOption): Unit {
  return ingredient.piece_weight_g && PIECE_GROUPS.includes(ingredient.food_group) ? "piece" : "g";
}

function intOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const n = parseDecimal(value);
  return n == null ? Number.NaN : n;
}

function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

export function RecipeEditor({
  initial,
  thresholds,
  tagSuggestions,
}: {
  initial: EditorInitial;
  thresholds: NutritionThresholds;
  tagSuggestions: string[];
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [servings, setServings] = useState(String(initial.servings));
  const [prep, setPrep] = useState(initial.prep_minutes?.toString() ?? "");
  const [cook, setCook] = useState(initial.cook_minutes?.toString() ?? "");
  const [category, setCategory] = useState<Enums<"recipe_category"> | "">(initial.category ?? "");
  const [tags, setTags] = useState(initial.tags);
  const [isMealPrep, setIsMealPrep] = useState(initial.is_meal_prep);
  const [sourceUrl, setSourceUrl] = useState(initial.source_url);
  const [lines, setLines] = useState<Line[]>(() =>
    initial.ingredients.map((l) => ({
      key: nextKey(),
      ingredient: l.ingredient,
      amount: formatDecimalInput(l.amount),
      unit: l.unit ?? "",
      manualGrams: needsManualGrams(l.amount, l.unit, l.ingredient) ? formatDecimalInput(l.grams) : "",
      note: l.note,
      step_position: l.step_position,
    })),
  );
  const [steps, setSteps] = useState<Step[]>(() =>
    initial.steps.map((s) => ({ key: nextKey(), text: s.text, timer_seconds: s.timer_seconds })),
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceKey, setReplaceKey] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  // Warnung beim Verlassen mit ungespeicherten Änderungen
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function changed<T>(setter: (v: T) => void) {
    return (v: T) => {
      setDirty(true);
      setter(v);
    };
  }

  function updateLine(key: number, patch: Partial<Line>) {
    setDirty(true);
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function onPick(ingredient: IngredientOption) {
    setDirty(true);
    if (replaceKey != null) {
      updateLine(replaceKey, { ingredient });
      setReplaceKey(null);
      return;
    }
    const unit = defaultUnit(ingredient);
    setLines((prev) => [
      ...prev,
      { key: nextKey(), ingredient, amount: unit === "piece" ? "1" : "", unit, manualGrams: "", note: "", step_position: null },
    ]);
  }

  // Live-Makros mit derselben Logik wie die Datenbank-View
  const servingsNumber = parseDecimal(servings) ?? 1;
  const resolved = useMemo(
    () =>
      lines.map((l) => {
        const amount = parseDecimal(l.amount);
        const unit = l.unit || null;
        return {
          grams: resolveLineGrams(amount, unit, l.ingredient, parseDecimal(l.manualGrams)),
          needsManual: needsManualGrams(amount, unit, l.ingredient),
          ingredient: l.ingredient,
        };
      }),
    [lines],
  );
  const nutrition = useMemo(
    () => computeRecipeNutrition(resolved, servingsNumber, thresholds),
    [resolved, servingsNumber, thresholds],
  );
  const autoTags: AutoTag[] = [
    ...(nutrition.isHighProtein ? (["high_protein"] as const) : []),
    ...(nutrition.isVegan ? (["vegan"] as const) : nutrition.isVegetarian ? (["vegetarian"] as const) : []),
    ...(nutrition.isLowCarb ? (["low_carb"] as const) : []),
    ...(isMealPrep ? (["meal_prep"] as const) : []),
  ];

  function buildInput(): RecipeInput {
    return {
      id: initial.id,
      title,
      description,
      servings: parseDecimal(servings) ?? Number.NaN,
      prep_minutes: intOrNull(prep),
      cook_minutes: intOrNull(cook),
      category: category || null,
      tags,
      is_meal_prep: isMealPrep,
      source_url: sourceUrl.trim(),
      ingredients: lines.map((l) => ({
        ingredient_id: l.ingredient.id,
        amount: l.amount.trim() ? (parseDecimal(l.amount) ?? Number.NaN) : null,
        unit: l.unit || null,
        manual_grams: parseDecimal(l.manualGrams),
        note: l.note,
        step_position: l.step_position,
      })),
      steps: steps.map((s) => ({ text: s.text, timer_seconds: s.timer_seconds })),
    };
  }

  function save() {
    const input = buildInput();
    const parsed = recipeInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(flattenIssues(parsed.error));
      setMessage("Bitte prüfe die markierten Felder.");
      return;
    }
    setErrors({});
    setMessage(undefined);
    startTransition(async () => {
      setDirty(false);
      const result = await saveRecipeAction(input);
      // Bei Erfolg leitet die Action weiter; hier landen nur Fehler
      if (result && !result.ok) {
        setDirty(true);
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
      }
    });
  }

  const err = (key: string) => errors[key];
  const cancelHref = initial.id ? `/rezepte/${initial.id}` : "/rezepte";

  return (
    <div className="space-y-6">
      <FormMessage message={message} />

      {/* Grunddaten */}
      <section className="grid gap-4 rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="sec-basis">
        <h2 id="sec-basis" className="text-xl font-semibold">
          Grunddaten
        </h2>
        <FormField label="Titel" name="title" value={title} onChange={(e) => changed(setTitle)(e.target.value)} errors={err("title")} maxLength={200} />
        <div className="grid gap-1.5">
          <Label htmlFor="description">Beschreibung (optional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => changed(setDescription)(e.target.value)}
            rows={2}
            maxLength={2000}
            className="rounded-xl bg-card"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Portionen" name="servings" inputMode="numeric" value={servings} onChange={(e) => changed(setServings)(e.target.value)} errors={err("servings")} />
          <FormField label="Vorbereitung (Min.)" name="prep" inputMode="numeric" value={prep} onChange={(e) => changed(setPrep)(e.target.value)} errors={err("prep_minutes")} />
          <FormField label="Kochen (Min.)" name="cook" inputMode="numeric" value={cook} onChange={(e) => changed(setCook)(e.target.value)} errors={err("cook_minutes")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="category">Kategorie</Label>
            <NativeSelect id="category" value={category} onChange={(e) => changed(setCategory)(e.target.value as Enums<"recipe_category"> | "")}>
              <option value="">Keine</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <label htmlFor="meal-prep" className="flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 sm:mt-6">
            <span className="text-sm">
              <span className="font-medium">Meal-Prep-geeignet</span>
              <span className="block text-xs text-muted-foreground">Lässt sich gut vorkochen</span>
            </span>
            <Switch id="meal-prep" checked={isMealPrep} onCheckedChange={(v) => changed(setIsMealPrep)(v)} />
          </label>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tags">Eigene Tags</Label>
          <TagInput id="tags" value={tags} onChange={changed(setTags)} suggestions={tagSuggestions} />
          {err("tags") ? <p className="text-sm text-destructive">{err("tags")?.[0]}</p> : null}
        </div>
        <FormField
          label="Quelle (optional)"
          name="source_url"
          type="url"
          inputMode="url"
          placeholder="https://…"
          value={sourceUrl}
          onChange={(e) => changed(setSourceUrl)(e.target.value)}
          errors={err("source_url")}
        />
      </section>

      {/* Zutaten */}
      <section className="grid gap-4 rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="sec-zutaten">
        <h2 id="sec-zutaten" className="text-xl font-semibold">
          Zutaten
        </h2>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Zutaten. Füg die erste hinzu, die Makros rechnen sich dann mit.</p>
        ) : (
          <ol className="grid gap-3">
            {lines.map((line, index) => {
              const r = resolved[index];
              const prefix = `ingredients.${index}`;
              return (
                <li key={line.key} className="grid gap-2 rounded-2xl border p-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setReplaceKey(line.key);
                        setPickerOpen(true);
                      }}
                      className="min-h-11 min-w-0 flex-1 truncate rounded-lg px-1 text-left font-medium hover:text-primary"
                      aria-label={`${line.ingredient.name} austauschen`}
                    >
                      {line.ingredient.name}
                    </button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => { setDirty(true); setLines((p) => move(p, index, -1)); }} disabled={index === 0} aria-label="Nach oben">
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => { setDirty(true); setLines((p) => move(p, index, 1)); }} disabled={index === lines.length - 1} aria-label="Nach unten">
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => { setDirty(true); setLines((p) => p.filter((l) => l.key !== line.key)); }} aria-label={`${line.ingredient.name} entfernen`}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  <div className="grid grid-cols-[6rem_7.5rem_1fr] gap-2">
                    <Input
                      aria-label="Menge"
                      inputMode="decimal"
                      placeholder="Menge"
                      value={line.amount}
                      onChange={(e) => updateLine(line.key, { amount: e.target.value })}
                      aria-invalid={Boolean(err(`${prefix}.amount`)) || undefined}
                    />
                    <NativeSelect
                      aria-label="Einheit"
                      value={line.unit}
                      onChange={(e) => updateLine(line.key, { unit: e.target.value as Unit | "" })}
                      aria-invalid={Boolean(err(`${prefix}.unit`)) || undefined}
                    >
                      <option value="">–</option>
                      {KITCHEN_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {UNIT_LABELS[u]}
                        </option>
                      ))}
                    </NativeSelect>
                    <Input
                      aria-label="Notiz"
                      placeholder="Notiz, z. B. gewürfelt"
                      value={line.note}
                      maxLength={200}
                      onChange={(e) => updateLine(line.key, { note: e.target.value })}
                    />
                  </div>
                  {r.needsManual ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Label htmlFor={`manual-${line.key}`} className="text-muted-foreground">
                        Wie viel wiegt das zusammen? ≈
                      </Label>
                      <Input
                        id={`manual-${line.key}`}
                        inputMode="decimal"
                        className="w-24"
                        value={line.manualGrams}
                        onChange={(e) => updateLine(line.key, { manualGrams: e.target.value })}
                      />
                      <span>g</span>
                    </div>
                  ) : null}
                  <p className={cn("text-xs", err(`${prefix}.amount`) || err(`${prefix}.unit`) ? "text-destructive" : "text-muted-foreground")}>
                    {err(`${prefix}.amount`)?.[0] ??
                      err(`${prefix}.unit`)?.[0] ??
                      (r.grams != null
                        ? `≈ ${formatGrams(r.grams, 0)} · ${formatNumber(Math.round((r.grams * line.ingredient.kcal) / 100), 0)} kcal`
                        : line.amount.trim()
                          ? "Gewicht unbekannt, zählt nicht in den Nährwerten"
                          : "ohne Menge (z. B. nach Geschmack)")}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setReplaceKey(null);
            setPickerOpen(true);
          }}
        >
          <Plus aria-hidden />
          Zutat hinzufügen
        </Button>

        <div className="rounded-2xl bg-muted/40 p-3">
          <MacroSummary
            values={nutrition.perServing}
            total={nutrition.total}
            caption={`pro Portion (${formatNumber(servingsNumber > 0 ? servingsNumber : 1, 0)} ${servingsNumber === 1 ? "Portion" : "Portionen"})`}
          />
          {nutrition.linesWithoutGrams > 0 ? (
            <p className="mt-2 flex gap-1.5 text-xs text-muted-foreground">
              <TriangleAlert className="size-3.5 shrink-0 text-primary" aria-hidden />
              {nutrition.linesWithoutGrams} {nutrition.linesWithoutGrams === 1 ? "Zutat zählt" : "Zutaten zählen"} ohne Gewicht nicht mit.
            </p>
          ) : null}
          <RecipeTags autoTags={autoTags} className="mt-3" />
        </div>
      </section>

      {/* Zubereitung */}
      <section className="grid gap-4 rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="sec-schritte">
        <h2 id="sec-schritte" className="text-xl font-semibold">
          Zubereitung
        </h2>
        {steps.length > 0 ? (
          <ol className="grid gap-3">
            {steps.map((step, index) => (
              <li key={step.key} className="grid grid-cols-[2rem_1fr] gap-2">
                <span className="mt-2 grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <div className="grid gap-1">
                  <Textarea
                    aria-label={`Schritt ${index + 1}`}
                    value={step.text}
                    rows={3}
                    maxLength={2000}
                    className="rounded-xl bg-card"
                    aria-invalid={Boolean(err(`steps.${index}.text`)) || undefined}
                    onChange={(e) => {
                      setDirty(true);
                      setSteps((prev) => prev.map((s) => (s.key === step.key ? { ...s, text: e.target.value } : s)));
                    }}
                  />
                  {err(`steps.${index}.text`) ? <p className="text-xs text-destructive">{err(`steps.${index}.text`)?.[0]}</p> : null}
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => { setDirty(true); setSteps((p) => move(p, index, -1)); }} disabled={index === 0} aria-label="Schritt nach oben">
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => { setDirty(true); setSteps((p) => move(p, index, 1)); }} disabled={index === steps.length - 1} aria-label="Schritt nach unten">
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => { setDirty(true); setSteps((p) => p.filter((s) => s.key !== step.key)); }} aria-label={`Schritt ${index + 1} löschen`}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Noch keine Schritte.</p>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDirty(true);
            setSteps((prev) => [...prev, { key: nextKey(), text: "", timer_seconds: null }]);
          }}
        >
          <Plus aria-hidden />
          Schritt hinzufügen
        </Button>
      </section>

      {/* Speicherleiste: bleibt sichtbar, auf dem Handy über der Navigation */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-3 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <p className="text-sm tabular-nums">
          <span className="font-semibold">{formatNumber(Math.round(nutrition.perServing.kcal), 0)} kcal</span>
          <span className="text-muted-foreground"> · </span>
          <span className="font-medium">{formatNumber(nutrition.perServing.protein, 0)} g P</span>
          <span className="block text-xs text-muted-foreground">pro Portion</span>
        </p>
        <div className="flex gap-2">
          <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
            Abbrechen
          </Link>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Wird gespeichert …" : "Speichern"}
          </Button>
        </div>
      </div>

      <IngredientPicker
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (!open) setReplaceKey(null);
        }}
        onSelect={onPick}
      />
    </div>
  );
}
