"use client";

import type { ReactNode } from "react";
import { Check, Link2, Minus, Plus, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatMinutes } from "@/lib/domain/recipe-editor";
import { parseDecimal } from "@/lib/domain/decimal";
import { AUTO_TAG_LABELS, GLASS_LABELS, METHOD_LABELS, type AutoTag } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { choiceChipClass, FieldHeading, radioKeys } from "./editor-parts";
import type { FieldErrors } from "./editor-model";
import { TagInput } from "./tag-input";

export type Basics = {
  title: string;
  description: string;
  servings: number;
  prep: string;
  cook: string;
  category: string;
  tags: string[];
  isMealPrep: boolean;
  sourceUrl: string;
  sideDishes: string[];
  glass: Enums<"glass"> | "";
  method: Enums<"cocktail_method"> | "";
  ice: string;
  garnish: string;
};

const cardClass = "rounded-3xl border bg-card";
const divider = "border-t";

/** Abschnitt „Grunddaten“: Titel/Beschreibung, Eckdaten, Einordnung, Quelle. */
export function BasicsSection({
  basics,
  update,
  isCocktail,
  categoryChoices,
  autoTags,
  tagSuggestions,
  errors,
}: {
  basics: Basics;
  update: (patch: Partial<Basics>) => void;
  isCocktail: boolean;
  categoryChoices: string[];
  autoTags: AutoTag[];
  tagSuggestions: string[];
  errors: FieldErrors;
}) {
  const err = (key: string) => errors[key]?.[0];
  const minutes = (v: string) => {
    const n = parseDecimal(v);
    return n != null && n > 0 ? n : 0;
  };
  const total = formatMinutes(minutes(basics.prep) + (isCocktail ? 0 : minutes(basics.cook)));
  const cookHint = !isCocktail && minutes(basics.cook) >= 60 ? formatMinutes(minutes(basics.cook)) : null;

  return (
    <section className="grid grid-cols-1 gap-6" aria-labelledby="sec-basis">
      <h2 id="sec-basis" className="text-[1.75rem] leading-tight font-semibold">
        Grunddaten
      </h2>

      {/* Titel und Beschreibung */}
      <div className={cardClass}>
        <div className="px-4 pt-3 pb-2">
          <label htmlFor="title" className="text-sm font-medium text-muted-foreground">
            Titel
          </label>
          <input
            id="title"
            value={basics.title}
            onChange={(e) => update({ title: e.target.value })}
            maxLength={200}
            placeholder={isCocktail ? "z. B. Negroni" : "z. B. Bolognese"}
            aria-invalid={Boolean(err("title")) || undefined}
            aria-describedby={err("title") ? "title-error" : undefined}
            className="mt-0.5 block min-h-11 w-full bg-transparent font-heading text-[1.75rem] leading-tight font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
          />
          {err("title") ? (
            <p id="title-error" className="mt-1 text-sm text-destructive">
              {err("title")}
            </p>
          ) : null}
        </div>
        <div className={cn(divider, "px-4 pt-3 pb-3")}>
          <label htmlFor="description" className="text-sm font-medium text-muted-foreground">
            Beschreibung <span className="font-normal">· optional</span>
          </label>
          <textarea
            id="description"
            value={basics.description}
            onChange={(e) => update({ description: e.target.value })}
            maxLength={2000}
            rows={3}
            placeholder="Worum geht’s? z. B. Klassisch, lange geschmort – am besten schon am Vortag kochen."
            className="mt-1 block min-h-20 w-full resize-none bg-transparent text-base outline-none [field-sizing:content] placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      {/* Eckdaten */}
      <div>
        <FieldHeading>Eckdaten</FieldHeading>
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="font-medium" id="servings-label">
              {isCocktail ? "Drinks" : "Portionen"}
            </span>
            <Stepper
              value={basics.servings}
              onChange={(servings) => update({ servings })}
              labelledBy="servings-label"
              word={isCocktail ? "Drinks" : "Portionen"}
            />
          </div>
          {err("servings") ? <p className="px-4 pb-2 text-sm text-destructive">{err("servings")}</p> : null}
          <div className={cn(divider, "grid", isCocktail ? "grid-cols-1" : "grid-cols-2")}>
            <MinutesField
              id="prep"
              label={isCocktail ? "Zubereitung" : "Vorbereitung"}
              value={basics.prep}
              onChange={(prep) => update({ prep })}
              error={err("prep_minutes")}
            />
            {isCocktail ? null : (
              <MinutesField
                id="cook"
                label="Kochen"
                value={basics.cook}
                onChange={(cook) => update({ cook })}
                error={err("cook_minutes")}
                hint={cookHint ? `= ${cookHint}` : undefined}
                className="border-l"
              />
            )}
          </div>
          {isCocktail ? null : (
            <div className={cn(divider, "flex min-h-12 items-center justify-between gap-3 px-4 py-2")}>
              <span className="text-muted-foreground">Gesamtzeit</span>
              <span className="font-semibold tabular-nums">{total ?? "–"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Einordnung */}
      <div>
        <FieldHeading>Einordnung</FieldHeading>
        <div className={cardClass}>
          {isCocktail ? (
            <>
              <ChoiceRow
                label="Glas"
                value={basics.glass || null}
                options={Object.entries(GLASS_LABELS).map(([value, label]) => ({ value: value as Enums<"glass">, label }))}
                onChange={(glass) => update({ glass: glass ?? "" })}
              />
              <ChoiceRow
                label="Methode"
                className={divider}
                value={basics.method || null}
                options={Object.entries(METHOD_LABELS).map(([value, label]) => ({ value: value as Enums<"cocktail_method">, label }))}
                onChange={(method) => update({ method: method ?? "" })}
              />
              <div className={cn(divider, "grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-2")}>
                <TextField id="ice" label="Eis" value={basics.ice} onChange={(ice) => update({ ice })} placeholder="z. B. Würfel, crushed, ohne" maxLength={100} error={err("cocktail.ice")} />
                <TextField id="garnish" label="Garnitur" value={basics.garnish} onChange={(garnish) => update({ garnish })} placeholder="z. B. Limettenrad" maxLength={200} error={err("cocktail.garnish")} />
              </div>
            </>
          ) : (
            <>
              <ChoiceRow
                label="Kategorie"
                value={basics.category || null}
                options={categoryChoices.map((name) => ({ value: name, label: name }))}
                onChange={(category) => update({ category: category ?? "" })}
                footer={
                  <p className="text-sm text-muted-foreground">
                    Eigene Kategorien legst du in den{" "}
                    <a href="/einstellungen#kategorien" className="text-primary underline underline-offset-4">
                      Einstellungen
                    </a>{" "}
                    an.
                  </p>
                }
              />
              <label htmlFor="meal-prep" className={cn(divider, "flex min-h-16 cursor-pointer items-center justify-between gap-3 px-4 py-3")}>
                <span>
                  <span className="block font-medium">Meal-Prep-geeignet</span>
                  <span className="block text-sm text-muted-foreground">Lässt sich gut vorkochen</span>
                </span>
                <Switch id="meal-prep" checked={basics.isMealPrep} onCheckedChange={(v) => update({ isMealPrep: v })} />
              </label>
            </>
          )}
          <div className={cn(divider, "grid grid-cols-1 gap-2 px-4 py-3")}>
            <label htmlFor="tags" className="text-sm font-medium text-muted-foreground">
              Tags
            </label>
            <TagInput
              id="tags"
              value={basics.tags}
              onChange={(tags) => update({ tags })}
              suggestions={tagSuggestions}
              leading={autoTags
                .filter((t) => t !== "meal_prep")
                .map((t) => (
                  <li
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-full border border-sage/30 bg-sage/15 py-1 pr-3 pl-2.5 text-sm font-medium text-sage"
                  >
                    <Sparkles className="size-3.5" aria-hidden />
                    {AUTO_TAG_LABELS[t]}
                    <span className="sr-only">(automatisch)</span>
                  </li>
                ))}
            />
            {err("tags") ? <p className="text-sm text-destructive">{err("tags")}</p> : null}
            {isCocktail ? null : (
              <p className="text-xs text-muted-foreground">Grüne Tags wie „Low Carb“ berechnet die App selbst aus den Nährwerten.</p>
            )}
          </div>
        </div>
      </div>

      {/* Quelle */}
      <div>
        <FieldHeading>Quelle</FieldHeading>
        <div className={cn(cardClass, "px-4 py-3")}>
          <label htmlFor="source_url" className="text-sm font-medium text-muted-foreground">
            Link zum Originalrezept <span className="font-normal">· optional</span>
          </label>
          <div className="relative mt-2">
            <Link2 className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="source_url"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={basics.sourceUrl}
              onChange={(e) => update({ sourceUrl: e.target.value })}
              aria-invalid={Boolean(err("source_url")) || undefined}
              className="h-12 pl-10"
            />
          </div>
          {err("source_url") ? <p className="mt-1 text-sm text-destructive">{err("source_url")}</p> : null}
        </div>
      </div>
    </section>
  );
}

/** −/+ in einer Pille, ganze Zahlen 1–100. */
function Stepper({ value, onChange, labelledBy, word }: { value: number; onChange: (v: number) => void; labelledBy: string; word: string }) {
  const btn =
    "grid size-11 place-items-center rounded-full transition hover:bg-muted disabled:opacity-40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
  return (
    <div className="flex items-center rounded-full border bg-background/40 p-0.5" role="group" aria-labelledby={labelledBy}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label={`Weniger ${word}`}>
        <Minus className="size-4" aria-hidden />
      </button>
      <output className="min-w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(Math.min(100, value + 1))} disabled={value >= 100} aria-label={`Mehr ${word}`}>
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** Große Minutenzahl mit „Min.“ (Vorbereitung, Kochen). */
function MinutesField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("px-4 py-3", className)}>
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <div className="mt-1 flex items-baseline gap-2 rounded-lg focus-within:ring-3 focus-within:ring-ring/50">
        <input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          aria-invalid={Boolean(error) || undefined}
          className="h-11 w-20 min-w-0 bg-transparent text-3xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40"
        />
        <span className="text-muted-foreground">Min.</span>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Einzelauswahl als wischbare Chip-Leiste; erneutes Antippen hebt die Auswahl auf. */
function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
  footer,
  className,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T | null) => void;
  footer?: ReactNode;
  className?: string;
}) {
  const onKeyDown = radioKeys(
    options.map((o) => o.value),
    value,
    onChange,
  );
  const selectedIndex = options.findIndex((o) => o.value === value);
  const labelId = `choice-${label.toLowerCase()}`;
  return (
    <div className={cn("grid grid-cols-1 gap-2 py-3", className)}>
      <p id={labelId} className="px-4 text-sm font-medium text-muted-foreground">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onKeyDown}
        className="flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {options.map((o, i) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (selectedIndex < 0 && i === 0) ? 0 : -1}
              onClick={() => onChange(selected ? null : o.value)}
              className={choiceChipClass(selected)}
            >
              {selected ? <Check aria-hidden /> : null}
              {o.label}
            </button>
          );
        })}
      </div>
      {footer ? <div className="px-4">{footer}</div> : null}
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength: number;
  error?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
        {label} <span className="font-normal">· optional</span>
      </label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} aria-invalid={Boolean(error) || undefined} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
