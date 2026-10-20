"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Carrot, Pencil, Search, SearchX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteIngredientAction } from "@/app/(app)/zutaten/actions";
import { EmptyState } from "@/components/layout/empty-state";
import { PriceForm, type PriceDraft } from "@/components/prices/price-manager";
import { IngredientForm } from "@/components/recipes/editor/ingredient-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { pricePer100, type IngredientWeights } from "@/lib/domain/costs";
import {
  filterMyIngredients,
  ingredientOrigin,
  INGREDIENT_VIEWS,
  type IngredientView,
  type MyIngredient,
} from "@/lib/domain/my-ingredients";
import { formatEuro, formatNumber } from "@/lib/format";
import { DIET_LABELS, FOOD_GROUP_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Tab = "preis" | "angaben" | "rezepte";

const weights = (item: MyIngredient): IngredientWeights => ({
  density_g_per_ml: item.ingredient.density_g_per_ml,
  piece_weight_g: item.ingredient.piece_weight_g,
});

function priceText(item: MyIngredient): string | null {
  const p = item.price;
  if (!p) return null;
  if (p.perGram == null) return formatEuro(p.price);
  return `${formatEuro(pricePer100(p.perGram, p.packageUnit, weights(item)))}/100 ${p.packageUnit === "ml" ? "ml" : "g"}`;
}

function priceDraft(item: MyIngredient): PriceDraft {
  const p = item.price;
  const i = item.ingredient;
  return {
    id: p?.id,
    ingredientId: i.id,
    name: i.name,
    info: weights(item),
    price: p ? String(p.price.toFixed(2)).replace(".", ",") : "",
    amount: p ? String(p.packageAmount).replace(".", ",") : "",
    unit: p?.packageUnit ?? (i.food_group === "egg" ? "piece" : ["spirits", "liqueurs_wine", "syrups_juices"].includes(i.food_group) ? "ml" : "g"),
    store: p?.store ?? "",
  };
}

const recipeWord = (n: number) => (n === 1 ? "1 Rezept" : `${n} Rezepte`);

/** Seite „Zutaten“: Liste mit Suche und Ansichten, Antippen öffnet Preis, Angaben und Rezepte der Zutat. */
export function IngredientManager({ items }: { items: MyIngredient[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<IngredientView>("alle");
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("preis");
  const open = items.find((i) => i.ingredient.id === openId) ?? null;
  const shown = filterMyIngredients(items, { q: query, view });

  function show(item: MyIngredient) {
    setOpenId(item.ingredient.id);
    setTab("preis");
  }

  function done() {
    setOpenId(null);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <EmptyState icon={Carrot} title="Noch keine Zutaten">
        Sobald du Rezepte mit Zutaten anlegst oder eigene Zutaten erstellst, erscheinen sie hier. Dann kannst du Preise
        eintragen und eigene Zutaten korrigieren.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zutaten suchen …"
          aria-label="Zutaten suchen"
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1 sm:grid-cols-4" role="tablist" aria-label="Ansicht">
        {(Object.entries(INGREDIENT_VIEWS) as [IngredientView, string][]).map(([key, label]) => {
          const count = filterMyIngredients(items, { view: key }).length;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium text-muted-foreground transition hover:text-foreground",
                view === key && "bg-card text-foreground shadow-sm",
              )}
            >
              {label}
              <span className="text-xs tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={SearchX} title="Nichts gefunden">
          Keine Zutat passt zu Suche und Ansicht.
        </EmptyState>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {shown.map((item) => {
            const price = priceText(item);
            return (
              <li key={item.ingredient.id}>
                <button
                  type="button"
                  onClick={() => show(item)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="truncate">{item.ingredient.name}</span>
                      {item.isOwn ? <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-label="bearbeitbar" /> : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {FOOD_GROUP_LABELS[item.ingredient.food_group]} · {ingredientOrigin(item)}
                      {item.recipes.length > 0 ? ` · ${recipeWord(item.recipes.length)}` : ""}
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-right text-sm tabular-nums", !price && "text-muted-foreground")}>
                    {price ?? "kein Preis"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open != null} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          {open ? (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{open.ingredient.name}</DialogTitle>
                <DialogDescription>
                  {FOOD_GROUP_LABELS[open.ingredient.food_group]} · {ingredientOrigin(open)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1" role="tablist" aria-label="Bereich">
                {(
                  [
                    ["preis", "Preis"],
                    ["angaben", open.isOwn ? "Bearbeiten" : "Angaben"],
                    ["rezepte", `Rezepte (${open.recipes.length})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={cn(
                      "min-h-11 rounded-xl px-2 text-sm font-medium text-muted-foreground transition hover:text-foreground",
                      tab === key && "bg-card text-foreground shadow-sm",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "preis" ? <PriceForm key={open.ingredient.id} initial={priceDraft(open)} onDone={done} hideHeader /> : null}

              {tab === "angaben" ? (
                open.isOwn ? (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Die Angaben gelten in allen Rezepten mit dieser Zutat. Ändern sich Stückgewicht oder Dichte, rechnet die
                      App die Gramm in diesen Rezepten neu.
                    </p>
                    <IngredientForm
                      key={open.ingredient.id}
                      ingredientId={open.ingredient.id}
                      initial={{
                        name: open.ingredient.name,
                        kcal: open.ingredient.kcal,
                        protein: open.ingredient.protein,
                        carbs: open.ingredient.carbs,
                        fat: open.ingredient.fat,
                        fiber: open.ingredient.fiber,
                        sugar: open.ingredient.sugar,
                        food_group: open.ingredient.food_group,
                        diet: open.ingredient.diet,
                        pieceWeight: open.ingredient.piece_weight_g,
                        density: open.ingredient.density_g_per_ml,
                        abv: open.ingredient.abv,
                      }}
                      onSaved={done}
                      onCancel={() => setOpenId(null)}
                    />
                    <DeleteIngredient key={`del-${open.ingredient.id}`} item={open} onDeleted={done} />
                  </div>
                ) : (
                  <ReadOnlyDetails item={open} />
                )
              ) : null}

              {tab === "rezepte" ? (
                open.recipes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">In keinem deiner Rezepte.</p>
                ) : (
                  <ul className="divide-y rounded-2xl border">
                    {open.recipes.map((r) => (
                      <li key={r.id}>
                        <Link href={`/rezepte/${r.id}`} className="flex min-h-11 items-center justify-between gap-3 px-3 hover:text-primary">
                          <span className="truncate">{r.title}</span>
                          {r.type === "cocktail" ? <span className="text-xs text-muted-foreground">Cocktail</span> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Selbst angelegte Zutat löschen, mit Rückfrage. Steckt sie noch in eigenen Rezepten, geht es erst nach dem
 * Entfernen dort; Rezepte anderer und deren Vorrat/Preise prüft die Datenbank.
 */
function DeleteIngredient({ item, onDeleted }: { item: MyIngredient; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const inRecipes = item.recipes.length;

  function remove() {
    startTransition(async () => {
      const result = await deleteIngredientAction(item.ingredient.id);
      if (result.ok) {
        toast.success(`${item.ingredient.name} gelöscht.`);
        onDeleted();
      } else {
        setError(result.message);
        setConfirm(false);
      }
    });
  }

  return (
    <section className="space-y-2 border-t pt-4" aria-label="Zutat löschen">
      {inRecipes > 0 ? (
        <p className="text-sm text-muted-foreground">
          Löschen geht erst, wenn die Zutat in keinem Rezept mehr steckt (gerade in {recipeWord(inRecipes)}, siehe
          „Rezepte“).
        </p>
      ) : confirm ? (
        <div className="space-y-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm">
            <span className="font-medium">{item.ingredient.name}</span> wirklich löschen? Dein Preis und ein Vorrats-Eintrag
            dazu werden mitgelöscht. Auf Einkaufslisten bleibt der Name stehen.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirm(false)} disabled={pending}>
              Abbrechen
            </Button>
            <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
              <Trash2 aria-hidden />
              {pending ? "Wird gelöscht …" : "Endgültig löschen"}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirm(true)}>
          <Trash2 aria-hidden />
          Zutat löschen
        </Button>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}

/** Grundbestand, Open Food Facts oder Zutaten anderer: nur ansehen. */
function ReadOnlyDetails({ item }: { item: MyIngredient }) {
  const i = item.ingredient;
  const g = (v: number) => `${formatNumber(v, 1)} g`;
  const rows: [string, string][] = [
    ["kcal", formatNumber(i.kcal, 0)],
    ["Protein", g(i.protein)],
    ["Kohlenhydrate", g(i.carbs)],
    ["davon Zucker", g(i.sugar)],
    ["Fett", g(i.fat)],
    ["Ballaststoffe", g(i.fiber)],
    ["Ernährungsform", DIET_LABELS[i.diet]],
    ...(i.piece_weight_g ? ([["Gewicht pro Stück", `${formatNumber(i.piece_weight_g, 0)} g`]] as [string, string][]) : []),
    ...(i.density_g_per_ml ? ([["Dichte", `${formatNumber(i.density_g_per_ml, 3)} g/ml`]] as [string, string][]) : []),
    ...(i.abv != null ? ([["Alkoholgehalt", `${formatNumber(i.abv, 1)} % vol`]] as [string, string][]) : []),
  ];
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <dt className="col-span-2 text-xs text-muted-foreground">Nährwerte pro 100 g</dt>
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        {i.source === "seed"
          ? "Zutaten aus dem Grundbestand sind für alle gleich und lassen sich nicht ändern."
          : i.source === "openfoodfacts"
            ? "Werte aus Open Food Facts lassen sich nicht ändern, weil andere dieselbe Zutat (gleicher Barcode) nutzen."
            : "Diese Zutat hat jemand anderes angelegt; nur diese Person kann sie ändern."}{" "}
        Stimmt etwas nicht, leg im Rezept über „Zutat austauschen“ eine eigene Zutat an.
      </p>
    </div>
  );
}
