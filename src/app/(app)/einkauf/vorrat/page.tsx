import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PantryManager } from "@/components/shopping/pantry-manager";
import { ShoppingTabs } from "@/components/shopping/shopping-tabs";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/domain/week";
import { getPantry } from "@/lib/server/pantry";

export const metadata: Metadata = { title: "Vorrat" };

export default async function PantryPage({ searchParams }: PageProps<"/einkauf/vorrat">) {
  const user = await requireUser();
  const [entries, params] = await Promise.all([getPantry(user.id), searchParams]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Einkauf" description="Was du zu Hause hast, in Küche und Bar." />
      <ShoppingTabs active="/einkauf/vorrat" />
      <PantryManager entries={entries} today={todayInBerlin()} initialArea={params.bereich === "bar" ? "bar" : "kitchen"} />
    </div>
  );
}
