"use client";

import { useRef, useState, type ReactNode } from "react";
import { closestCenter, closestCorners, DndContext, useDroppable, type DragEndEvent, type DragOverEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { parseDecimal } from "@/lib/domain/decimal";
import { dropLine, groupLinesByStep, macroEnergyShares, moveItem, stepNumberOf } from "@/lib/domain/recipe-editor";
import type { Macros } from "@/lib/domain/nutrition";
import { formatNumber } from "@/lib/format";
import { UNIT_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { RadioSegments, StepBadge, StepNumber } from "./editor-parts";
import { groupId, lineId, parseDndId, type FieldErrors, type Line, type ResolvedLine, type Step } from "./editor-model";
import { announcements, screenReaderInstructions, SortableRow, useEditorSensors, verticalOnly } from "./sortable";

type View = "list" | "steps";

/** Menge mit Einheit, deutsches Zahlenformat („1.000 g“, „2 EL“); leer ohne Menge. */
export function lineQuantity(line: Pick<Line, "amount" | "unit">): string {
  const amount = parseDecimal(line.amount);
  if (amount == null) return "";
  return line.unit ? `${formatNumber(amount, 2)} ${UNIT_LABELS[line.unit]}` : formatNumber(amount, 2);
}

/** Abschnitt „Zutaten“: Nährwert-Karte, Liste bzw. Gruppen nach Schritt, Drag & Drop am Griff. */
export function IngredientsSection({
  lines,
  steps,
  resolved,
  perServing,
  servings,
  isCocktail,
  summaryExtra,
  notices,
  errors,
  onOpen,
  onAdd,
  onLinesChange,
}: {
  lines: Line[];
  steps: Step[];
  resolved: ResolvedLine[];
  perServing: Macros;
  servings: number;
  isCocktail: boolean;
  /** z. B. Alkoholgehalt (Cocktails) über dem Balken */
  summaryExtra?: ReactNode;
  /** Hinweise unter der Karte (fehlendes Gewicht, fehlender Alkoholgehalt) */
  notices?: ReactNode;
  errors: FieldErrors;
  onOpen: (key: number) => void;
  onAdd: () => void;
  onLinesChange: (update: (prev: Line[]) => Line[]) => void;
}) {
  const [view, setView] = useState<View>("list");
  const sensors = useEditorSensors();
  // „Nach Schritt“ verschiebt schon beim Ziehen zwischen Gruppen; Escape stellt diesen Stand wieder her
  const beforeDrag = useRef<Line[] | null>(null);
  const byKey = new Map(lines.map((l, i) => [l.key, { line: l, index: i }]));
  const nameOf = (id: string | number) => {
    const parsed = parseDndId(id);
    if (!parsed) return String(id);
    if (parsed.kind === "line") return byKey.get(parsed.key)?.line.ingredient.name ?? "Zutat";
    if (parsed.kind === "group") {
      const n = stepNumberOf(parsed.stepKey, steps);
      return n ? `Schritt ${n}` : "Ohne Schritt";
    }
    return "Schritt";
  };
  const accessibility = { announcements: announcements(nameOf), screenReaderInstructions };

  function rowFor(line: Line, showBadge: boolean) {
    const entry = byKey.get(line.key);
    const index = entry?.index ?? 0;
    return (
      <SortableRow key={line.key} id={lineId(line.key)} handleLabel={`${line.ingredient.name} verschieben`}>
        <IngredientRowButton
          line={line}
          resolved={resolved[index]}
          stepNumber={showBadge ? stepNumberOf(line.stepKey, steps) : null}
          error={errors[`ingredients.${index}.amount`]?.[0] ?? errors[`ingredients.${index}.unit`]?.[0] ?? errors[`ingredients.${index}.ingredient_id`]?.[0]}
          onClick={() => onOpen(line.key)}
        />
      </SortableRow>
    );
  }

  function onListDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onLinesChange((prev) => {
      const from = prev.findIndex((l) => lineId(l.key) === active.id);
      const to = prev.findIndex((l) => lineId(l.key) === over.id);
      return moveItem(prev, from, to);
    });
  }

  /** Gruppe (Schritt-Schlüssel) zu einer Drop-ID: Zutat → ihr Schritt, Gruppe → deren Schritt. */
  function groupOf(id: string | number, current: Line[]): number | null | undefined {
    const parsed = parseDndId(id);
    if (!parsed) return undefined;
    if (parsed.kind === "group") return parsed.stepKey;
    if (parsed.kind === "line") {
      const line = current.find((l) => l.key === parsed.key);
      if (!line) return undefined;
      // Zutaten mit verschwundenem Schritt stehen unter „Ohne Schritt“
      return line.stepKey != null && steps.some((s) => s.key === line.stepKey) ? line.stepKey : null;
    }
    return undefined;
  }

  function moveTo(activeId: string | number, overId: string | number, sameGroupOnly: boolean) {
    const active = parseDndId(activeId);
    const over = parseDndId(overId);
    if (active?.kind !== "line" || !over) return;
    onLinesChange((prev) => {
      const from = groupOf(activeId, prev);
      const to = groupOf(overId, prev);
      if (to === undefined) return prev;
      if (sameGroupOnly ? from !== to : from === to) return prev;
      if (over.kind === "line") return over.key === active.key ? prev : dropLine(prev, active.key, { overLineKey: over.key });
      if (over.kind === "group") return dropLine(prev, active.key, { groupStepKey: over.stepKey });
      return prev;
    });
  }

  const groups = groupLinesByStep(lines, steps);

  return (
    <section className="grid grid-cols-1 gap-4" aria-labelledby="sec-zutaten">
      <div className="flex items-center justify-between gap-3">
        <h2 id="sec-zutaten" className="flex items-baseline gap-2 text-[1.75rem] leading-tight font-semibold">
          Zutaten
          <span className="font-sans text-sm font-normal text-muted-foreground tabular-nums">{lines.length}</span>
        </h2>
        {steps.length > 0 && lines.length > 0 ? (
          <RadioSegments
            label="Ansicht der Zutaten"
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: "Liste" },
              { value: "steps", label: "Nach Schritt" },
            ]}
            className="shrink-0"
          />
        ) : null}
      </div>

      <NutritionCard perServing={perServing} servings={servings} isCocktail={isCocktail} extra={summaryExtra} />
      {notices}

      {view === "list" || steps.length === 0 || lines.length === 0 ? (
        <div>
          <div className="rounded-3xl border bg-card">
            {lines.length > 0 ? (
              <DndContext id="dnd-zutaten" sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]} onDragEnd={onListDragEnd} accessibility={accessibility}>
                <SortableContext items={lines.map((l) => lineId(l.key))} strategy={verticalListSortingStrategy}>
                  <ul className="divide-y" aria-label="Zutaten">
                    {lines.map((l) => rowFor(l, true))}
                  </ul>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">Noch keine Zutaten. Füg die erste hinzu, die Nährwerte rechnen sich dann mit.</p>
            )}
            <AddIngredientButton onClick={onAdd} className={lines.length > 0 ? "border-t" : undefined} />
          </div>
          {lines.length > 1 ? (
            <p className="mt-2 px-1 text-center text-xs text-muted-foreground">Antippen zum Bearbeiten · am Griff ziehen zum Sortieren</p>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <DndContext
            id="dnd-zutaten-schritte"
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={() => {
              beforeDrag.current = lines;
            }}
            onDragOver={({ active, over }: DragOverEvent) => over && moveTo(active.id, over.id, false)}
            onDragEnd={({ active, over }: DragEndEvent) => {
              beforeDrag.current = null;
              if (over) moveTo(active.id, over.id, true);
            }}
            onDragCancel={() => {
              const before = beforeDrag.current;
              beforeDrag.current = null;
              if (before) onLinesChange(() => before);
            }}
            accessibility={accessibility}
          >
            {groups.map((g) => {
              const step = g.stepKey != null ? steps.find((s) => s.key === g.stepKey) : null;
              return (
                <StepGroup
                  key={groupId(g.stepKey)}
                  id={groupId(g.stepKey)}
                  number={g.number}
                  title={g.number ? `Schritt ${g.number}` : "Ohne Schritt"}
                  subtitle={step ? step.text.trim() || "Noch ohne Text" : "Zum Servieren oder nicht zugeordnet"}
                  count={g.lines.length}
                >
                  <SortableContext items={g.lines.map((l) => lineId(l.key))} strategy={verticalListSortingStrategy}>
                    <ul className="divide-y" aria-label={g.number ? `Zutaten für Schritt ${g.number}` : "Zutaten ohne Schritt"}>
                      {g.lines.map((l) => rowFor(l, false))}
                    </ul>
                  </SortableContext>
                  {g.lines.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">Keine Zutaten – hierher ziehen</p> : null}
                </StepGroup>
              );
            })}
          </DndContext>
          <div className="rounded-3xl border border-dashed bg-card">
            <AddIngredientButton onClick={onAdd} />
          </div>
        </div>
      )}
    </section>
  );
}

function StepGroup({
  id,
  number,
  title,
  subtitle,
  count,
  children,
}: {
  id: string;
  number: number | null;
  title: string;
  subtitle: string;
  count: number;
  children: ReactNode;
}) {
  // Nur leere Gruppen sind selbst Ablageziel; sonst die Zeilen (sonst fängt die Gruppe die Pfeiltasten ab)
  const { setNodeRef, isOver } = useDroppable({ id, disabled: count > 0 });
  return (
    <div ref={setNodeRef} className={cn("rounded-3xl border bg-card transition", isOver && "ring-2 ring-primary/40")}>
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <StepNumber n={number ?? "–"} muted={number == null} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums" aria-label={`${count} Zutaten`}>
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function IngredientRowButton({
  line,
  resolved,
  stepNumber,
  error,
  onClick,
}: {
  line: Line;
  resolved: ResolvedLine | undefined;
  stepNumber: number | null;
  error?: string;
  onClick: () => void;
}) {
  const grams = resolved?.grams ?? null;
  const kcal = grams != null ? Math.round((grams * line.ingredient.kcal) / 100) : null;
  const quantity = lineQuantity(line);
  const meta = [
    line.note.trim() || null,
    line.optional
      ? "nicht eingerechnet"
      : kcal != null
        ? `${formatNumber(kcal, 0)} kcal`
        : quantity
          ? resolved?.needsManual
            ? "Gewicht fehlt"
            : "Gewicht unbekannt"
          : null,
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 text-left transition hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn("truncate font-medium", line.optional && "text-muted-foreground")}>{line.ingredient.name}</span>
          {line.optional ? (
            <span className="shrink-0 rounded-md border border-dashed px-1.5 text-[0.7rem] text-muted-foreground">optional</span>
          ) : null}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          {stepNumber ? <StepBadge n={stepNumber} /> : null}
          {error ? <span className="truncate text-destructive">{error}</span> : <span className="truncate">{meta.join(" · ")}</span>}
        </span>
      </span>
      <span className={cn("shrink-0 font-semibold tabular-nums", line.optional && "font-medium text-muted-foreground")}>{quantity || "–"}</span>
    </button>
  );
}

function AddIngredientButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-16 w-full items-center gap-3 rounded-b-3xl px-4 py-3 text-left transition hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary" aria-hidden>
        <Plus className="size-4" />
      </span>
      <span>
        <span className="block font-semibold text-primary">Zutat hinzufügen</span>
        <span className="block text-sm text-muted-foreground">Eigene Zutaten oder Open Food Facts</span>
      </span>
    </button>
  );
}

/** kcal pro Portion, Anteile Protein/KH/Fett als Balken, Legende in g pro Portion. */
function NutritionCard({ perServing, servings, isCocktail, extra }: { perServing: Macros; servings: number; isCocktail: boolean; extra?: ReactNode }) {
  const shares = macroEnergyShares(perServing);
  const parts = [
    { key: "protein", label: "Protein", value: perServing.protein, share: shares.protein, color: "bg-macro-protein" },
    { key: "carbs", label: "KH", value: perServing.carbs, share: shares.carbs, color: "bg-macro-carbs" },
    { key: "fat", label: "Fett", value: perServing.fat, share: shares.fat, color: "bg-macro-fat" },
  ];
  const unit = isCocktail ? "Drink" : "Portion";
  const many = isCocktail ? (servings === 1 ? "Drink" : "Drinks") : servings === 1 ? "Portion" : "Portionen";
  return (
    <div className="rounded-3xl border bg-card px-4 py-3.5" aria-live="polite">
      {extra}
      <div className="flex items-baseline justify-between gap-3">
        <p>
          <span className="text-3xl font-semibold tabular-nums">{formatNumber(Math.round(perServing.kcal), 0)}</span>
          <span className="ml-1.5 text-sm text-muted-foreground">kcal pro {unit}</span>
        </p>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {formatNumber(servings, 0)} {many}
        </span>
      </div>
      <div className="mt-3 flex h-2 gap-1" aria-hidden>
        {shares.protein + shares.carbs + shares.fat > 0 ? (
          parts
            .filter((p) => p.share > 0)
            .map((p) => <span key={p.key} className={cn("h-full rounded-full", p.color)} style={{ flexGrow: p.share }} />)
        ) : (
          <span className="h-full flex-1 rounded-full bg-muted" />
        )}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5 tabular-nums">
            <span className={cn("size-2 rounded-full", p.color)} aria-hidden />
            {formatNumber(p.value, 0)} g {p.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

