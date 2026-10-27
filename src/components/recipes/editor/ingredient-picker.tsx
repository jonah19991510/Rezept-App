"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Globe, Loader2, Plus, Search } from "lucide-react";
import {
  searchIngredientsAction,
  searchOpenFoodFactsAction,
} from "@/app/(app)/rezepte/ingredient-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { IngredientOption } from "@/lib/domain/ingredient-option";
import { candidateDisplayName, type IngredientCandidate } from "@/lib/domain/openfoodfacts";
import { formatNumber } from "@/lib/format";
import { FOOD_GROUP_LABELS } from "@/lib/labels";
import { IngredientForm, type IngredientFormInitial } from "./ingredient-form";

type Mode = { kind: "search" } | { kind: "form"; initial: IngredientFormInitial };

/**
 * Zutat auswählen: zuerst die eigene Zutatentabelle (sofort beim Tippen),
 * auf Knopfdruck Open Food Facts, sonst selbst anlegen.
 */
export function IngredientPicker({
  open,
  onOpenChange,
  onSelect,
  initialQuery,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (ingredient: IngredientOption) => void;
  /** Suchbegriff beim ersten Öffnen (z. B. der Name aus einer importierten Zutatenzeile) */
  initialQuery?: string;
}) {
  const [mode, setMode] = useState<Mode>({ kind: "search" });
  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<IngredientOption[]>([]);
  const [searched, setSearched] = useState(false);
  const [offResults, setOffResults] = useState<IngredientCandidate[] | null>(null);
  const [offMessage, setOffMessage] = useState<string>();
  const [localPending, startLocal] = useTransition();
  const [offPending, startOff] = useTransition();
  const latestQuery = useRef("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  // Mit Suchbegriff geöffnet: gleich suchen (nur beim ersten Anzeigen)
  useEffect(() => {
    const q = initialQuery?.trim();
    if (!q) return;
    latestQuery.current = q;
    startLocal(async () => {
      const found = await searchIngredientsAction(q);
      if (latestQuery.current === q) {
        setResults(found);
        setSearched(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- absichtlich nur einmal
  }, []);

  function reset() {
    setMode({ kind: "search" });
    setQuery("");
    setResults([]);
    setSearched(false);
    setOffResults(null);
    setOffMessage(undefined);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setOffResults(null);
    setOffMessage(undefined);
    latestQuery.current = value;
    if (debounce.current) clearTimeout(debounce.current);
    if (!value.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounce.current = setTimeout(() => {
      startLocal(async () => {
        const found = await searchIngredientsAction(value);
        // Antworten auf ältere Eingaben ignorieren
        if (latestQuery.current === value) {
          setResults(found);
          setSearched(true);
        }
      });
    }, 250);
  }

  function searchOnline() {
    const q = query.trim();
    if (!q) return;
    startOff(async () => {
      const result = await searchOpenFoodFactsAction(q);
      if (result.ok) {
        setOffResults(result.candidates);
        setOffMessage(result.candidates.length === 0 ? "Bei Open Food Facts gibt es dazu nichts Passendes." : undefined);
      } else {
        setOffResults([]);
        setOffMessage(result.message);
      }
    });
  }

  function choose(ingredient: IngredientOption) {
    onSelect(ingredient);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="top-4 max-h-[calc(100dvh-2rem)] translate-y-0 overflow-y-auto sm:top-[8dvh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode.kind === "form" ? "Neue Zutat" : "Zutat hinzufügen"}</DialogTitle>
          <DialogDescription>
            {mode.kind === "form"
              ? "Prüf die Werte kurz. Sie gelten pro 100 g und stehen danach allen zur Verfügung."
              : "Tippe den Namen ein, z. B. „Haferflocken“."}
          </DialogDescription>
        </DialogHeader>

        {mode.kind === "form" ? (
          <IngredientForm initial={mode.initial} onSaved={choose} onCancel={() => setMode({ kind: "search" })} />
        ) : (
          // grid-cols-1 (minmax(0, 1fr)): lange Produktnamen kürzen statt die Liste über den Rand zu schieben
          <div className="grid grid-cols-1 gap-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Zutat suchen …"
                aria-label="Zutat suchen"
                className="pl-9"
              />
              {localPending ? (
                <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Suche läuft" />
              ) : null}
            </div>

            {results.length > 0 ? (
              <ul className="divide-y rounded-2xl border" aria-label="Treffer in deinen Zutaten">
                {results.map((ingredient) => (
                  <li key={ingredient.id}>
                    <button
                      type="button"
                      onClick={() => choose(ingredient)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{ingredient.name}</span>
                        <span className="text-xs text-muted-foreground">{FOOD_GROUP_LABELS[ingredient.food_group]}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {formatNumber(ingredient.kcal, 0)} kcal
                        <br />
                        {formatNumber(ingredient.protein)} g P
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : searched && !localPending ? (
              <p className="text-sm text-muted-foreground">In deinen Zutaten gibt es dazu noch nichts.</p>
            ) : null}

            {query.trim() ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={searchOnline} disabled={offPending}>
                  {offPending ? <Loader2 className="animate-spin" aria-hidden /> : <Globe aria-hidden />}
                  Bei Open Food Facts suchen
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode({ kind: "form", initial: { name: query.trim() } })}
                >
                  <Plus aria-hidden />
                  Selbst anlegen
                </Button>
              </div>
            ) : null}

            {offMessage ? <p className="text-sm text-muted-foreground">{offMessage}</p> : null}

            {offResults && offResults.length > 0 ? (
              <section className="grid grid-cols-1 gap-2">
                <h3 className="text-sm font-medium">Open Food Facts</h3>
                <ul className="divide-y rounded-2xl border">
                  {offResults.map((c) => (
                    <li key={c.externalId}>
                      <button
                        type="button"
                        onClick={() =>
                          setMode({
                            kind: "form",
                            initial: {
                              name: candidateDisplayName(c),
                              kcal: c.kcal,
                              protein: c.protein,
                              carbs: c.carbs,
                              fat: c.fat,
                              fiber: c.fiber,
                              sugar: c.sugar,
                              food_group: c.food_group,
                              diet: c.diet,
                              externalId: c.externalId,
                              sourceLabel: `Aus Open Food Facts (Barcode ${c.externalId}). Die Werte sind von Nutzern eingetragen und können fehlerhaft sein.`,
                            },
                          })
                        }
                        className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c.brand ?? "ohne Marke"}</span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                          {formatNumber(c.kcal, 0)} kcal
                          <br />
                          {formatNumber(c.protein)} g P
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Daten von Open Food Facts, lizenziert unter der Open Database License (ODbL).
                </p>
              </section>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
