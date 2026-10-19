import Link from "next/link";
import { Clock, Heart } from "lucide-react";
import { autoTagsFor, totalMinutes, type RecipeListItem } from "@/lib/domain/recipe-filter";
import { formatNumber } from "@/lib/format";
import { formatMinutes } from "@/lib/format-quantity";
import { CATEGORY_LABELS } from "@/lib/labels";
import { MacroDot } from "./macro-dot";
import { RecipeTags } from "./recipe-tags";

export function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  const minutes = formatMinutes(totalMinutes(recipe));
  const n = recipe.nutrition;

  return (
    <Link
      href={`/rezepte/${recipe.id}`}
      className="group flex h-full flex-col gap-3 rounded-3xl border bg-card p-4 shadow-sm shadow-foreground/5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          {recipe.category ? (
            <p className="text-xs font-medium tracking-wide text-primary uppercase">{CATEGORY_LABELS[recipe.category]}</p>
          ) : null}
          <h2 className="text-lg leading-snug font-semibold group-hover:text-primary">{recipe.title}</h2>
        </div>
        {recipe.isFavorite ? <Heart className="mt-1 size-5 shrink-0 fill-primary text-primary" aria-label="Favorit" /> : null}
      </div>

      {n && n.kcal_per_serving != null ? (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <div className="flex items-center gap-1">
            <dt className="sr-only">Kalorien pro Portion</dt>
            <dd className="flex items-center gap-1 font-semibold">
              <MacroDot macro="kcal" />
              {formatNumber(Math.round(n.kcal_per_serving), 0)} kcal
            </dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="flex items-center gap-1 text-muted-foreground">
              <MacroDot macro="protein" />
              P
            </dt>
            <dd className="font-medium">{formatNumber(n.protein_per_serving ?? 0, 0)} g</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="flex items-center gap-1 text-muted-foreground">
              <MacroDot macro="carbs" />
              KH
            </dt>
            <dd className="font-medium">{formatNumber(n.carbs_per_serving ?? 0, 0)} g</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="flex items-center gap-1 text-muted-foreground">
              <MacroDot macro="fat" />
              F
            </dt>
            <dd className="font-medium">{formatNumber(n.fat_per_serving ?? 0, 0)} g</dd>
          </div>
        </dl>
      ) : null}

      <RecipeTags autoTags={autoTagsFor(recipe)} tags={recipe.tags.slice(0, 3)} />

      {minutes ? (
        <p className="mt-auto flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" aria-hidden />
          {minutes}
        </p>
      ) : null}
    </Link>
  );
}
