import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DrinkTabs } from "@/components/sport/drinks/drink-tabs";

/** Getränketracker: gemeinsamer Kopf mit den Tabs Heute, Statistik, Tipps, Verlauf, Getränke. */
export default function DrinksLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Getränke" />
      <DrinkTabs />
      {children}
    </>
  );
}
