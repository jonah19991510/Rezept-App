import { METHOD_LABELS } from "@/lib/labels";
import { ABV_BUCKETS, abvBucket, type AbvBucket } from "./cocktail";
import type { CocktailSummary } from "./recipe-filter";

// Phase 15: Bar-Statistiken (Cocktails nach Basisspirituose, Methode und Alkoholgehalt).

export type CountSlice = {
  key: string;
  label: string;
  count: number;
  /** Farbe 1–6 (CHART_COLORS); null = „Weitere“ */
  colorSlot: number | null;
  /** Link-Wert für den Filter der Bar-Liste (null bei „Weitere“ und „ohne Angabe“) */
  filter: string | null;
};

export const MAX_SLICES = 5;

/** Häufigkeiten als Segmente, größte zuerst; ab dem sechsten Wert zusammengefasst als „Weitere“. */
export function countSlices(entries: { key: string; label: string; filter: string | null }[], max = MAX_SLICES): CountSlice[] {
  const counts = new Map<string, { label: string; filter: string | null; count: number }>();
  for (const e of entries) {
    const c = counts.get(e.key) ?? { label: e.label, filter: e.filter, count: 0 };
    c.count++;
    counts.set(e.key, c);
  }
  const sorted = [...counts].sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label, "de"));
  const direct = sorted.length > max ? sorted.slice(0, max - 1) : sorted;
  const rest = sorted.length > max ? sorted.slice(max - 1) : [];
  const slices: CountSlice[] = direct.map(([key, c], i) => ({ key, label: c.label, count: c.count, colorSlot: i + 1, filter: c.filter }));
  if (rest.length > 0) {
    slices.push({
      key: "weitere",
      label: `Weitere (${rest.length})`,
      count: rest.reduce((sum, [, c]) => sum + c.count, 0),
      colorSlot: null,
      filter: null,
    });
  }
  return slices;
}

export type BarStatsItem = {
  id: string;
  title: string;
  cocktail: CocktailSummary;
  kcal: number | null;
  /** wie oft laut Koch-Log gemixt */
  timesMixed: number;
};

export type BarStats = {
  total: number;
  avgAbv: number | null;
  avgKcal: number | null;
  avgAlcoholGrams: number | null;
  bySpirit: CountSlice[];
  byMethod: CountSlice[];
  byAbv: { key: AbvBucket; label: string; count: number }[];
  strongest: { id: string; title: string; abv: number }[];
  mostMixed: { id: string; title: string; times: number }[];
};

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export function barStats(items: BarStatsItem[]): BarStats {
  const abvs = items.flatMap((i) => (i.cocktail.abvPercent != null ? [i.cocktail.abvPercent] : []));
  const byAbvCount = new Map<AbvBucket, number>();
  for (const v of abvs) byAbvCount.set(abvBucket(v), (byAbvCount.get(abvBucket(v)) ?? 0) + 1);

  return {
    total: items.length,
    avgAbv: avg(abvs),
    avgKcal: avg(items.flatMap((i) => (i.kcal != null ? [i.kcal] : []))),
    avgAlcoholGrams: avg(items.flatMap((i) => (i.cocktail.alcoholGrams != null ? [i.cocktail.alcoholGrams] : []))),
    bySpirit: countSlices(
      items.map((i) =>
        i.cocktail.baseSpirit
          ? { key: i.cocktail.baseSpirit, label: i.cocktail.baseSpirit, filter: i.cocktail.baseSpirit }
          : { key: "-", label: "alkoholfrei", filter: null },
      ),
    ),
    byMethod: countSlices(
      items.map((i) =>
        i.cocktail.method
          ? { key: i.cocktail.method, label: METHOD_LABELS[i.cocktail.method], filter: i.cocktail.method }
          : { key: "-", label: "ohne Angabe", filter: null },
      ),
    ),
    byAbv: ABV_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: byAbvCount.get(b.key) ?? 0 })),
    strongest: items
      .flatMap((i) => (i.cocktail.abvPercent != null && i.cocktail.abvPercent > 0 ? [{ id: i.id, title: i.title, abv: i.cocktail.abvPercent }] : []))
      .sort((a, b) => b.abv - a.abv || a.title.localeCompare(b.title, "de"))
      .slice(0, 3),
    mostMixed: items
      .filter((i) => i.timesMixed > 0)
      .map((i) => ({ id: i.id, title: i.title, times: i.timesMixed }))
      .sort((a, b) => b.times - a.times || a.title.localeCompare(b.title, "de"))
      .slice(0, 3),
  };
}
