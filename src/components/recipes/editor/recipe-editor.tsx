"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Martini, Plus, Trash2, TriangleAlert } from "lucide-react";
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
import { computeAlcohol, DEFAULT_DILUTION, isBarGroup, type DilutionConfig } from "@/lib/domain/cocktail";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import type { IngredientOption } from "@/lib/domain/ingredient-option";
import { computeRecipeNutrition, type NutritionThresholds } from "@/lib/domain/nutrition";
import { detectTimers } from "@/lib/domain/timers";
import { needsManualGrams, resolveLineGrams, type Unit } from "@/lib/domain/units";
import { formatGrams, formatNumber } from "@/lib/format";
import { BAR_UNITS, CATEGORY_LABELS, GLASS_LABELS, KITCHEN_UNITS, METHOD_LABELS, UNIT_LABELS, type AutoTag } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { recipeInputSchema, flattenIssues, type CocktailInput, type RecipeInput } from "@/lib/validation/recipe";
import { IngredientPicker } from "./ingredient-picker";
import { TagInput } from "./tag-input";

export type EditorInitial = {
  id?: string;
  /** Phase 15: Cocktail (Bar) oder Gericht; ohne Angabe Gericht */
  recipe_type?: Enums<"recipe_type">;
  cocktail?: CocktailInput | null;
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
  /** Schritt, in dem die Zutat gebraucht wird (über den stabilen Schlüssel, damit Umsortieren nichts verschiebt) */
  stepKey: number | null;
};

type Step = { key: number; text: string; timerMinutes: string };

// Stabile Schlüssel für Listeneinträge (nur für React, nicht gespeichert)
let keySequence = 0;
const nextKey = () => ++keySequence;

const PIECE_GROUPS: Enums<"food_group">[] = ["egg", "fruit", "vegetables"];

function defaultUnit(ingredient: IngredientOption, cocktail: boolean): Unit {
  if (cocktail && (isBarGroup(ingredient.food_group) || ingredient.abv != null)) return "cl";
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
  dilution = DEFAULT_DILUTION,
  tagSuggestions,
  onSaved,
  cancel,
}: {
  initial: EditorInitial;
  thresholds: NutritionThresholds;
  /** Phase 15: Verdünnung je Methode (app_config), für die Live-Anzeige des Alkoholgehalts */
  dilution?: DilutionConfig;
  tagSuggestions: string[];
  /** Markdown-Import: nach dem Speichern hier weitermachen statt zur Rezeptseite zu wechseln */
  onSaved?: (recipeId: string) => void;
  /** Statt „Abbrechen“ (Link zur Übersicht) eine eigene Aktion, z. B. „Überspringen“ */
  cancel?: { label: string; onClick: () => void };
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
  // Phase 15: Cocktail-Felder
  const isCocktail = initial.recipe_type === "cocktail";
  const [glass, setGlass] = useState<Enums<"glass"> | "">(initial.cocktail?.glass ?? "");
  const [method, setMethod] = useState<Enums<"cocktail_method"> | "">(initial.cocktail?.method ?? "");
  const [ice, setIce] = useState(initial.cocktail?.ice ?? "");
  const [garnish, setGarnish] = useState(initial.cocktail?.garnish ?? "");
  // Phase 12: Notiz zur neuen Version (nur beim Bearbeiten)
  const [changeNote, setChangeNote] = useState("");
  const [initialState] = useState(() => {
    const stepsWithKeys: Step[] = initial.steps.map((s) => ({
      key: nextKey(),
      text: s.text,
      timerMinutes: s.timer_seconds ? formatDecimalInput(s.timer_seconds / 60) : "",
    }));
    const linesWithKeys: Line[] = initial.ingredients.map((l) => ({
      key: nextKey(),
      ingredient: l.ingredient,
      amount: formatDecimalInput(l.amount),
      unit: l.unit ?? "",
      manualGrams: needsManualGrams(l.amount, l.unit, l.ingredient) ? formatDecimalInput(l.grams) : "",
      note: l.note,
      stepKey: l.step_position != null ? (stepsWithKeys[l.step_position - 1]?.key ?? null) : null,
    }));
    return { steps: stepsWithKeys, lines: linesWithKeys };
  });
  const [lines, setLines] = useState<Line[]>(initialState.lines);
  const [steps, setSteps] = useState<Step[]>(initialState.steps);

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
    const unit = defaultUnit(ingredient, isCocktail);
    setLines((prev) => [
      ...prev,
      { key: nextKey(), ingredient, amount: unit === "piece" ? "1" : "", unit, manualGrams: "", note: "", stepKey: null },
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
  const alcohol = useMemo(
    () =>
      isCocktail
        ? computeAlcohol(
            lines.map((l) => ({ amount: parseDecimal(l.amount), unit: l.unit || null, ingredient: l.ingredient })),
            method || null,
            servingsNumber,
            dilution,
          )
        : null,
    [isCocktail, lines, method, servingsNumber, dilution],
  );
  // Spirituosen/Liköre ohne Alkoholgehalt zählen als alkoholfrei: darauf hinweisen
  const missingAbv = isCocktail
    ? [
        ...new Set(
          lines
            .filter((l) => l.ingredient.abv == null && (l.ingredient.food_group === "spirits" || l.ingredient.food_group === "liqueurs_wine"))
            .map((l) => l.ingredient.name),
        ),
      ]
    : [];
  const units = isCocktail ? BAR_UNITS : KITCHEN_UNITS;
  const servingWord = (n: number) => (isCocktail ? (n === 1 ? "Drink" : "Drinks") : n === 1 ? "Portion" : "Portionen");
  const autoTags: AutoTag[] = isCocktail ? [] : [
    ...(nutrition.isHighProtein ? (["high_protein"] as const) : []),
    ...(nutrition.isVegan ? (["vegan"] as const) : nutrition.isVegetarian ? (["vegetarian"] as const) : []),
    ...(nutrition.isLowCarb ? (["low_carb"] as const) : []),
    ...(isMealPrep ? (["meal_prep"] as const) : []),
  ];

  /** Nummer des Schritts (1, 2, …) zu einem Schlüssel; null, wenn keiner gewählt oder der Schritt gelöscht ist. */
  function stepNumber(key: number | null): number | null {
    if (key == null) return null;
    const index = steps.findIndex((s) => s.key === key);
    return index >= 0 ? index + 1 : null;
  }

  function timerSeconds(minutes: string): number | null {
    if (!minutes.trim()) return null;
    const value = parseDecimal(minutes);
    return value == null ? Number.NaN : Math.round(value * 60);
  }

  function buildInput(): RecipeInput {
    return {
      id: initial.id,
      recipe_type: initial.recipe_type,
      cocktail: isCocktail ? { glass: glass || null, method: method || null, ice, garnish } : null,
      title,
      description,
      servings: parseDecimal(servings) ?? Number.NaN,
      prep_minutes: intOrNull(prep),
      cook_minutes: isCocktail ? null : intOrNull(cook),
      category: isCocktail ? category || "drink" : category || null,
      tags,
      is_meal_prep: isCocktail ? false : isMealPrep,
      source_url: sourceUrl.trim(),
      ingredients: lines.map((l) => ({
        ingredient_id: l.ingredient.id,
        amount: l.amount.trim() ? (parseDecimal(l.amount) ?? Number.NaN) : null,
        unit: l.unit || null,
        manual_grams: parseDecimal(l.manualGrams),
        note: l.note,
        step_position: stepNumber(l.stepKey),
      })),
      steps: steps.map((s) => ({ text: s.text, timer_seconds: timerSeconds(s.timerMinutes) })),
      change_note: changeNote,
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
      const result = await saveRecipeAction(input, onSaved ? { stay: true } : undefined);
      // Bei Erfolg leitet die Action weiter (außer mit onSaved); sonst landen hier nur Fehler
      if (result?.ok) {
        onSaved?.(result.recipeId);
        return;
      }
      if (result && !result.ok) {
        setDirty(true);
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
      }
    });
  }

  const err = (key: string) => errors[key];
  const cancelHref = initial.id ? `/rezepte/${initial.id}` : isCocktail ? "/rezepte/bar" : "/rezepte";

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
        {isCocktail ? (
          <CocktailFields
            servings={servings}
            prep={prep}
            glass={glass}
            method={method}
            ice={ice}
            garnish={garnish}
            errors={errors}
            onServings={changed(setServings)}
            onPrep={changed(setPrep)}
            onGlass={changed(setGlass)}
            onMethod={changed(setMethod)}
            onIce={changed(setIce)}
            onGarnish={changed(setGarnish)}
          />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Portionen" name="servings" inputMode="numeric" value={servings} onChange={(e) => changed(setServings)(e.target.value)} errors={err("servings")} />
            <FormField label="Vorbereitung (Min.)" name="prep" inputMode="numeric" value={prep} onChange={(e) => changed(setPrep)(e.target.value)} errors={err("prep_minutes")} />
            <FormField label="Kochen (Min.)" name="cook" inputMode="numeric" value={cook} onChange={(e) => changed(setCook)(e.target.value)} errors={err("cook_minutes")} />
          </div>
        )}
        <div className={cn("grid gap-4 sm:grid-cols-2", isCocktail && "hidden")}>
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
                      {units.map((u) => (
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
                  {steps.length > 0 ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Label htmlFor={`step-${line.key}`} className="text-muted-foreground">
                        Gebraucht in
                      </Label>
                      <NativeSelect
                        id={`step-${line.key}`}
                        className="h-9 w-auto min-w-36"
                        value={stepNumber(line.stepKey)?.toString() ?? ""}
                        onChange={(e) =>
                          updateLine(line.key, { stepKey: e.target.value ? (steps[Number(e.target.value) - 1]?.key ?? null) : null })
                        }
                      >
                        <option value="">keinem bestimmten Schritt</option>
                        {steps.map((s, i) => (
                          <option key={s.key} value={i + 1}>
                            Schritt {i + 1}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  ) : null}
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
          {alcohol ? (
            <div className="mb-3 space-y-1" aria-live="polite">
              <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="flex items-center gap-1.5 text-lg font-semibold tabular-nums">
                  <Martini className="size-4 text-primary" aria-hidden />
                  {formatNumber(alcohol.abvPercent, 1)} % vol
                </span>
                <span className="text-sm tabular-nums">{formatNumber(alcohol.alcoholGramsPerDrink, 1)} g Alkohol</span>
                <span className="text-sm tabular-nums">≈ {formatNumber(Math.round(alcohol.drinkVolumeMl), 0)} ml im Glas</span>
              </p>
              <p className="text-xs text-muted-foreground">
                pro Drink,{" "}
                {method
                  ? `${METHOD_LABELS[method]}: +${formatNumber(alcohol.dilution * 100, 0)} % Schmelzwasser eingerechnet`
                  : "ohne Methode ohne Schmelzwasser gerechnet"}
              </p>
              {missingAbv.length > 0 ? (
                <p className="flex gap-1.5 text-xs text-muted-foreground">
                  <TriangleAlert className="size-3.5 shrink-0 text-primary" aria-hidden />
                  Für {missingAbv.join(", ")} fehlt der Alkoholgehalt, zählt als alkoholfrei.
                </p>
              ) : null}
            </div>
          ) : null}
          <MacroSummary
            values={nutrition.perServing}
            total={nutrition.total}
            caption={`pro ${isCocktail ? "Drink" : "Portion"} (${formatNumber(servingsNumber > 0 ? servingsNumber : 1, 0)} ${servingWord(servingsNumber)})`}
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
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Label htmlFor={`timer-${step.key}`} className="text-muted-foreground">
                        Timer
                      </Label>
                      <Input
                        id={`timer-${step.key}`}
                        inputMode="decimal"
                        className="h-9 w-20"
                        placeholder="–"
                        value={step.timerMinutes}
                        aria-invalid={Boolean(err(`steps.${index}.timer_seconds`)) || undefined}
                        onChange={(e) => {
                          setDirty(true);
                          setSteps((prev) => prev.map((s) => (s.key === step.key ? { ...s, timerMinutes: e.target.value } : s)));
                        }}
                      />
                      <span className="text-muted-foreground">Min.</span>
                      <StepTimerHint text={step.text} />
                    </div>
                    <div className="flex gap-1">
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
                  {err(`steps.${index}.timer_seconds`) ? (
                    <p className="text-xs text-destructive">Bitte den Timer in Minuten angeben (z. B. 10 oder 1,5), höchstens 24 Stunden.</p>
                  ) : null}
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
            setSteps((prev) => [...prev, { key: nextKey(), text: "", timerMinutes: "" }]);
          }}
        >
          <Plus aria-hidden />
          Schritt hinzufügen
        </Button>
      </section>

      {initial.id ? (
        <section className="space-y-1.5">
          <Label htmlFor="change-note">Was hast du geändert? (optional)</Label>
          <Input
            id="change-note"
            value={changeNote}
            maxLength={200}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="z. B. weniger Béchamel"
          />
          <p className="text-xs text-muted-foreground">
            Ändern sich Zutaten, Mengen, Schritte oder Portionen, entsteht eine neue Version mit dieser Notiz. Ältere Versionen
            findest du auf der Rezeptseite.
          </p>
          {err("change_note") ? <p className="text-xs text-destructive">{err("change_note")?.[0]}</p> : null}
        </section>
      ) : null}

      {/* Speicherleiste: bleibt sichtbar, auf dem Handy über der Navigation */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-3 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <p className="text-sm tabular-nums">
          {alcohol ? (
            <>
              <span className="font-semibold">{formatNumber(alcohol.abvPercent, 1)} % vol</span>
              <span className="text-muted-foreground"> · </span>
              <span className="font-medium">{formatNumber(Math.round(nutrition.perServing.kcal), 0)} kcal</span>
            </>
          ) : (
            <>
              <span className="font-semibold">{formatNumber(Math.round(nutrition.perServing.kcal), 0)} kcal</span>
              <span className="text-muted-foreground"> · </span>
              <span className="font-medium">{formatNumber(nutrition.perServing.protein, 0)} g P</span>
            </>
          )}
          <span className="block text-xs text-muted-foreground">pro {isCocktail ? "Drink" : "Portion"}</span>
        </p>
        <div className="flex gap-2">
          {cancel ? (
            <Button type="button" variant="ghost" onClick={cancel.onClick} disabled={pending}>
              {cancel.label}
            </Button>
          ) : (
            <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
              Abbrechen
            </Link>
          )}
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

/** Phase 15: Drinks, Zeit, Glas, Methode, Eis und Garnitur statt Portionen/Kochzeit/Kategorie. */
function CocktailFields(props: {
  servings: string;
  prep: string;
  glass: Enums<"glass"> | "";
  method: Enums<"cocktail_method"> | "";
  ice: string;
  garnish: string;
  errors: Record<string, string[]>;
  onServings: (v: string) => void;
  onPrep: (v: string) => void;
  onGlass: (v: Enums<"glass"> | "") => void;
  onMethod: (v: Enums<"cocktail_method"> | "") => void;
  onIce: (v: string) => void;
  onGarnish: (v: string) => void;
}) {
  const { errors } = props;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Drinks" name="servings" inputMode="numeric" value={props.servings} onChange={(e) => props.onServings(e.target.value)} errors={errors.servings} />
        <FormField label="Zubereitung (Min.)" name="prep" inputMode="numeric" value={props.prep} onChange={(e) => props.onPrep(e.target.value)} errors={errors.prep_minutes} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="glass">Glas</Label>
          <NativeSelect id="glass" value={props.glass} onChange={(e) => props.onGlass(e.target.value as Enums<"glass"> | "")}>
            <option value="">Keine Angabe</option>
            {Object.entries(GLASS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="method">Methode</Label>
          <NativeSelect id="method" value={props.method} onChange={(e) => props.onMethod(e.target.value as Enums<"cocktail_method"> | "")}>
            <option value="">Keine Angabe</option>
            {Object.entries(METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Eis (optional)" name="ice" placeholder="z. B. Würfel, crushed, ohne" value={props.ice} maxLength={100} onChange={(e) => props.onIce(e.target.value)} errors={errors["cocktail.ice"]} />
        <FormField label="Garnitur (optional)" name="garnish" placeholder="z. B. Limettenrad" value={props.garnish} maxLength={200} onChange={(e) => props.onGarnish(e.target.value)} errors={errors["cocktail.garnish"]} />
      </div>
    </>
  );
}

/** Zeigt, welche Zeitangaben der Kochmodus im Schritttext automatisch als Timer anbietet. */
function StepTimerHint({ text }: { text: string }) {
  const found = detectTimers(text);
  if (found.length === 0) return null;
  return <span className="text-xs text-muted-foreground">erkannt: {found.map((t) => t.label).join(", ")}</span>;
}
