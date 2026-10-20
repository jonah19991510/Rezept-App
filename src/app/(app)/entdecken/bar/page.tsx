import type { Metadata } from "next";
import { DiscoverView } from "@/components/recipes/discover-view";

export const metadata: Metadata = { title: "Entdecken: Bar" };

/** Phase 15: öffentliche Cocktails aus der Runde. */
export default function DiscoverBarPage({ searchParams }: PageProps<"/entdecken/bar">) {
  return <DiscoverView type="cocktail" searchParams={searchParams} />;
}
