import type { Metadata } from "next";
import Link from "next/link";
import { IngredientManager } from "@/components/ingredients/ingredient-manager";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth";
import { getMyIngredients } from "@/lib/server/my-ingredients";

export const metadata: Metadata = { title: "Zutaten" };

/** Profilmenü → Zutaten: Zutaten aus eigenen Rezepten und selbst angelegte, mit Preis; eigene sind bearbeitbar. */
export default async function IngredientsPage() {
  const user = await requireUser();
  const items = await getMyIngredients(user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Zutaten"
        description={
          <>
            Aus deinen Rezepten und selbst angelegt. Preise siehst nur du; alle Preise auf einen Blick unter{" "}
            <Link href="/preise" className="text-primary underline-offset-4 hover:underline">
              Preise
            </Link>
            .
          </>
        }
      />
      <IngredientManager items={items} />
    </div>
  );
}
