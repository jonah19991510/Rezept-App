"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Boxes, ExternalLink, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePlanEntryAction, updatePlanEntryAction } from "@/app/(app)/wochenplan/actions";
import { MacroSummary } from "@/components/recipes/macro-summary";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { entryMacros, MEAL_SLOTS, SLOT_LABELS, type MealSlot } from "@/lib/domain/plan";
import { dayMonth, weekdayLong } from "@/lib/domain/week";
import { formatNumber } from "@/lib/format";
import type { PlanBatch, PlanEntry } from "@/lib/server/plan";
import { ServingsStepper } from "./servings-stepper";

/** Eintrag ändern: Portionen, Tag, Mahlzeit (eigene Einträge: Titel, Tag, Mahlzeit); oder entfernen. */
export function EntryDialog({
  entry,
  days,
  batches,
  onClose,
}: {
  entry: PlanEntry | null;
  days: string[];
  batches: PlanBatch[];
  onClose: () => void;
}) {
  return (
    <Dialog open={entry != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {entry == null ? null : entry.recipeId == null ? (
          <FreeEntryForm key={entry.id} entry={entry} days={days} onDone={onClose} />
        ) : (
          <EntryForm key={entry.id} entry={entry} days={days} batch={batches.find((b) => b.id === entry.batchId) ?? null} onDone={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DaySlotFields({
  date,
  slot,
  days,
  onDate,
  onSlot,
}: {
  date: string;
  slot: MealSlot;
  days: string[];
  onDate: (d: string) => void;
  onSlot: (s: MealSlot) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="entry-day">Tag</Label>
        <NativeSelect id="entry-day" value={date} onChange={(e) => onDate(e.target.value)}>
          {days.map((d) => (
            <option key={d} value={d}>
              {weekdayLong(d)}, {dayMonth(d)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="entry-slot">Mahlzeit</Label>
        <NativeSelect id="entry-slot" value={slot} onChange={(e) => onSlot(e.target.value as MealSlot)}>
          {MEAL_SLOTS.map((s) => (
            <option key={s} value={s}>
              {SLOT_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}

/** Eigener Eintrag ohne Rezept (Restaurant …): Titel, Tag, Mahlzeit ändern oder entfernen. */
function FreeEntryForm({ entry, days, onDone }: { entry: PlanEntry; days: string[]; onDone: () => void }) {
  const [title, setTitle] = useState(entry.recipeTitle);
  const [date, setDate] = useState(entry.date);
  const [slot, setSlot] = useState<MealSlot>(entry.slot);
  const [pending, startTransition] = useTransition();
  const changed = title.trim() !== entry.recipeTitle || date !== entry.date || slot !== entry.slot;

  function save() {
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await updatePlanEntryAction({ id: entry.id, servings: entry.servings, date, slot, title: title.trim() });
      if (result.ok) onDone();
      else toast.error(result.message);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deletePlanEntryAction({ id: entry.id });
      if (result.ok) {
        toast.success("Aus dem Plan entfernt.");
        onDone();
      } else toast.error(result.message);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="pr-8">{entry.recipeTitle}</DialogTitle>
        <DialogDescription>
          {weekdayLong(entry.date)}, {dayMonth(entry.date)} · {SLOT_LABELS[entry.slot]} · eigener Eintrag
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="entry-title">Was steht an?</Label>
          <Input id="entry-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} aria-invalid={!title.trim() || undefined} />
        </div>
        <p className="text-sm text-muted-foreground">Ohne Rezept: keine Nährwerte, nicht auf der Einkaufsliste.</p>
        <DaySlotFields date={date} slot={slot} days={days} onDate={setDate} onSlot={setSlot} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
            <Trash2 aria-hidden />
            Entfernen
          </Button>
          <Button type="button" onClick={save} disabled={!changed || !title.trim() || pending}>
            {pending ? "Wird gespeichert …" : "Speichern"}
          </Button>
        </div>
      </div>
    </>
  );
}

function EntryForm({ entry, days, batch, onDone }: { entry: PlanEntry; days: string[]; batch: PlanBatch | null; onDone: () => void }) {
  const [servings, setServings] = useState(entry.servings);
  const [date, setDate] = useState(entry.date);
  const [slot, setSlot] = useState<MealSlot>(entry.slot);
  const [pending, startTransition] = useTransition();
  const changed = servings !== entry.servings || date !== entry.date || slot !== entry.slot;

  function save() {
    startTransition(async () => {
      const result = await updatePlanEntryAction({ id: entry.id, servings, date, slot });
      if (result.ok) onDone();
      else toast.error(result.message);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deletePlanEntryAction({ id: entry.id });
      if (result.ok) {
        toast.success(result.message ?? "Aus dem Plan entfernt.");
        onDone();
      } else toast.error(result.message);
    });
  }

  const macros = entryMacros({ servings, perServing: entry.perServing });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="pr-8">{entry.recipeTitle}</DialogTitle>
        <DialogDescription>
          {weekdayLong(entry.date)}, {dayMonth(entry.date)} · {SLOT_LABELS[entry.slot]}
          {entry.authorName ? ` · von ${entry.authorName}` : ""}
        </DialogDescription>
      </DialogHeader>
      {!entry.available ? (
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Die Person, die dieses Rezept veröffentlicht hatte, hat es wieder privat gemacht. Es zählt nicht mehr in deinen
            Nährwerten und deiner Einkaufsliste. Entferne den Eintrag und plane etwas anderes ein.
          </p>
          <div>
            <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
              <Trash2 aria-hidden />
              Entfernen
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {entry.perServing ? (
            <MacroSummary values={macros} caption={`für ${servings === 1 ? "1 Portion" : `${servings.toString().replace(".", ",")} Portionen`}`} compact />
          ) : (
            <p className="text-sm text-muted-foreground">Für dieses Rezept gibt es noch keine Nährwerte.</p>
          )}
          {entry.batchId ? (
            <p className="flex items-start gap-2 rounded-2xl bg-muted/60 px-3 py-2 text-sm">
              {entry.isLeftover ? (
                <>
                  <Repeat className="mt-0.5 size-4 shrink-0 text-sage" aria-hidden />
                  <span>
                    Reste vom Meal Prep{batch ? ` (gekocht ${weekdayLong(batch.cookDate)}, ${dayMonth(batch.cookDate)})` : ""}. Zählt
                    nicht extra auf der Einkaufsliste.
                  </span>
                </>
              ) : (
                <>
                  <Boxes className="mt-0.5 size-4 shrink-0 text-sage" aria-hidden />
                  <span>
                    Kochtag eines Meal Preps
                    {batch
                      ? `: ${formatNumber(batch.servingsCooked, 2)} Portionen kochen, ${formatNumber(batch.planned, 2)} eingeplant`
                      : ""}
                    . Entfernen nimmt auch alle Reste mit.
                  </span>
                </>
              )}
            </p>
          ) : null}
          <ServingsStepper value={servings} onChange={setServings} />
          <DaySlotFields date={date} slot={slot} days={days} onDate={setDate} onSlot={setSlot} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
                <Trash2 aria-hidden />
                {entry.batchId && !entry.isLeftover ? "Mit Resten entfernen" : "Entfernen"}
              </Button>
              <Link href={`/rezepte/${entry.recipeId}`} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm text-primary underline-offset-4 hover:underline">
                Rezept
                <ExternalLink className="size-3.5" aria-hidden />
              </Link>
            </div>
            <Button type="button" onClick={save} disabled={!changed || pending}>
              {pending ? "Wird gespeichert …" : "Speichern"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
