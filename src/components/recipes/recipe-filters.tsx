"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Clock, Heart, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { AUTO_TAG_LABELS, CATEGORY_LABELS, METHOD_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { chipClass, ChipSelect } from "./chip-select";

/** Filter hinter dem Regler-Knopf neben der Suche */
const MORE_KEYS = ["protein", "zeit", "kosten", "bewertung"];

/** Suchparameter in der URL ändern (gemeinsam für Filter und Sortierung). */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return { params, update, pending };
}

/**
 * Suche, Filter-Chips (seitlich wischbar) und weitere Filter hinter dem Regler. Alles steht in der URL, damit
 * Zurück-Knopf und Teilen funktionieren. Sortierung und Ansicht sitzen über der Liste (RecipeList).
 */
export function RecipeFilters({
  ownTags,
  tagGroupLabel = "Eigene Tags",
  searchPlaceholder = "Rezepte durchsuchen …",
  ownBook = false,
  mode = "kitchen",
  baseSpirits = [],
}: {
  ownTags: string[];
  tagGroupLabel?: string;
  searchPlaceholder?: string;
  /** Phase 12: im eigenen Buch zusätzlich Kosten, Bewertung und „lange nicht gekocht“ */
  ownBook?: boolean;
  /** Phase 15: Bar mit Basisspirituose und Methode statt Kategorie, Protein und Zeit */
  mode?: "kitchen" | "bar";
  baseSpirits?: string[];
}) {
  const bar = mode === "bar";
  const router = useRouter();
  const pathname = usePathname();
  const { params, update, pending } = useUrlParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [showMore, setShowMore] = useState(MORE_KEYS.some((k) => params.get(k)));
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  function onQueryChange(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => update({ q: value.trim() || null }), 300);
  }

  const favorites = params.get("favoriten") === "1";
  const longAgo = params.get("lange") === "1";
  const hasFilters = ["q", "kategorie", "basis", "tag", "favoriten", "methode", "lange", ...MORE_KEYS].some((k) => params.get(k));
  const moreActive = MORE_KEYS.filter((k) => params.get(k)).length;
  const hasMorePanel = !bar || ownBook;

  const category = params.get("kategorie") ?? "";
  const base = params.get("basis") ?? "";
  const method = params.get("methode") ?? "";
  const tag = params.get("tag") ?? "";
  const tagLabel = tag ? (AUTO_TAG_LABELS[tag as keyof typeof AUTO_TAG_LABELS] ?? tag) : "Tag";

  function reset() {
    setQuery("");
    const sort = params.get("sortierung");
    startTransition(() => router.replace(sort ? `${pathname}?sortierung=${sort}` : pathname, { scroll: false }));
  }

  return (
    <div className={cn("mb-4 space-y-3", pending && "opacity-80")} role="search">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={bar ? "Cocktails durchsuchen" : "Rezepte durchsuchen"}
            className="h-12 rounded-full pl-10"
          />
        </div>
        {hasMorePanel ? (
          <button
            type="button"
            aria-expanded={showMore}
            aria-label={moreActive ? `Weitere Filter (${moreActive} aktiv)` : "Weitere Filter"}
            onClick={() => setShowMore((v) => !v)}
            className={cn(chipClass(showMore || moreActive > 0), "size-12 justify-center px-0 [&_svg]:size-5")}
          >
            <SlidersHorizontal aria-hidden />
            {moreActive ? (
              <span className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-primary text-[0.65rem] font-semibold text-primary-foreground">
                {moreActive}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      {/* Am Handy seitlich wischbar (innerhalb der Seitenränder, bündig mit der Suche), ab Tablet umbrechend */}
      <div
        className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden"
        aria-label="Filter"
        role="group"
      >
        <button type="button" aria-pressed={favorites} onClick={() => update({ favoriten: favorites ? null : "1" })} className={chipClass(favorites)}>
          <Heart className={cn(favorites && "fill-current")} aria-hidden />
          Favoriten
        </button>

        {bar ? (
          <>
            <ChipSelect label="Basisspirituose" value={base} display={base || "Spirituose"} onChange={(v) => update({ basis: v })}>
              <option value="">Alle Spirituosen</option>
              {baseSpirits.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </ChipSelect>
            <ChipSelect
              label="Methode"
              value={method}
              display={method ? (METHOD_LABELS[method as keyof typeof METHOD_LABELS] ?? "Methode") : "Methode"}
              onChange={(v) => update({ methode: v })}
            >
              <option value="">Alle Methoden</option>
              {Object.entries(METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </ChipSelect>
          </>
        ) : (
          <ChipSelect
            label="Kategorie"
            value={category}
            display={category ? (CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? "Kategorie") : "Kategorie"}
            onChange={(v) => update({ kategorie: v })}
          >
            <option value="">Alle Kategorien</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </ChipSelect>
        )}

        {!bar || ownTags.length > 0 ? (
          <ChipSelect label="Tag" value={tag} display={tagLabel} onChange={(v) => update({ tag: v })}>
            <option value="">Alle Tags</option>
            {bar ? null : (
              <optgroup label="Automatisch">
                {Object.entries(AUTO_TAG_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </optgroup>
            )}
            {ownTags.length > 0 ? (
              <optgroup label={tagGroupLabel}>
                {ownTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </ChipSelect>
        ) : null}

        {ownBook && !bar ? (
          <button type="button" aria-pressed={longAgo} onClick={() => update({ lange: longAgo ? null : "1" })} className={chipClass(longAgo)}>
            <Clock aria-hidden />
            Lange nicht gekocht
          </button>
        ) : null}

        {hasFilters ? (
          <button type="button" onClick={reset} className={cn(chipClass(false), "border-dashed text-muted-foreground")}>
            <X aria-hidden />
            Zurücksetzen
          </button>
        ) : null}
      </div>

      {showMore && hasMorePanel ? (
        <div className="grid grid-cols-2 gap-3 rounded-3xl border bg-card p-4 sm:max-w-xl sm:grid-cols-4">
          {bar ? null : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="filter-protein">Protein ab (g/Portion)</Label>
                <Input
                  id="filter-protein"
                  inputMode="decimal"
                  defaultValue={params.get("protein") ?? ""}
                  placeholder="z. B. 30"
                  onBlur={(e) => update({ protein: e.target.value.trim() || null })}
                  onKeyDown={(e) => e.key === "Enter" && update({ protein: e.currentTarget.value.trim() || null })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="filter-zeit">Höchstens (Minuten)</Label>
                <Input
                  id="filter-zeit"
                  inputMode="numeric"
                  defaultValue={params.get("zeit") ?? ""}
                  placeholder="z. B. 30"
                  onBlur={(e) => update({ zeit: e.target.value.trim() || null })}
                  onKeyDown={(e) => e.key === "Enter" && update({ zeit: e.currentTarget.value.trim() || null })}
                />
              </div>
            </>
          )}
          {ownBook ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="filter-kosten">{bar ? "Höchstens (€/Drink)" : "Höchstens (€/Portion)"}</Label>
                <Input
                  id="filter-kosten"
                  inputMode="decimal"
                  defaultValue={params.get("kosten") ?? ""}
                  placeholder="z. B. 2,50"
                  onBlur={(e) => update({ kosten: e.target.value.trim() || null })}
                  onKeyDown={(e) => e.key === "Enter" && update({ kosten: e.currentTarget.value.trim() || null })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="filter-bewertung">Bewertung ab</Label>
                <NativeSelect
                  id="filter-bewertung"
                  value={params.get("bewertung") ?? ""}
                  onChange={(e) => update({ bewertung: e.target.value || null })}
                >
                  <option value="">egal</option>
                  {[3, 4, 4.5].map((n) => (
                    <option key={n} value={String(n)}>
                      {String(n).replace(".", ",")} Sterne
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
