"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDownAZ, Carrot, LayoutList, Plus, SearchX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { setIngredientDisplayNameAction } from "@/app/(app)/einkauf/pantry-actions";
import { deleteIngredientAction } from "@/app/(app)/zutaten/actions";
import { EmptyState } from "@/components/layout/empty-state";
import { ChipRow, CountChip, GroupHeading, ListCard, SearchField, SegmentToggle, TagLabel } from "@/components/layout/list-blocks";
import { PriceForm, type PriceDraft } from "@/components/prices/price-manager";
import { ChipSelect } from "@/components/recipes/chip-select";
import { IngredientForm } from "@/components/recipes/editor/ingredient-form";
import { FabButton } from "@/components/recipes/new-recipe-fab";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultPriceUnit, pricePer100, type IngredientWeights } from "@/lib/domain/costs";
import { ingredientLabel } from "@/lib/domain/ingredient-name";
import {
  filterMyIngredients,
  FOOD_GROUP_ORDER,
  groupByFoodGroup,
  groupByInitial,
  ingredientOrigin,
  INGREDIENT_VIEWS,
  type IngredientView,
  type MyIngredient,
} from "@/lib/domain/my-ingredients";
import { formatEuro, formatNumber } from "@/lib/format";
import { DIET_LABELS, FOOD_GROUP_LABELS } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type Tab = "preis" | "angaben" | "rezepte";
type Sort = "name" | "kategorie";

const SORT_OPTIONS = [
  { value: "name", label: "A–Z", icon: ArrowDownAZ, showLabel: true },
  { value: "kategorie", label: "Nach Kategorie", icon: LayoutList },
] as const;

const weights = (item: MyIngredient): IngredientWeights => ({
  density_g_per_ml: item.ingredient.density_g_per_ml,
  piece_weight_g: item.ingredient.piece_weight_g,
});

/** Eigener Preis für die Liste: Betrag und Bezug („/ 100 g“, „/ 100 ml“, bei Stück ohne Stückgewicht „/ Stück“). */
function priceParts(item: MyIngredient): { amount: string; per: string } | null {
  const p = item.price;
  if (!p) return null;
  if (p.perGram == null) return { amount: formatEuro(p.packageAmount > 0 ? p.price / p.packageAmount : p.price), per: "/ Stück" };
  return {
    amount: formatEuro(pricePer100(p.perGram, p.packageUnit, weights(item))),
    per: `/ 100 ${p.packageUnit === "ml" ? "ml" : "g"}`,
  };
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
    unit: p?.packageUnit ?? defaultPriceUnit(i.food_group, i.density_g_per_ml),
    store: p?.store ?? "",
  };
}

const recipeWord = (n: number) => (n === 1 ? "1 Rezept" : `${n} Rezepte`);
const recipeCount = (n: number) => (n === 0 ? "in keinem Rezept" : recipeWord(n));

/**
 * Seite „Zutaten“: Suche, Filter-Chips mit Zählern (plus Kategorie), Liste in Abschnitten (A–Z oder nach Kategorie).
 * Der Preis rechts öffnet die Preiseingabe, die übrige Zeile die Zutat (Angaben, Rezepte). Plus-Knopf: eigene Zutat.
 */
export function IngredientManager({
  items,
  displayNames = {},
}: {
  items: MyIngredient[];
  /** Kurznamen von Hand (ingredients.display_name) */
  displayNames?: Record<string, string>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<IngredientView>("alle");
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("preis");
  const [sort, setSort] = useState<Sort>("name");
  const [group, setGroup] = useState<Enums<"food_group"> | "">("");
  const [creating, setCreating] = useState(false);
  const open = items.find((i) => i.ingredient.id === openId) ?? null;
  const shown = filterMyIngredients(items, { q: query, view, group });
  // nur Kategorien, die in den eigenen Zutaten vorkommen
  const groups = FOOD_GROUP_ORDER.filter((g) => items.some((i) => i.ingredient.food_group === g));
  const sections =
    sort === "kategorie"
      ? groupByFoodGroup(shown, (i) => i.ingredient.food_group).map((s) => ({
          key: s.group,
          title: s.label,
          aside: `${s.items.filter((i) => i.price).length} / ${s.items.length} mit Preis`,
          items: s.items,
        }))
      : groupByInitial(shown, (i) => i.ingredient.name).map((s) => ({
          key: s.letter,
          title: s.letter,
          aside: String(s.items.length),
          items: s.items,
        }));

  function show(item: MyIngredient, next: Tab) {
    setOpenId(item.ingredient.id);
    setTab(next);
  }

  function done() {
    setOpenId(null);
    router.refresh();
  }

  return (
    // Unten Platz lassen, damit der schwebende Knopf die letzte Zeile nicht verdeckt
    <div className="pb-16 md:pb-20">
      {items.length === 0 ? (
        <EmptyState icon={Carrot} title="Noch keine Zutaten">
          Sobald du Rezepte mit Zutaten anlegst, erscheinen ihre Zutaten hier. Eigene Zutaten legst du mit dem Plus-Knopf
          an. Dann kannst du Preise eintragen und eigene Zutaten korrigieren.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            <SearchField value={query} onChange={setQuery} placeholder="Zutaten suchen …" label="Zutaten suchen" />
            <ChipRow label="Anzeigen">
              {(Object.entries(INGREDIENT_VIEWS) as [IngredientView, string][]).map(([key, label]) => (
                <CountChip
                  key={key}
                  active={view === key}
                  count={filterMyIngredients(items, { q: query, view: key, group }).length}
                  onClick={() => setView(key)}
                >
                  {label}
                </CountChip>
              ))}
              <ChipSelect
                label="Kategorie"
                value={group}
                display={group ? FOOD_GROUP_LABELS[group] : "Kategorie"}
                onChange={(v) => setGroup(v as Enums<"food_group"> | "")}
              >
                <option value="">Alle Kategorien</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {FOOD_GROUP_LABELS[g]}
                  </option>
                ))}
              </ChipSelect>
            </ChipRow>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm text-muted-foreground" aria-live="polite">
              {shown.length === 1 ? "1 Zutat" : `${shown.length} Zutaten`}
            </p>
            <SegmentToggle label="Sortierung" value={sort} options={SORT_OPTIONS} onChange={setSort} />
          </div>

          {sections.length === 0 ? (
            <EmptyState icon={SearchX} title="Keine Zutat gefunden">
              Keine Zutat passt zu Suche und Filter. Mit dem Plus-Knopf unten rechts legst du eine eigene Zutat an.
            </EmptyState>
          ) : (
            sections.map((section) => (
              <section key={section.key} aria-label={section.title}>
                <GroupHeading aside={section.aside}>{section.title}</GroupHeading>
                <ListCard className="mt-1">
                  {section.items.map((item) => (
                    <IngredientRow
                      key={item.ingredient.id}
                      item={item}
                      showGroup={sort === "name"}
                      onOpen={() => show(item, "angaben")}
                      onPrice={() => show(item, "preis")}
                    />
                  ))}
                </ListCard>
              </section>
            ))
          )}
        </div>
      )}

      <FabButton label="Zutat anlegen" onClick={() => setCreating(true)} />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="pr-8">Eigene Zutat anlegen</DialogTitle>
            <DialogDescription>Nährwerte pro 100 g, z. B. von der Verpackung.</DialogDescription>
          </DialogHeader>
          {creating ? (
            <IngredientForm
              initial={{ name: query.trim() || undefined }}
              submitLabel="Zutat anlegen"
              onSaved={(ingredient) => {
                toast.success(`${ingredient.name} angelegt.`);
                setCreating(false);
                router.refresh();
              }}
              onCancel={() => setCreating(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

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
                <DisplayNameForm key={`kurz-${open.ingredient.id}`} item={open} current={displayNames[open.ingredient.id] ?? ""} onSaved={() => router.refresh()} />
              ) : null}

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
                  <div className="space-y-3">
                    <ReadOnlyDetails item={open} />
                    {open.canDelete ? <DeleteIngredient key={`del-${open.ingredient.id}`} item={open} onDeleted={done} /> : null}
                  </div>
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
 * Kurzname im Vorrat (z. B. „Staudensellerie“ statt „Bio Staudensellerie Klasse II (Edeka)“). Leer = automatisch.
 * Geht auch bei Open-Food-Facts-Zutaten und gilt für alle, die die Zutat nutzen.
 */
function DisplayNameForm({ item, current, onSaved }: { item: MyIngredient; current: string; onSaved: () => void }) {
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const auto = ingredientLabel({ name: item.ingredient.name, source: item.ingredient.source }).short;
  const id = `kurzname-${item.ingredient.id}`;

  function save() {
    setError(undefined);
    startTransition(async () => {
      const result = await setIngredientDisplayNameAction({ ingredientId: item.ingredient.id, displayName: value });
      if (result.ok) {
        toast.success(value.trim() ? `Kurzname „${value.trim()}“ gespeichert.` : "Kurzname wieder automatisch.");
        onSaved();
      } else setError(result.message);
    });
  }

  return (
    <div className="grid gap-1.5 rounded-2xl border p-3">
      <Label htmlFor={id}>Kurzname im Vorrat</Label>
      <div className="flex gap-2">
        <Input id={id} value={value} maxLength={60} placeholder={auto} onChange={(e) => setValue(e.target.value)} className="min-w-0 flex-1" />
        <Button type="button" variant="outline" onClick={save} disabled={pending || value.trim() === current.trim()}>
          Speichern
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Leer lassen für „{auto}“ (automatisch). Gilt für alle, die diese Zutat nutzen.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}


/**
 * Eine Zeile der Zutatenliste: Name (eigene mit Label „Eigene“), darunter Gruppe · Quelle · Rezepte. Rechts der Preis
 * bzw. „+ Preis“; beides öffnet die Preiseingabe, die übrige Zeile die Zutat.
 */
function IngredientRow({
  item,
  showGroup,
  onOpen,
  onPrice,
}: {
  item: MyIngredient;
  /** Zutatengruppe in der zweiten Zeile (nur A–Z; nach Kategorie steht sie in der Überschrift) */
  showGroup: boolean;
  onOpen: () => void;
  onPrice: () => void;
}) {
  const name = item.ingredient.name;
  const price = priceParts(item);
  const sub = [
    showGroup ? FOOD_GROUP_LABELS[item.ingredient.food_group] : null,
    item.isOwn ? null : ingredientOrigin(item),
    recipeCount(item.recipes.length),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex min-h-17 items-center">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-17 min-w-0 flex-1 flex-col justify-center gap-0.5 py-2 pr-2 pl-4 text-left transition hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{name}</span>
          {item.isOwn ? <TagLabel>Eigene</TagLabel> : null}
        </span>
        <span className="truncate text-xs text-muted-foreground">{sub}</span>
      </button>
      <div className="flex shrink-0 items-center pr-2">
        {price ? (
          <button
            type="button"
            onClick={onPrice}
            aria-label={`${name}: ${price.amount} ${price.per.replace("/", "pro")}, Preis bearbeiten`}
            className="flex min-h-11 flex-col items-end justify-center rounded-xl px-2 text-right tabular-nums transition hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="font-semibold">{price.amount}</span>
            <span className="text-xs text-muted-foreground">{price.per}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onPrice}
            aria-label={`${name}: Preis eintragen`}
            className="inline-flex h-11 items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-3.5 text-sm font-medium text-muted-foreground transition hover:border-primary/60 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Plus className="size-4" aria-hidden />
            Preis
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Eigene Zutat löschen (selbst erstellt oder aus Open Food Facts übernommen), mit Rückfrage. Steckt sie noch in eigenen Rezepten, geht es erst nach dem
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
            ? "Werte aus Open Food Facts lassen sich nicht ändern, weil andere dieselbe Zutat (gleicher Barcode) nutzen können."
            : "Diese Zutat hat jemand anderes angelegt; nur diese Person kann sie ändern."}{" "}
        Stimmt etwas nicht, leg im Rezept über „Zutat austauschen“ eine eigene Zutat an.
      </p>
    </div>
  );
}
