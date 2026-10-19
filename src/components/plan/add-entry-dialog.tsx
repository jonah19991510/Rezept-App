"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Check, Heart, Search } from "lucide-react";
import { toast } from "sonner";
import { addPlanEntryAction } from "@/app/(app)/wochenplan/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { MEAL_SLOTS, SLOT_LABELS, type MealSlot } from "@/lib/domain/plan";
import { dayMonth, weekdayLong } from "@/lib/domain/week";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ServingsStepper } from "./servings-stepper";
import type { PlanRecipeOption, SlotTarget } from "./types";

function normalize(s: string) {
  return s.toLocaleLowerCase("de-DE").normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

/** Rezept suchen und in einen Slot einplanen. Tag und Slot sind vorbelegt, aber änderbar. */
export function AddEntryDialog({
  target,
  days,
  recipes,
  onClose,
}: {
  target: SlotTarget | null;
  days: string[];
  recipes: PlanRecipeOption[];
  onClose: () => void;
}) {
  return (
    <Dialog open={target != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="top-4 max-h-[calc(100dvh-2rem)] translate-y-0 overflow-y-auto sm:top-[8dvh] sm:max-w-lg">
        {/* key: Formular bei jedem Öffnen frisch */}
        {target ? <AddEntryForm key={`${target.date}-${target.slot}`} target={target} days={days} recipes={recipes} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AddEntryForm({
  target,
  days,
  recipes,
  onDone,
}: {
  target: SlotTarget;
  days: string[];
  recipes: PlanRecipeOption[];
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [date, setDate] = useState(target.date);
  const [slot, setSlot] = useState<MealSlot>(target.slot);
  const [selected, setSelected] = useState<string | null>(null);
  const [servings, setServings] = useState(1);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return recipes
      .filter((r) => words.every((w) => normalize(r.title).includes(w)))
      .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.title.localeCompare(b.title, "de"));
  }, [query, recipes]);

  function submit() {
    if (!selected) return;
    startTransition(async () => {
      const result = await addPlanEntryAction({ date, slot, recipe_id: selected, servings });
      if (result.ok) {
        toast.success("Eingeplant.");
        onDone();
      } else toast.error(result.message);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Rezept einplanen</DialogTitle>
        <DialogDescription>
          {weekdayLong(date)}, {dayMonth(date)} · {SLOT_LABELS[slot]}
        </DialogDescription>
      </DialogHeader>

      {recipes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Du hast noch keine Rezepte.{" "}
          <Link href="/rezepte/neu" className="font-medium text-primary underline-offset-4 hover:underline">
            Leg dein erstes an
          </Link>
          .
        </p>
      ) : (
        <div className="grid gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rezept suchen …"
              aria-label="Rezept suchen"
              className="pl-9"
            />
          </div>

          <ul className="max-h-72 divide-y overflow-y-auto rounded-2xl border" role="listbox" aria-label="Rezepte">
            {filtered.map((r) => {
              const isSelected = r.id === selected;
              return (
                <li key={r.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.id)}
                    className={cn(
                      "flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                      isSelected && "bg-accent",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {isSelected ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                      {r.isFavorite && !isSelected ? <Heart className="size-4 shrink-0 fill-primary text-primary" aria-label="Favorit" /> : null}
                      <span className="truncate font-medium">{r.title}</span>
                    </span>
                    {r.kcal != null ? (
                      <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {formatNumber(Math.round(r.kcal), 0)} kcal
                        <br />
                        {formatNumber(r.protein ?? 0, 0)} g P
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 ? <li className="px-3 py-4 text-sm text-muted-foreground">Kein Rezept gefunden.</li> : null}
          </ul>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="add-day">Tag</Label>
              <NativeSelect id="add-day" value={date} onChange={(e) => setDate(e.target.value)}>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {weekdayLong(d)}, {dayMonth(d)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-slot">Mahlzeit</Label>
              <NativeSelect id="add-slot" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
                {MEAL_SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {SLOT_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <ServingsStepper value={servings} onChange={setServings} />
            <Button type="button" onClick={submit} disabled={!selected || pending}>
              {pending ? "Wird eingeplant …" : "Einplanen"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
