import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { IngredientManager } from "@/components/ingredients/ingredient-manager";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth";
import { getMyIngredients } from "@/lib/server/my-ingredients";
import { getIngredientDisplayNames } from "@/lib/server/pantry";

export const metadata: Metadata = { title: "Zutaten" };

/** Profilmenü → Zutaten: Zutaten aus eigenen Rezepten und selbst angelegte, mit Preis; eigene sind bearbeitbar. */
export default async function IngredientsPage() {
  const user = await requireUser();
  const [items, displayNames] = await Promise.all([getMyIngredients(user.id), getIngredientDisplayNames()]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Zutaten"
        meta={
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="size-4 shrink-0" aria-hidden />
              <span className="truncate">Preise siehst nur du</span>
            </p>
            <Link
              href="/preise"
              className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-full px-2 text-sm font-semibold text-primary transition hover:text-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Alle Preise
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        }
      />
      <IngredientManager items={items} displayNames={displayNames} />
    </div>
  );
}
