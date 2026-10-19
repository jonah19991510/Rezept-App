"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Heart, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { AUTO_TAG_LABELS, CATEGORY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const SORT_LABELS = {
  neu: "Zuletzt geändert",
  name: "Name A–Z",
  protein: "Meiste Protein",
  kcal: "Wenigste kcal",
  zeit: "Schnellste zuerst",
} as const;

/** Suche, Filter und Sortierung. Alles steht in der URL, damit Zurück-Knopf und Teilen funktionieren. */
export function RecipeFilters({
  ownTags,
  tagGroupLabel = "Eigene Tags",
  searchPlaceholder = "Rezepte durchsuchen …",
}: {
  ownTags: string[];
  tagGroupLabel?: string;
  searchPlaceholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [showMore, setShowMore] = useState(Boolean(params.get("protein") || params.get("zeit")));
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
  const hasFilters = ["q", "kategorie", "tag", "protein", "zeit", "favoriten"].some((k) => params.get(k));

  return (
    <div className={cn("mb-6 space-y-3", pending && "opacity-80")} role="search">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Rezepte durchsuchen"
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
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

        <NativeSelect aria-label="Tag" value={params.get("tag") ?? ""} onChange={(e) => update({ tag: e.target.value })}>
          <option value="">Alle Tags</option>
          <optgroup label="Automatisch">
            {Object.entries(AUTO_TAG_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </optgroup>
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
          {Object.entries(SORT_LABELS).map(([value, label]) => (
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
        <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-3 sm:max-w-md">
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
