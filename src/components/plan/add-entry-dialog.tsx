"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { BookOpen, Boxes, Check, Compass, Heart, Search } from "lucide-react";
import { toast } from "sonner";
import { addPlanEntryAction } from "@/app/(app)/wochenplan/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { followingDates } from "@/lib/domain/mealprep";
import { MEAL_SLOTS, SLOT_LABELS, type MealSlot } from "@/lib/domain/plan";
import { dayMonth, weekdayLong, weekdayShort } from "@/lib/domain/week";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ServingsStepper } from "./servings-stepper";
import type { PlanRecipeChoices, SlotTarget } from "./types";

type Source = "own" | "community";

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
  recipes: PlanRecipeChoices;
  onClose: () => void;
}) {
  return (
    <Dialog open={target != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="top-4 max-h-[calc(100dvh-2rem)] translate-y-0 overflow-y-auto sm:top-[8dvh] sm:max-w-lg">
        {/* key: Formular bei jedem Öffnen frisch */}
        {target ? (
          <AddEntryForm key={`${target.date}-${target.slot}-${target.recipeId ?? ""}`} target={target} days={days} recipes={recipes} onDone={onClose} />
        ) : null}
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
  recipes: PlanRecipeChoices;
  onDone: () => void;
}) {
  // Ohne eigene Rezepte gleich die öffentlichen zeigen; ein Vorschlag bringt sein Rezept schon mit
  const [source, setSource] = useState<Source>(
    target.recipeId
      ? recipes.community.some((r) => r.id === target.recipeId)
        ? "community"
        : "own"
      : recipes.own.length === 0 && recipes.community.length > 0
        ? "community"
        : "own",
  );
  const [query, setQuery] = useState("");
  const [date, setDate] = useState(target.date);
  const [slot, setSlot] = useState<MealSlot>(target.slot);
  const [selected, setSelected] = useState<string | null>(target.recipeId ?? null);
  const [servings, setServings] = useState(target.servings ?? 1);
  // Meal Prep (Phase 11): weitere Tage mit Resten im selben Slot, insgesamt gekochte Portionen
  const [prep, setPrep] = useState(false);
  const [prepTouched, setPrepTouched] = useState(false);
  const [prepDates, setPrepDates] = useState<string[]>([]);
  const [cooked, setCooked] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const options = recipes[source];
  const filtered = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return options
      .filter((r) => {
        const haystack = normalize(`${r.title} ${r.authorName ?? ""}`);
        return words.every((w) => haystack.includes(w));
      })
      .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.title.localeCompare(b.title, "de"));
  }, [query, options]);

  const nextDays = followingDates(date);
  const chosenPrepDates = prep ? prepDates.filter((d) => nextDays.includes(d)).sort() : [];
  const plannedPortions = servings * (chosenPrepDates.length + 1);
  const cookedPortions = Math.max(cooked ?? plannedPortions, plannedPortions);

  function enablePrep(on: boolean) {
    setPrepTouched(true);
    setPrep(on);
    if (on && prepDates.length === 0) setPrepDates(nextDays.slice(0, 2));
  }

  function selectRecipe(id: string) {
    setSelected(id);
    // Als Meal Prep markierte Rezepte schlagen gleich zwei Reste-Tage vor
    const recipe = options.find((r) => r.id === id);
    if (recipe?.isMealPrep && !prepTouched) {
      setPrep(true);
      if (prepDates.length === 0) setPrepDates(nextDays.slice(0, 2));
    }
  }

  function togglePrepDate(d: string) {
    setPrepDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }


  function switchSource(next: Source) {
    setSource(next);
    setSelected(null);
  }

  function submit() {
    if (!selected) return;
    startTransition(async () => {
      const result = await addPlanEntryAction({
        date,
        slot,
        recipe_id: selected,
        servings,
        ...(chosenPrepDates.length > 0 ? { prepDates: chosenPrepDates, servingsCooked: cookedPortions } : {}),
      });
      if (result.ok) {
        toast.success(result.message ?? "Eingeplant.");
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

      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="group" aria-label="Rezepte aus">
          {(
            [
              { value: "own", label: "Mein Buch", icon: BookOpen, count: recipes.own.length },
              { value: "community", label: "Entdecken", icon: Compass, count: recipes.community.length },
            ] as const
          ).map(({ value, label, icon: Icon, count }) => (
            <button
              key={value}
              type="button"
              aria-pressed={source === value}
              onClick={() => switchSource(value)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                source === value && "bg-card text-foreground shadow-sm",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
              <span className="text-xs tabular-nums">({count})</span>
            </button>
          ))}
        </div>

        {options.length === 0 ? (
          source === "own" ? (
            <p className="text-sm text-muted-foreground">
              Du hast noch keine Rezepte.{" "}
              <Link href="/rezepte/neu" className="font-medium text-primary underline-offset-4 hover:underline">
                Leg dein erstes an
              </Link>{" "}
              oder plane eins aus „Entdecken“ ein.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Noch hat niemand aus der Runde ein Rezept veröffentlicht.
            </p>
          )
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={source === "own" ? "Rezept suchen …" : "Rezept oder Namen suchen …"}
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
                      onClick={() => selectRecipe(r.id)}
                      className={cn(
                        "flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                        isSelected && "bg-accent",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {isSelected ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                        {r.isFavorite && !isSelected ? <Heart className="size-4 shrink-0 fill-primary text-primary" aria-label="Favorit" /> : null}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{r.title}</span>
                          {r.authorName ? <span className="block truncate text-xs text-muted-foreground">von {r.authorName}</span> : null}
                        </span>
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
          </>
        )}

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

        <div className="grid gap-3 rounded-2xl border p-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={prep}
              onChange={(e) => enablePrep(e.target.checked)}
              className="size-5 shrink-0 accent-[var(--primary)]"
            />
            <span className="flex items-center gap-2 text-sm font-medium">
              <Boxes className="size-4 text-sage" aria-hidden />
              Für mehrere Tage kochen (Meal Prep)
            </span>
          </label>
          {prep ? (
            <>
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Reste als {SLOT_LABELS[slot]} an:</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tage mit Resten">
                  {nextDays.map((d) => {
                    const on = chosenPrepDates.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => togglePrepDate(d)}
                        className={cn(
                          "flex min-h-11 min-w-14 flex-col items-center justify-center rounded-xl border px-2 text-xs transition-colors",
                          on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span className="font-medium">{weekdayShort(d)}</span>
                        <span>{dayMonth(d).slice(0, 6)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">Insgesamt kochen</span>
                <ServingsStepper value={cookedPortions} onChange={(v) => setCooked(Math.max(v, plannedPortions))} />
              </div>
              <p className="text-xs text-muted-foreground">
                Eingeplant sind {formatNumber(plannedPortions, 2)} {plannedPortions === 1 ? "Portion" : "Portionen"}. Die
                Einkaufsliste zählt das Meal Prep einmal am Kochtag; was übrig bleibt, schlägt der Plan an den Folgetagen vor.
              </p>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            {prep ? <span className="text-xs text-muted-foreground">Portionen pro Tag</span> : null}
            <ServingsStepper value={servings} onChange={setServings} />
          </div>
          <Button type="button" onClick={submit} disabled={!selected || pending}>
            {pending ? "Wird eingeplant …" : "Einplanen"}
          </Button>
        </div>
      </div>
    </>
  );
}
