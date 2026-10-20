"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Link2, Loader2, Pencil, Undo2, X } from "lucide-react";
import { importFromUrlAction } from "@/app/(app)/rezepte/import/actions";
import { IngredientPicker } from "@/components/recipes/editor/ingredient-picker";
import { RecipeEditor } from "@/components/recipes/editor/recipe-editor";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { refineUsLine } from "@/lib/domain/ingredient-line";
import { draftToEditorInitial, initialChoices, type ImportDraft, type LineChoice } from "@/lib/domain/import-draft";
import type { NutritionThresholds } from "@/lib/domain/nutrition";
import { formatQuantity } from "@/lib/format-quantity";
import { cn } from "@/lib/utils";
import { importUrlSchema } from "@/lib/validation/import";

type Step = "url" | "review" | "edit";

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Import per Link: Adresse → Zutaten zuordnen → im Editor prüfen und speichern. */
export function ImportFlow({ thresholds, tagSuggestions }: { thresholds: NutritionThresholds; tagSuggestions: string[] }) {
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [choices, setChoices] = useState<LineChoice[]>([]);
  const [pending, startTransition] = useTransition();

  function load(e: React.FormEvent) {
    e.preventDefault();
    const parsed = importUrlSchema.safeParse({ url });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await importFromUrlAction(parsed.data);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setDraft(result.draft);
      setChoices(initialChoices(result.draft));
      setStep("review");
      window.scrollTo({ top: 0 });
    });
  }

  if (step === "url" || !draft) {
    return (
      <form onSubmit={load} className="grid max-w-xl gap-4 rounded-3xl border bg-card p-4 md:p-5" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="import-url">Adresse der Rezeptseite</Label>
          <div className="relative">
            <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="import-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.chefkoch.de/rezepte/…"
              className="pl-9"
              aria-invalid={Boolean(error)}
              aria-describedby="import-hint"
            />
          </div>
          <p id="import-hint" className="text-sm text-muted-foreground">
            Klappt mit den meisten Rezeptseiten und Food-Blogs. Die App lädt die Seite selbst, von dir wird dabei nichts
            mitgeschickt. Fotos werden nicht übernommen.
          </p>
        </div>
        <FormMessage message={error} />
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowRight aria-hidden />}
            {pending ? "Seite wird gelesen …" : "Rezept laden"}
          </Button>
        </div>
      </form>
    );
  }

  if (step === "review") {
    return (
      <ImportReview
        draft={draft}
        choices={choices}
        onChoicesChange={setChoices}
        origin={`Gefunden auf ${hostOf(draft.sourceUrl)}`}
        backLabel="Andere Adresse"
        onBack={() => setStep("url")}
        onContinue={() => {
          setStep("edit");
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  const { initial, dropped } = draftToEditorInitial(draft, choices);
  return (
    <div className="space-y-5">
      <div className="space-y-2 rounded-2xl border border-sage/40 bg-sage/10 px-4 py-3 text-sm">
        <p>
          Importiert von <strong>{hostOf(draft.sourceUrl)}</strong>. Prüf Titel, Mengen und Schritte und speichere dann. Das
          Rezept ist zunächst privat.
        </p>
        {dropped.length > 0 ? (
          <p className="text-muted-foreground">
            Nicht übernommen: {dropped.join(" · ")}
          </p>
        ) : null}
        <Button type="button" variant="ghost" size="sm" onClick={() => setStep("review")}>
          <ArrowLeft aria-hidden />
          Zurück zur Zuordnung
        </Button>
      </div>
      <RecipeEditor initial={initial} thresholds={thresholds} tagSuggestions={tagSuggestions} />
    </div>
  );
}

/**
 * Bestätigungsansicht: jede Zutatenzeile mit Original, erkannter Menge und zugeordneter Zutat.
 * Auch für den Markdown-Import (dort mit Hinweisen, was unsicher war).
 */
export function ImportReview({
  draft,
  choices,
  onChoicesChange,
  origin,
  notes = [],
  backLabel,
  onBack,
  onContinue,
}: {
  draft: ImportDraft;
  choices: LineChoice[];
  onChoicesChange: (choices: LineChoice[]) => void;
  /** Zeile über dem Titel, z. B. „Gefunden auf chefkoch.de“ */
  origin: string;
  /** Hinweise unter dem Titel, z. B. „Portionen fehlen“ */
  notes?: string[];
  backLabel: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [picking, setPicking] = useState<number | null>(null);

  const summary = useMemo(() => {
    let missing = 0;
    let suggested = 0;
    choices.forEach((c, i) => {
      if (c.skip) return;
      if (!c.ingredient) missing++;
      else if (c.ingredient.id === draft.lines[i].match?.id && !draft.lines[i].exact) suggested++;
    });
    return { missing, suggested, used: choices.filter((c) => !c.skip && c.ingredient).length };
  }, [choices, draft.lines]);

  function update(index: number, patch: Partial<LineChoice>) {
    onChoicesChange(choices.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <p className="text-sm text-muted-foreground">{origin}</p>
        <h2 className="text-2xl font-semibold text-balance">{draft.title}</h2>
        <p className="text-sm text-muted-foreground">
          {draft.lines.length} Zutaten · {draft.steps.length} Schritte
          {draft.servings ? ` · ${draft.servings} Portionen` : ""}
        </p>
        {notes.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5 pt-1">
            {notes.map((note) => (
              <li key={note} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
                <CircleAlert className="size-3.5" aria-hidden />
                {note}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="zuordnung" className="space-y-3">
        <div className="space-y-1">
          <h3 id="zuordnung" className="text-lg font-semibold">
            Zutaten zuordnen
          </h3>
          <p className="text-sm text-muted-foreground">
            Für die Nährwerte braucht jede Zeile eine Zutat aus der Datenbank. Prüf die Vorschläge, wähl fehlende aus
            oder lass Zeilen weg. Mengen kannst du gleich danach im Editor anpassen.
          </p>
        </div>

        {draft.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Die Seite nennt keine Zutaten. Du kannst sie im Editor ergänzen.</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {draft.lines.map((line, i) => {
              const choice = choices[i];
              const changed = choice.ingredient?.id !== line.match?.id;
              const status = choice.skip
                ? "skip"
                : !choice.ingredient
                  ? "missing"
                  : !changed && !line.exact
                    ? "suggested"
                    : "ok";
              const shown = choice.ingredient ? refineUsLine(line, choice.ingredient.density_g_per_ml) : line;
              const quantity = formatQuantity(shown.amount, shown.unit);
              return (
                <li key={i} className={cn("grid gap-2 px-4 py-3", choice.skip && "opacity-60")}>
                  <p className={cn("text-sm text-muted-foreground", choice.skip && "line-through")}>{line.raw}</p>
                  {!choice.skip ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="w-24 shrink-0 font-medium tabular-nums">{quantity || "–"}</span>
                      {choice.ingredient ? (
                        <span className="flex min-w-0 items-center gap-1.5">
                          {status === "suggested" ? (
                            <CircleAlert className="size-4 shrink-0 text-primary" aria-label="Vorschlag, bitte prüfen" />
                          ) : (
                            <Check className="size-4 shrink-0 text-sage" aria-hidden />
                          )}
                          <span className="truncate">{choice.ingredient.name}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-sm text-primary">
                          <CircleAlert className="size-4 shrink-0" aria-hidden />
                          Keine passende Zutat gefunden
                        </span>
                      )}
                      {line.note ? <span className="text-xs text-muted-foreground">{line.note}</span> : null}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {!choice.skip ? (
                      <Button type="button" size="sm" variant={choice.ingredient ? "outline" : "default"} onClick={() => setPicking(i)}>
                        <Pencil aria-hidden />
                        {choice.ingredient ? "Ändern" : "Zutat wählen"}
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="ghost" onClick={() => update(i, { skip: !choice.skip })}>
                      {choice.skip ? <Undo2 aria-hidden /> : <X aria-hidden />}
                      {choice.skip ? "Doch übernehmen" : "Weglassen"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <p className="text-sm" aria-live="polite">
          {summary.used} von {draft.lines.length} Zutaten zugeordnet
          {summary.missing ? ` · ${summary.missing} ohne Zutat (fallen weg)` : ""}
          {summary.suggested ? ` · ${summary.suggested} Vorschläge prüfen` : ""}
        </p>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button type="button" variant="outline" onClick={onBack} aria-label={backLabel}>
            <ArrowLeft aria-hidden />
            <span className="max-sm:hidden">{backLabel}</span>
          </Button>
          <Button type="button" onClick={onContinue} className="flex-1 sm:flex-none">
            Weiter zum Bearbeiten
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>

      {picking != null ? (
        <IngredientPicker
          key={picking}
          open
          initialQuery={draft.lines[picking].name}
          onOpenChange={(open) => !open && setPicking(null)}
          onSelect={(ingredient) => update(picking, { ingredient, skip: false })}
        />
      ) : null}
    </div>
  );
}
