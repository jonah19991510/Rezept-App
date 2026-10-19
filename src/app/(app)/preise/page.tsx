import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PriceManager } from "@/components/prices/price-manager";
import { requireUser } from "@/lib/auth";
import { getPrices } from "@/lib/server/kitchen-log";

export const metadata: Metadata = { title: "Preise" };

/** Eigene Zutatenpreise (Profilmenü → Preise). Grundlage für Kosten pro Portion. */
export default async function PricesPage() {
  const user = await requireUser();
  const prices = await getPrices(user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Preise" description="Was du für deine Zutaten bezahlst. Nur du siehst deine Preise." />
      <PriceManager prices={prices} />
    </div>
  );
}
