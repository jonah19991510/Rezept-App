"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, CircleAlert, CircleCheck, FileText, FileUp, Loader2, SkipForward } from "lucide-react";
import { matchMarkdownIngredientsAction } from "@/app/(app)/rezepte/import/actions";
import { saveRecipesBatchAction } from "@/app/(app)/rezepte/actions";
import { RecipeEditor } from "@/components/recipes/editor/recipe-editor";
import { FormMessage } from "@/components/forms/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { initialChoices, type ImportDraft, type ImportLine, type LineChoice } from "@/lib/domain/import-draft";
import { certainRecipeInput, markdownEditorInitial, reviewReasons, toImportDraft } from "@/lib/domain/markdown-draft";
import { parseMarkdownFiles, preselect, titleKey, type MarkdownImportRecipe } from "@/lib/domain/markdown-import";
import type { NutritionThresholds } from "@/lib/domain/nutrition";
import { CATEGORY_LABELS } from "@/lib/labels";
import { MarkdownFileError, readMarkdownFiles } from "@/lib/markdown-files";
import { cn } from "@/lib/utils";
import { MARKDOWN_MATCH_BATCH } from "@/lib/validation/import";
import { ImportReview } from "./import-flow";

const SAVE_BATCH = 20;

type Prepared = { recipe: MarkdownImportRecipe; draft: ImportDraft; reasons: string[] };

type Phase =
  | { name: "file" }
  | { name: "select"; recipes: MarkdownImportRecipe[]; skippedEmpty: string[]; fileCount: number }
  | { name: "working"; label: string; done: number; total: number }
  | { name: "queue"; queue: Prepared[]; index: number; saved: number; skipped: number; autoSaved: number; failed: number }
  | { name: "done"; saved: number; skipped: number; autoSaved: number; failed: number };

/**
 * Markdown-Import: Datei(en) wählen → erkannte Rezepte auswählen → Zutaten zuordnen →
 * sicher erkannte direkt speichern, die übrigen einzeln prüfen (Bestätigungsansicht wie beim Link-Import).
 */
export function MarkdownImportFlow({
  thresholds,
  tagSuggestions,
  existingTitles,
}: {
  thresholds: NutritionThresholds;
  tagSuggestions: string[];
  existingTitles: string[];
}) {
  const [phase, setPhase] = useState<Phase>({ name: "file" });
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const existing = useMemo(() => new Set(existingTitles.map(titleKey)), [existingTitles]);

  // Solange noch Rezepte zur Prüfung anstehen: beim Verlassen der Seite nachfragen
  const busy = phase.name === "queue" || phase.name === "working";
  useEffect(() => {
    if (!busy) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [busy]);

  function readFiles(files: File[]) {
    setError(undefined);
    startTransition(async () => {
      try {
        const texts = await readMarkdownFiles(files);
        if (texts.length === 0) {
          setError("In der Auswahl war keine Markdown-Datei (.md).");
          return;
        }
        const { recipes, skippedEmpty } = parseMarkdownFiles(texts);
        if (recipes.length === 0) {
          setError("In der Datei wurde kein Rezept erkannt. Jedes Rezept braucht eine Überschrift (# Titel).");
          return;
        }
        setPhase({ name: "select", recipes, skippedEmpty, fileCount: texts.length });
      } catch (e) {
        setError(e instanceof MarkdownFileError ? e.message : "Die Datei konnte nicht gelesen werden.");
      }
    });
  }

  async function importSelected(recipes: MarkdownImportRecipe[]) {
    setError(undefined);
    // 1. Zutaten in Paketen zuordnen
    const prepared: Prepared[] = [];
    for (let i = 0; i < recipes.length; i += MARKDOWN_MATCH_BATCH) {
      setPhase({ name: "working", label: "Zutaten werden zugeordnet", done: i, total: recipes.length });
      const batch = recipes.slice(i, i + MARKDOWN_MATCH_BATCH);
      const result = await matchMarkdownIngredientsAction({
        recipes: batch.map((r) => ({ ingredients: r.ingredients })),
      }).catch(() => null);
      if (!result?.ok) {
        setError(result?.message ?? "Die Zutaten konnten nicht zugeordnet werden. Bitte versuch es noch einmal.");
        setPhase({ name: "file" });
        return;
      }
      batch.forEach((recipe, j) => {
        const lines: ImportLine[] = result.lines[j] ?? [];
        prepared.push({ recipe, draft: toImportDraft(recipe, lines), reasons: reviewReasons(recipe, lines) });
      });
    }

    // 2. Sicher erkannte direkt speichern
    const certain = prepared.filter((p) => p.reasons.length === 0);
    let autoSaved = 0;
    let failedCount = 0;
    for (let i = 0; i < certain.length; i += SAVE_BATCH) {
      setPhase({ name: "working", label: "Sicher erkannte Rezepte werden gespeichert", done: i, total: certain.length });
      const batch = certain.slice(i, i + SAVE_BATCH);
      const result = await saveRecipesBatchAction(batch.map((p) => certainRecipeInput(p.recipe, p.draft.lines))).catch(() => null);
      if (result?.ok) {
        autoSaved += result.saved;
        failedCount += result.failed;
      } else failedCount += batch.length;
    }

    // 3. Der Rest: einzeln prüfen
    const queue = prepared.filter((p) => p.reasons.length > 0);
    if (queue.length === 0) setPhase({ name: "done", saved: 0, skipped: 0, autoSaved, failed: failedCount });
    else setPhase({ name: "queue", queue, index: 0, saved: 0, skipped: 0, autoSaved, failed: failedCount });
    window.scrollTo({ top: 0 });
  }

  if (phase.name === "file") {
    return <FilePicker pending={pending} error={error} onFiles={readFiles} />;
  }

  if (phase.name === "select") {
    return (
      <RecipeSelection
        recipes={phase.recipes}
        skippedEmpty={phase.skippedEmpty}
        fileCount={phase.fileCount}
        existing={existing}
        error={error}
        onBack={() => setPhase({ name: "file" })}
        onImport={(selected) => void importSelected(selected)}
      />
    );
  }

  if (phase.name === "working") {
    return (
      <div className="flex items-center gap-3 rounded-3xl border bg-card p-5" role="status" aria-live="polite">
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
        <p>
          {phase.label} … <span className="tabular-nums text-muted-foreground">{phase.done} von {phase.total}</span>
        </p>
      </div>
    );
  }

  if (phase.name === "done") {
    return <DoneSummary {...phase} onRestart={() => setPhase({ name: "file" })} />;
  }

  const current = phase.queue[phase.index];
  const advance = (patch: { saved?: number; skipped?: number }) => {
    const saved = phase.saved + (patch.saved ?? 0);
    const skipped = phase.skipped + (patch.skipped ?? 0);
    if (phase.index + 1 >= phase.queue.length) {
      setPhase({ name: "done", saved, skipped, autoSaved: phase.autoSaved, failed: phase.failed });
    }
    else setPhase({ ...phase, index: phase.index + 1, saved, skipped });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="space-y-5">
      <QueueStatus
        index={phase.index}
        total={phase.queue.length}
        autoSaved={phase.autoSaved}
        saved={phase.saved}
        skipped={phase.skipped}
      />
      <QueueItem
        key={current.recipe.key}
        item={current}
        thresholds={thresholds}
        tagSuggestions={tagSuggestions}
        onSaved={() => advance({ saved: 1 })}
        onSkip={() => advance({ skipped: 1 })}
      />
    </div>
  );
}

function FilePicker({ pending, error, onFiles }: { pending: boolean; error?: string; onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [showNotion, setShowNotion] = useState(false);
  return (
    <div className="grid max-w-xl gap-4 rounded-3xl border bg-card p-4 md:p-5">
      <div className="space-y-2 text-sm">
        <p>
          Wähl eine Markdown-Datei (<code>.md</code>) mit einem oder mehreren Rezepten, mehrere Dateien auf einmal oder ein
          ZIP-Archiv. Jede Überschrift wird ein Rezept, „Zutaten“ und „Zubereitung“ darunter werden erkannt.
        </p>
        <div className="rounded-xl bg-muted/50 px-3 py-1">
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-2 text-left font-medium"
            aria-expanded={showNotion}
            aria-controls="notion-hilfe"
            onClick={() => setShowNotion((v) => !v)}
          >
            <ChevronRight className={cn("size-4 transition-transform", showNotion && "rotate-90")} aria-hidden />
            Aus Notion exportieren
          </button>
          <ol id="notion-hilfe" hidden={!showNotion} className="mb-2 list-decimal space-y-1 pl-6 text-muted-foreground">
            <li>Die Seite mit der Rezept-Datenbank öffnen, oben rechts „•••“ → „Exportieren“.</li>
            <li>Format „Markdown &amp; CSV“, „Unterseiten einschließen“ und „Ordner für Unterseiten erstellen“ einschalten.</li>
            <li>Die heruntergeladene ZIP-Datei hier auswählen (nicht entpacken).</li>
          </ol>
        </div>
        <p className="text-muted-foreground">
          Die Datei wird nur in deinem Browser gelesen. Bilder werden nicht übernommen. Nichts wird gespeichert, bevor du
          auswählst.
        </p>
      </div>
      <FormMessage message={error} />
      <div>
        <Button type="button" onClick={() => input.current?.click()} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <FileUp aria-hidden />}
          {pending ? "Wird gelesen …" : "Datei auswählen"}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          accept=".md,.markdown,.txt,.zip,text/markdown,text/plain,application/zip"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length > 0) onFiles(files);
          }}
        />
      </div>
    </div>
  );
}

function RecipeSelection({
  recipes,
  skippedEmpty,
  fileCount,
  existing,
  error,
  onBack,
  onImport,
}: {
  recipes: MarkdownImportRecipe[];
  skippedEmpty: string[];
  fileCount: number;
  existing: Set<string>;
  error?: string;
  onBack: () => void;
  onImport: (recipes: MarkdownImportRecipe[]) => void;
}) {
  const [selected, setSelected] = useState(() => new Set(recipes.filter((r) => preselect(r, existing)).map((r) => r.key)));
  const toggle = (key: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const count = selected.size;

  return (
    <div className="space-y-5">
      <section className="space-y-1">
        <h2 className="text-2xl font-semibold">
          {recipes.length} {recipes.length === 1 ? "Rezept" : "Rezepte"} erkannt
        </h2>
        <p className="text-sm text-muted-foreground">
          Aus {fileCount} {fileCount === 1 ? "Datei" : "Dateien"}
          {skippedEmpty.length > 0
            ? ` · ${skippedEmpty.length} ${skippedEmpty.length === 1 ? "leere Seite" : "leere Seiten"} übersprungen`
            : ""}
          . Wähl aus, was ins Buch
          soll. Doppelte und Seiten ohne Titel sind abgewählt.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setSelected(new Set(recipes.map((r) => r.key)))}>
            Alle auswählen
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setSelected(new Set())}>
            Keine
          </Button>
        </div>
      </section>

      <ul className="divide-y rounded-2xl border bg-card">
        {recipes.map((r) => {
          const duplicate = existing.has(titleKey(r.title));
          const checked = selected.has(r.key);
          const facts = [
            r.ingredients.length === 1 ? "1 Zutat" : `${r.ingredients.length} Zutaten`,
            r.steps.length === 1 ? "1 Schritt" : `${r.steps.length} Schritte`,
            r.servings ? `${r.servings} Portionen` : null,
            r.category ? CATEGORY_LABELS[r.category] : null,
            ...r.tags,
          ].filter(Boolean);
          return (
            <li key={r.key}>
              <label className={cn("flex cursor-pointer gap-3 px-4 py-3", !checked && "opacity-70")}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(r.key)}
                  className="mt-1 size-5 shrink-0 accent-primary"
                />
                <span className="min-w-0 space-y-1">
                  <span className="block font-medium">{r.title}</span>
                  <span className="block text-sm text-muted-foreground">{facts.join(" · ")}</span>
                  {r.reference ? <span className="block text-xs text-muted-foreground">Laut Datei: {r.reference}</span> : null}
                  {duplicate || r.warnings.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5 pt-0.5">
                      {duplicate ? <WarningBadge>Gibt es schon im Buch</WarningBadge> : null}
                      {r.warnings.map((w) => (
                        <WarningBadge key={w}>{w}</WarningBadge>
                      ))}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <FormMessage message={error} />

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <p className="text-sm" aria-live="polite">
          {count} von {recipes.length} ausgewählt
        </p>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button type="button" variant="outline" onClick={onBack} aria-label="Andere Datei">
            <ArrowLeft aria-hidden />
            <span className="max-sm:hidden">Andere Datei</span>
          </Button>
          <Button
            type="button"
            className="flex-1 sm:flex-none"
            disabled={count === 0}
            onClick={() => onImport(recipes.filter((r) => selected.has(r.key)))}
          >
            {count === 1 ? "1 Rezept übernehmen" : `${count} Rezepte übernehmen`}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

function WarningBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
      <CircleAlert className="size-3" aria-hidden />
      {children}
    </span>
  );
}

function QueueStatus({
  index,
  total,
  autoSaved,
  saved,
  skipped,
}: {
  index: number;
  total: number;
  autoSaved: number;
  saved: number;
  skipped: number;
}) {
  return (
    <div className="space-y-1 rounded-2xl border border-sage/40 bg-sage/10 px-4 py-3 text-sm">
      <p className="font-medium">
        Rezept {index + 1} von {total} prüfen
      </p>
      <p className="text-muted-foreground">
        {autoSaved > 0 ? `${autoSaved} sicher erkannte direkt gespeichert · ` : ""}
        {saved} geprüft und gespeichert{skipped > 0 ? ` · ${skipped} übersprungen` : ""}. Alle Rezepte sind zunächst privat.
      </p>
    </div>
  );
}

/** Ein Rezept aus der Warteschlange: erst Zutaten zuordnen, dann im Editor prüfen und speichern. */
function QueueItem({
  item,
  thresholds,
  tagSuggestions,
  onSaved,
  onSkip,
}: {
  item: Prepared;
  thresholds: NutritionThresholds;
  tagSuggestions: string[];
  onSaved: () => void;
  onSkip: () => void;
}) {
  const [step, setStep] = useState<"review" | "edit">("review");
  const [choices, setChoices] = useState<LineChoice[]>(() => initialChoices(item.draft));
  const origin = `Aus ${item.recipe.fileName.split("/").pop()}`;

  if (step === "review") {
    return (
      <div className="space-y-3">
        <ImportReview
          draft={item.draft}
          choices={choices}
          onChoicesChange={setChoices}
          origin={origin}
          notes={item.reasons}
          backLabel="Überspringen"
          onBack={onSkip}
          onContinue={() => {
            setStep("edit");
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
    );
  }

  const { initial, dropped } = markdownEditorInitial(item.recipe, item.draft, choices);
  return (
    <div className="space-y-5">
      <div className="space-y-2 rounded-2xl border bg-card px-4 py-3 text-sm">
        <p>
          Prüf Titel, Portionen, Mengen und Schritte und speichere dann. Danach geht es mit dem nächsten Rezept weiter.
        </p>
        {item.recipe.reference ? <p className="text-muted-foreground">Laut Datei: {item.recipe.reference}</p> : null}
        {dropped.length > 0 ? <p className="text-muted-foreground">Nicht übernommen: {dropped.join(" · ")}</p> : null}
        <Button type="button" variant="ghost" size="sm" onClick={() => setStep("review")}>
          <ArrowLeft aria-hidden />
          Zurück zur Zuordnung
        </Button>
      </div>
      <RecipeEditor
        initial={initial}
        thresholds={thresholds}
        tagSuggestions={tagSuggestions}
        onSaved={onSaved}
        cancel={{ label: "Überspringen", onClick: onSkip }}
      />
    </div>
  );
}

function DoneSummary({
  saved,
  skipped,
  autoSaved,
  failed,
  onRestart,
}: {
  saved: number;
  skipped: number;
  autoSaved: number;
  failed: number;
  onRestart: () => void;
}) {
  const total = saved + autoSaved;
  return (
    <div className="space-y-4 rounded-3xl border bg-card p-5">
      <p className="flex items-center gap-2 text-lg font-semibold">
        <CircleCheck className="size-5 text-sage" aria-hidden />
        {total === 1 ? "1 Rezept importiert" : `${total} Rezepte importiert`}
      </p>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {autoSaved > 0 ? <li>{autoSaved} sicher erkannt und direkt gespeichert</li> : null}
        {saved > 0 ? <li>{saved} geprüft und gespeichert</li> : null}
        {skipped > 0 ? <li>{skipped} übersprungen</li> : null}
        {failed > 0 ? <li className="text-destructive">{failed} konnten nicht gespeichert werden</li> : null}
        <li>Alle importierten Rezepte sind privat. Fotos aus der Datei sind nicht dabei.</li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <Link href="/rezepte" className={buttonVariants()}>
          <FileText aria-hidden />
          Zu den Rezepten
        </Link>
        <Button type="button" variant="outline" onClick={onRestart}>
          <SkipForward aria-hidden />
          Weitere Datei importieren
        </Button>
      </div>
    </div>
  );
}
