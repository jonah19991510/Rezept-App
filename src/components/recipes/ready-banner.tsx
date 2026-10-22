import Link from "next/link";
import { ChevronRight, CookingPot, GlassWater } from "lucide-react";

/** Hinweis über der Rezeptliste: „Was kann ich kochen/mixen?“ mit der Zahl der Rezepte, die der Vorrat ganz abdeckt. */
export function ReadyBanner({ kind, count }: { kind: "kitchen" | "bar"; count: number }) {
  const bar = kind === "bar";
  const Icon = bar ? GlassWater : CookingPot;
  const detail =
    count === 0
      ? "Mit deinem Vorrat abgleichen"
      : bar
        ? `${count} ${count === 1 ? "Drink" : "Drinks"} sofort mixbar`
        : `${count} ${count === 1 ? "Rezept" : "Rezepte"} sofort kochbar`;
  return (
    <Link
      href={bar ? "/einkauf/was-mixen" : "/einkauf/was-kochen"}
      className="mb-4 flex items-center gap-3 rounded-3xl border border-primary/30 bg-primary/10 p-3 pr-4 transition hover:bg-primary/15 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{bar ? "Was kann ich mixen?" : "Was kann ich kochen?"}</span>
        <span className="block truncate text-sm text-primary">{detail}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
