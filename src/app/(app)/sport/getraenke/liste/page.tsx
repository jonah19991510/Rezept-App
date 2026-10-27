import type { Metadata } from "next";
import { DrinkManager } from "@/components/sport/drinks/drink-manager";
import { requireUser } from "@/lib/auth";
import { getDrinkSetup } from "@/lib/server/drinks";

export const metadata: Metadata = { title: "Getränke & Ziel" };

/** Getränketracker, Tab „Getränke“: Tagesziel und eigene Getränke inklusive Mischgetränke. */
export default async function DrinkListPage() {
  const user = await requireUser();
  const { goalMl, drinks } = await getDrinkSetup(user.id);
  return <DrinkManager goalMl={goalMl} drinks={drinks} />;
}
