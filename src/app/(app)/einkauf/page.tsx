import type { Metadata } from "next";
import { ShoppingBasket } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Einkauf" };

export default function ShoppingPage() {
  return (
    <>
      <PageHeader title="Einkauf" description="Einkaufsliste und Vorrat." />
      <EmptyState icon={ShoppingBasket} title="Die Einkaufsliste ist leer">
        Sobald du Mahlzeiten planst, entsteht hier deine Einkaufsliste, sortiert nach Supermarkt-Abteilung.
      </EmptyState>
    </>
  );
}
