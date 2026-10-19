"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePlanEntryAction, updatePlanEntryAction } from "@/app/(app)/wochenplan/actions";
import { MacroSummary } from "@/components/recipes/macro-summary";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { entryMacros, MEAL_SLOTS, SLOT_LABELS, type MealSlot } from "@/lib/domain/plan";
import { dayMonth, weekdayLong } from "@/lib/domain/week";
import type { PlanEntry } from "@/lib/server/plan";
import { ServingsStepper } from "./servings-stepper";

/** Eintrag ändern: Portionen, Tag, Mahlzeit; oder entfernen. */
export function EntryDialog({ entry, days, onClose }: { entry: PlanEntry | null; days: string[]; onClose: () => void }) {
  return (
    <Dialog open={entry != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {entry ? <EntryForm key={entry.id} entry={entry} days={days} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({ entry, days, onDone }: { entry: PlanEntry; days: string[]; onDone: () => void }) {
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
        toast.success("Aus dem Plan entfernt.");
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
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        {entry.perServing ? (
          <MacroSummary values={macros} caption={`für ${servings === 1 ? "1 Portion" : `${servings.toString().replace(".", ",")} Portionen`}`} compact />
        ) : (
          <p className="text-sm text-muted-foreground">Für dieses Rezept gibt es noch keine Nährwerte.</p>
        )}
        <ServingsStepper value={servings} onChange={setServings} />
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="entry-day">Tag</Label>
            <NativeSelect id="entry-day" value={date} onChange={(e) => setDate(e.target.value)}>
              {days.map((d) => (
                <option key={d} value={d}>
                  {weekdayLong(d)}, {dayMonth(d)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="entry-slot">Mahlzeit</Label>
            <NativeSelect id="entry-slot" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
              {MEAL_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {SLOT_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
              <Trash2 aria-hidden />
              Entfernen
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
    </>
  );
}
