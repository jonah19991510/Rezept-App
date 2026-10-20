"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Clock, Heart, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { AUTO_TAG_LABELS, CATEGORY_LABELS, METHOD_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const SORT_LABELS = {
  neu: "Zuletzt geändert",
  name: "Name A–Z",
  protein: "Meiste Protein",
  kcal: "Wenigste kcal",
  zeit: "Schnellste zuerst",
} as const;

/** Phase 15: Sortierung in der Bar */
const BAR_SORT_LABELS = {
  neu: "Zuletzt geändert",
  name: "Name A–Z",
  stark: "Stärkste zuerst",
  leicht: "Leichteste zuerst",
  kcal: "Wenigste kcal",
} as const;

const MORE_KEYS = ["protein", "zeit", "kosten", "bewertung", "lange", "methode"];

/** Suche, Filter und Sortierung. Alles steht in der URL, damit Zurück-Knopf und Teilen funktionieren. */
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
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [showMore, setShowMore] = useState(MORE_KEYS.some((k) => params.get(k)));
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  function onQueryChange(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => update({ q: value.trim() || null }), 300);
  }

  const favorites = params.get("favoriten") === "1";
  const hasFilters = ["q", "kategorie", "basis", "tag", "favoriten", ...MORE_KEYS].some((k) => params.get(k));
  const longAgo = params.get("lange") === "1";

  return (
    <div className={cn("mb-6 space-y-3", pending && "opacity-80")} role="search">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={bar ? "Cocktails durchsuchen" : "Rezepte durchsuchen"}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
        {bar ? (
          <NativeSelect aria-label="Basisspirituose" value={params.get("basis") ?? ""} onChange={(e) => update({ basis: e.target.value })}>
            <option value="">Alle Spirituosen</option>
            {baseSpirits.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <NativeSelect
            aria-label="Kategorie"
            value={params.get("kategorie") ?? ""}
            onChange={(e) => update({ kategorie: e.target.value })}
          >
            <option value="">Alle Kategorien</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        )}

        <NativeSelect aria-label="Tag" value={params.get("tag") ?? ""} onChange={(e) => update({ tag: e.target.value })}>
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
              {ownTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </optgroup>
          ) : null}
        </NativeSelect>

        <NativeSelect
          aria-label="Sortierung"
          value={params.get("sortierung") ?? "neu"}
          onChange={(e) => update({ sortierung: e.target.value === "neu" ? null : e.target.value })}
          className="col-span-2 sm:col-span-1"
        >
          {Object.entries(bar ? BAR_SORT_LABELS : SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>

        <Button
          type="button"
          variant={favorites ? "default" : "outline"}
          aria-pressed={favorites}
          onClick={() => update({ favoriten: favorites ? null : "1" })}
        >
          <Heart className={cn(favorites && "fill-current")} aria-hidden />
          Favoriten
        </Button>
        <Button type="button" variant="outline" aria-expanded={showMore} onClick={() => setShowMore((v) => !v)}>
          <SlidersHorizontal aria-hidden />
          Mehr
        </Button>
      </div>

      {showMore ? (
        <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-3 sm:max-w-xl sm:grid-cols-4">
          {bar ? (
            <div className="grid gap-1.5">
              <Label htmlFor="filter-methode">Methode</Label>
              <NativeSelect id="filter-methode" value={params.get("methode") ?? ""} onChange={(e) => update({ methode: e.target.value || null })}>
                <option value="">alle</option>
                {Object.entries(METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          <div className={cn("grid gap-1.5", bar && "hidden")}>
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
          <div className={cn("grid gap-1.5", bar && "hidden")}>
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
              <Button
                type="button"
                variant={longAgo ? "default" : "outline"}
                aria-pressed={longAgo}
                className={cn("col-span-2 sm:col-span-4 sm:justify-self-start", bar && "hidden")}
                onClick={() => update({ lange: longAgo ? null : "1" })}
              >
                <Clock aria-hidden />
                Lange nicht gekocht
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
        >
          <X aria-hidden />
          Filter zurücksetzen
        </Button>
      ) : null}
    </div>
  );
}
