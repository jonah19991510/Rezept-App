"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Martini, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { saveRecipeAction } from "@/app/(app)/rezepte/actions";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeAlcohol, DEFAULT_DILUTION, isBarGroup, type DilutionConfig } from "@/lib/domain/cocktail";
import { formatDecimalInput, parseDecimal } from "@/lib/domain/decimal";
import type { IngredientOption } from "@/lib/domain/ingredient-option";
import { computeRecipeNutrition, type NutritionThresholds } from "@/lib/domain/nutrition";
import { formatMinutes, removeStep, stepNumberOf, timerModeOf } from "@/lib/domain/recipe-editor";
import { needsManualGrams, resolveLineGrams, type Unit } from "@/lib/domain/units";
import { formatNumber } from "@/lib/format";
import { categoryOptions } from "@/lib/domain/categories";
import { METHOD_LABELS, type AutoTag } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { recipeInputSchema, flattenIssues, type CocktailInput, type RecipeInput } from "@/lib/validation/recipe";
import { BasicsSection, SourceSection, type Basics } from "./basics-section";
import { EditorHeader } from "./editor-header";
import type { Line, Step } from "./editor-model";
import { IngredientPicker } from "./ingredient-picker";
import { IngredientSheet } from "./ingredient-sheet";
import { IngredientsSection } from "./ingredients-section";
import { StepSheet } from "./step-sheet";
import { customTimerSeconds, StepsSection } from "./steps-section";
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
  category: string | null;
  tags: string[];
  is_meal_prep: boolean;
  source_url: string;
  /** Beilagen als Vorschläge (gehören nicht zum Rezept); ohne Angabe keine */
  side_dishes?: string[];
  ingredients: {
    ingredient: IngredientOption;
    amount: number | null;
    unit: Unit | null;
    grams: number | null;
    note: string;
    step_position: number | null;
    /** Optionale Zutat: zählt nicht in Nährwerten, Kosten und Einkaufsliste */
    is_optional?: boolean;
  }[];
  /** timer_from_text: false = Timer „Keiner“ (ohne Angabe: Zeiten im Text sind Timer) */
  steps: { text: string; timer_seconds: number | null; timer_from_text?: boolean }[];
};

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

/**
 * Rezept anlegen/bearbeiten (Design vom 25.10.2026): Grunddaten, Zutaten und Schritte als kompakte Listen,
 * Bearbeiten in Sheets. Alles wirkt nur aufs Formular und wird erst mit „Speichern“ gespeichert.
 */
export function RecipeEditor({
  initial,
  thresholds,
  dilution = DEFAULT_DILUTION,
  tagSuggestions,
  sideSuggestions = [],
  categories = [],
  header,
  onSaved,
  cancel,
}: {
  initial: EditorInitial;
  thresholds: NutritionThresholds;
  /** Phase 15: Verdünnung je Methode (app_config), für die Live-Anzeige des Alkoholgehalts */
  dilution?: DilutionConfig;
  tagSuggestions: string[];
  /** Vorschläge für Beilagen, z. B. Titel der eigenen Rezepte (werden auf der Rezeptseite verlinkt) */
  sideSuggestions?: string[];
  /** eigene Kategorien (Einstellungen → Kategorien) */
  categories?: string[];
  /**
   * Eigene Seite (neu/bearbeiten): Kopf mit X und Titel, Speicherleiste fest unten (ohne Navigation).
   * Ohne Angabe (Import) bleibt die Leiste über der Navigation und hat „Abbrechen“ bzw. `cancel`.
   */
  header?: { kicker: string };
  /** Markdown-Import: nach dem Speichern hier weitermachen statt zur Rezeptseite zu wechseln */
  onSaved?: (recipeId: string) => void;
  /** Statt „Abbrechen“ eine eigene Aktion, z. B. „Überspringen“ */
  cancel?: { label: string; onClick: () => void };
}) {
  const isCocktail = initial.recipe_type === "cocktail";
  const [basics, setBasics] = useState<Basics>(() => ({
    title: initial.title,
    description: initial.description,
    servings: Math.max(1, Math.round(initial.servings)),
    prep: initial.prep_minutes?.toString() ?? "",
    cook: initial.cook_minutes?.toString() ?? "",
    category: initial.category ?? "",
    tags: initial.tags,
    isMealPrep: initial.is_meal_prep,
    sourceUrl: initial.source_url,
    sideDishes: initial.side_dishes ?? [],
    glass: initial.cocktail?.glass ?? "",
    method: initial.cocktail?.method ?? "",
    ice: initial.cocktail?.ice ?? "",
    garnish: initial.cocktail?.garnish ?? "",
  }));
  // Eine Kategorie, die nicht (mehr) in der eigenen Liste steht (z. B. übernommenes Rezept), bleibt wählbar
  const categoryChoices = categoryOptions(categories, [initial.category]);
  // Phase 12: Notiz zur neuen Version (nur beim Bearbeiten)
  const [changeNote, setChangeNote] = useState("");

  // Schlüssel fortlaufend ab 1 (Schritte, dann Zutaten): auf Server und im Browser gleich, keine Hydration-Abweichung
  const [initialState] = useState(() => {
    const steps: Step[] = initial.steps.map((s, i) => ({
      key: i + 1,
      text: s.text,
      timerMode: timerModeOf(s),
      timerMinutes: s.timer_seconds ? formatDecimalInput(s.timer_seconds / 60) : "",
    }));
    const lines: Line[] = initial.ingredients.map((l, i) => ({
      key: steps.length + i + 1,
      ingredient: l.ingredient,
      amount: formatDecimalInput(l.amount),
      unit: l.unit ?? "",
      manualGrams: needsManualGrams(l.amount, l.unit, l.ingredient) ? formatDecimalInput(l.grams) : "",
      note: l.note,
      stepKey: l.step_position != null ? (steps[l.step_position - 1]?.key ?? null) : null,
      optional: l.is_optional ?? false,
    }));
    return { steps, lines };
  });
  const keySequence = useRef(initialState.steps.length + initialState.lines.length);
  const nextKey = () => ++keySequence.current;
  const [lines, setLines] = useState<Line[]>(initialState.lines);
  const [steps, setSteps] = useState<Step[]>(initialState.steps);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceKey, setReplaceKey] = useState<number | null>(null);
  const [lineSheet, setLineSheet] = useState<{ key: number; open: boolean } | null>(null);
  const [stepSheet, setStepSheet] = useState<{ key: number; open: boolean } | null>(null);
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

  function updateBasics(patch: Partial<Basics>) {
    setDirty(true);
    setBasics((prev) => ({ ...prev, ...patch }));
  }
  function changeLines(update: (prev: Line[]) => Line[]) {
    setDirty(true);
    setLines(update);
  }
  function changeSteps(update: (prev: Step[]) => Step[]) {
    setDirty(true);
    setSteps(update);
  }
  function updateLine(key: number, patch: Partial<Line>) {
    changeLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function updateStep(key: number, patch: Partial<Step>) {
    changeSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function onPick(ingredient: IngredientOption) {
    if (replaceKey != null) {
      updateLine(replaceKey, { ingredient });
      setReplaceKey(null);
      setLineSheet({ key: replaceKey, open: true });
      return;
    }
    const unit = defaultUnit(ingredient, isCocktail);
    const key = nextKey();
    changeLines((prev) => [
      ...prev,
      { key, ingredient, amount: unit === "piece" ? "1" : "", unit, manualGrams: "", note: "", stepKey: null, optional: false },
    ]);
    // Danach direkt Menge & Co. festlegen
    setLineSheet({ key, open: true });
  }

  function removeLine(key: number) {
    const before = lines;
    const name = lines.find((l) => l.key === key)?.ingredient.name ?? "Zutat";
    setLineSheet((s) => (s ? { ...s, open: false } : s));
    changeLines((prev) => prev.filter((l) => l.key !== key));
    toast(`${name} entfernt`, { action: { label: "Rückgängig", onClick: () => setLines(before) } });
  }

  function addStep() {
    const key = nextKey();
    changeSteps((prev) => [...prev, { key, text: "", timerMode: "text", timerMinutes: "" }]);
    setStepSheet({ key, open: true });
  }

  function deleteStep(key: number, undo: boolean) {
    const before = { steps, lines };
    const number = stepNumberOf(key, steps);
    setDirty(true);
    const next = removeStep(steps, lines, key);
    setSteps(next.steps);
    setLines(next.lines);
    if (undo) {
      toast(number ? `Schritt ${number} entfernt` : "Schritt entfernt", {
        action: {
          label: "Rückgängig",
          onClick: () => {
            setSteps(before.steps);
            setLines(before.lines);
          },
        },
      });
    }
  }

  function closeStepSheet(open: boolean) {
    if (open || !stepSheet) return;
    setStepSheet({ ...stepSheet, open: false });
    // Ein neuer Schritt, der leer bleibt, verschwindet wieder
    const step = steps.find((s) => s.key === stepSheet.key);
    if (step && !step.text.trim()) deleteStep(step.key, false);
  }

  // Live-Makros mit derselben Logik wie die Datenbank-View
  const servingsNumber = basics.servings > 0 ? basics.servings : 1;
  const resolved = useMemo(
    () =>
      lines.map((l) => {
        const amount = parseDecimal(l.amount);
        const unit = l.unit || null;
        return {
          grams: resolveLineGrams(amount, unit, l.ingredient, parseDecimal(l.manualGrams)),
          needsManual: needsManualGrams(amount, unit, l.ingredient),
          ingredient: l.ingredient,
          optional: l.optional,
        };
      }),
    [lines],
  );
  // Optionale Zutaten zählen nicht mit (wie in den Views recipe_nutrition und recipe_alcohol)
  const nutrition = useMemo(
    () => computeRecipeNutrition(resolved.filter((r) => !r.optional), servingsNumber, thresholds),
    [resolved, servingsNumber, thresholds],
  );
  const method = basics.method;
  const alcohol = useMemo(
    () =>
      isCocktail
        ? computeAlcohol(
            lines
              .filter((l) => !l.optional)
              .map((l) => ({ amount: parseDecimal(l.amount), unit: l.unit || null, ingredient: l.ingredient })),
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
  const autoTags: AutoTag[] = isCocktail
    ? []
    : [
        ...(nutrition.isHighProtein ? (["high_protein"] as const) : []),
        ...(nutrition.isVegan ? (["vegan"] as const) : nutrition.isVegetarian ? (["vegetarian"] as const) : []),
        ...(nutrition.isLowCarb ? (["low_carb"] as const) : []),
      ];
  const minutes = (v: string) => Math.max(0, parseDecimal(v) ?? 0);
  const totalTime = formatMinutes(minutes(basics.prep) + (isCocktail ? 0 : minutes(basics.cook)));

  function buildInput(): RecipeInput {
    return {
      id: initial.id,
      recipe_type: initial.recipe_type,
      cocktail: isCocktail ? { glass: basics.glass || null, method: basics.method || null, ice: basics.ice, garnish: basics.garnish } : null,
      title: basics.title,
      description: basics.description,
      servings: basics.servings,
      prep_minutes: intOrNull(basics.prep),
      cook_minutes: isCocktail ? null : intOrNull(basics.cook),
      category: isCocktail ? null : basics.category || null,
      tags: basics.tags,
      is_meal_prep: isCocktail ? false : basics.isMealPrep,
      source_url: basics.sourceUrl.trim(),
      side_dishes: isCocktail ? [] : basics.sideDishes,
      ingredients: lines.map((l) => ({
        ingredient_id: l.ingredient.id,
        amount: l.amount.trim() ? (parseDecimal(l.amount) ?? Number.NaN) : null,
        unit: l.unit || null,
        manual_grams: parseDecimal(l.manualGrams),
        note: l.note,
        step_position: stepNumberOf(l.stepKey, steps),
        is_optional: l.optional,
      })),
      steps: steps.map((s) => ({
        text: s.text,
        timer_seconds:
          s.timerMode === "custom" ? (s.timerMinutes.trim() ? (customTimerSeconds(s) ?? Number.NaN) : null) : null,
        timer_from_text: s.timerMode !== "none",
      })),
      change_note: changeNote,
    };
  }

  function save() {
    const input = buildInput();
    const parsed = recipeInputSchema.safeParse(input);
    if (!parsed.success) {
      const issues = flattenIssues(parsed.error);
      setErrors(issues);
      setMessage("Bitte prüfe die markierten Felder.");
      toast.error("Bitte prüfe die markierten Felder.");
      document.getElementById(firstErrorTarget(issues))?.scrollIntoView({ block: "center" });
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
        toast.error(result.message ?? "Speichern fehlgeschlagen.");
      }
    });
  }

  const err = (key: string) => errors[key];
  const cancelHref = initial.id ? `/rezepte/${initial.id}` : isCocktail ? "/rezepte/bar" : "/rezepte";
  const openLine = lineSheet ? lines.find((l) => l.key === lineSheet.key) : undefined;
  const openLineIndex = lineSheet ? lines.findIndex((l) => l.key === lineSheet.key) : -1;
  const openStep = stepSheet ? steps.find((s) => s.key === stepSheet.key) : undefined;
  const pageMode = Boolean(header);

  return (
    <div className="space-y-8">
      {header ? (
        <EditorHeader
          kicker={header.kicker}
          title={basics.title.trim() || "Ohne Titel"}
          cancelHref={cancelHref}
          dirty={dirty}
          onDiscard={() => setDirty(false)}
        />
      ) : null}
      <FormMessage message={message} />

      <BasicsSection
        basics={basics}
        update={updateBasics}
        isCocktail={isCocktail}
        categoryChoices={categoryChoices}
        autoTags={autoTags}
        tagSuggestions={tagSuggestions}
        errors={errors}
      />

      <IngredientsSection
        lines={lines}
        steps={steps}
        resolved={resolved}
        perServing={nutrition.perServing}
        servings={servingsNumber}
        isCocktail={isCocktail}
        errors={errors}
        onOpen={(key) => setLineSheet({ key, open: true })}
        onAdd={() => {
          setReplaceKey(null);
          setPickerOpen(true);
        }}
        onLinesChange={changeLines}
        summaryExtra={
          alcohol ? (
            <div className="mb-3 space-y-0.5 border-b pb-3">
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
            </div>
          ) : null
        }
        notices={
          missingAbv.length > 0 || nutrition.linesWithoutGrams > 0 ? (
            <div className="-mt-2 space-y-1 px-1">
              {missingAbv.length > 0 ? (
                <p className="flex gap-1.5 text-xs text-muted-foreground">
                  <TriangleAlert className="size-3.5 shrink-0 text-primary" aria-hidden />
                  Für {missingAbv.join(", ")} fehlt der Alkoholgehalt, zählt als alkoholfrei.
                </p>
              ) : null}
              {nutrition.linesWithoutGrams > 0 ? (
                <p className="flex gap-1.5 text-xs text-muted-foreground">
                  <TriangleAlert className="size-3.5 shrink-0 text-primary" aria-hidden />
                  {nutrition.linesWithoutGrams} {nutrition.linesWithoutGrams === 1 ? "Zutat zählt" : "Zutaten zählen"} ohne Gewicht nicht mit.
                </p>
              ) : null}
            </div>
          ) : null
        }
      />

      <StepsSection
        steps={steps}
        lines={lines}
        totalTime={totalTime}
        errors={errors}
        onOpen={(key) => setStepSheet({ key, open: true })}
        onAdd={addStep}
        onStepsChange={changeSteps}
      />

      {/* Beilagen: Vorschläge, gehören nicht zum Rezept (keine Nährwerte, kein Einkauf) */}
      {isCocktail ? null : (
        <section className="grid grid-cols-1 gap-3 rounded-3xl border bg-card p-4 md:p-5" aria-labelledby="sec-beilagen">
          <div className="space-y-1">
            <h2 id="sec-beilagen" className="text-xl font-semibold">
              Passt dazu (optional)
            </h2>
            <p className="text-sm text-muted-foreground">
              Beilagen als Vorschlag, z. B. Spätzle oder Kroketten zum Gulasch. Sie gehören nicht zum Rezept und zählen
              nicht in den Nährwerten. Heißt eine Beilage wie eines deiner Rezepte, wird sie verlinkt.
            </p>
          </div>
          <TagInput
            id="side-dishes"
            value={basics.sideDishes}
            onChange={(sideDishes) => updateBasics({ sideDishes })}
            suggestions={sideSuggestions.filter((t) => t.toLocaleLowerCase("de") !== basics.title.trim().toLocaleLowerCase("de"))}
            placeholder="Beilage eingeben und Enter drücken"
            maxLength={100}
            itemLabel="Beilage"
          />
          {err("side_dishes") ? <p className="text-sm text-destructive">{err("side_dishes")?.[0]}</p> : null}
        </section>
      )}

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

      <SourceSection value={basics.sourceUrl} onChange={(sourceUrl) => updateBasics({ sourceUrl })} error={err("source_url")?.[0]} />
      {/*
        Speicherleiste. Eigene Seite: am Handy fest am unteren Rand (Navigation ist ausgeblendet), am Desktop
        mitlaufend unten im Inhalt. Import: wie bisher über der Navigation.
      */}
      <div
        className={cn(
          "z-40 flex items-center justify-between gap-3 bg-background/95 backdrop-blur",
          pageMode
            ? "fixed inset-x-0 bottom-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:sticky md:bottom-4 md:rounded-2xl md:border md:p-3 md:shadow-lg"
            : "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] rounded-2xl border p-3 shadow-lg md:bottom-4",
        )}
      >
        <p className="min-w-0 tabular-nums">
          {alcohol ? (
            <span className="font-semibold whitespace-nowrap">
              {formatNumber(alcohol.abvPercent, 1)} % vol · {formatNumber(Math.round(nutrition.perServing.kcal), 0)} kcal
            </span>
          ) : (
            <span className="font-semibold whitespace-nowrap">
              {formatNumber(Math.round(nutrition.perServing.kcal), 0)} kcal · {formatNumber(nutrition.perServing.protein, 0)} g P
            </span>
          )}
          <span className="block text-xs text-muted-foreground">pro {isCocktail ? "Drink" : "Portion"}</span>
        </p>
        <div className="flex shrink-0 gap-1 sm:gap-2">
          {cancel ? (
            <Button type="button" variant="ghost" className="h-12" onClick={cancel.onClick} disabled={pending}>
              {cancel.label}
            </Button>
          ) : null}
          <Button type="button" onClick={save} disabled={pending} className="h-12 rounded-full px-7 text-base">
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

      <IngredientSheet
        open={Boolean(lineSheet?.open && openLine)}
        onOpenChange={(open) => setLineSheet((s) => (s ? { ...s, open } : s))}
        line={openLine}
        index={openLineIndex}
        steps={steps}
        isCocktail={isCocktail}
        errors={errors}
        onChange={(patch) => lineSheet && updateLine(lineSheet.key, patch)}
        onRemove={() => lineSheet && removeLine(lineSheet.key)}
        onReplace={() => {
          if (!lineSheet) return;
          setReplaceKey(lineSheet.key);
          setLineSheet({ ...lineSheet, open: false });
          setPickerOpen(true);
        }}
      />

      <StepSheet
        open={Boolean(stepSheet?.open && openStep)}
        onOpenChange={closeStepSheet}
        step={openStep}
        steps={steps}
        lines={lines}
        errors={errors}
        onChange={(patch) => stepSheet && updateStep(stepSheet.key, patch)}
        onToggleLine={(lineKey) =>
          stepSheet &&
          changeLines((prev) =>
            prev.map((l) => (l.key === lineKey ? { ...l, stepKey: l.stepKey === stepSheet.key ? null : stepSheet.key } : l)),
          )
        }
        onRemove={() => {
          if (!stepSheet) return;
          setStepSheet({ ...stepSheet, open: false });
          deleteStep(stepSheet.key, true);
        }}
      />
    </div>
  );
}

/** Erstes Feld mit Fehler, zu dem gescrollt wird (Zutaten/Schritte: der Abschnitt). */
function firstErrorTarget(issues: Record<string, string[]>): string {
  const keys = Object.keys(issues);
  if (keys.some((k) => k === "title")) return "title";
  if (keys.some((k) => ["servings", "prep_minutes", "cook_minutes"].includes(k))) return "sec-basis";
  if (keys.some((k) => k.startsWith("ingredients"))) return "sec-zutaten";
  if (keys.some((k) => k.startsWith("steps"))) return "sec-schritte";
  if (keys.includes("side_dishes")) return "sec-beilagen";
  return keys.includes("source_url") ? "sec-quelle" : "sec-basis";
}
