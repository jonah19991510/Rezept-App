import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PantryManager } from "@/components/shopping/pantry-manager";
import { ShoppingTabs } from "@/components/shopping/shopping-tabs";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/domain/week";
import { getMyIngredients } from "@/lib/server/my-ingredients";
import { getPantry } from "@/lib/server/pantry";

export const metadata: Metadata = { title: "Vorrat" };

export default async function PantryPage({ searchParams }: PageProps<"/einkauf/vorrat">) {
  const user = await requireUser();
  const [entries, params, mine] = await Promise.all([getPantry(user.id), searchParams, getMyIngredients(user.id)]);
  // Zum Abhaken: alle Zutaten aus eigenen Rezepten und selbst angelegte
  const candidates = mine.map(({ ingredient: i }) => ({
    ingredientId: i.id,
    name: i.name,
    foodGroup: i.food_group,
    isStaple: i.is_staple,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Einkauf" description="Was du zu Hause hast, in Küche und Bar." />
      <ShoppingTabs active="/einkauf/vorrat" />
      <PantryManager entries={entries} candidates={candidates} today={todayInBerlin()} initialArea={params.bereich === "bar" ? "bar" : "kitchen"} />
    </div>
  );
}
