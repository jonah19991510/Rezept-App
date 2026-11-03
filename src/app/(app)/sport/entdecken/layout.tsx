import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DiscoverTabs } from "@/components/sport/challenges/discover-tabs";

/** Entdecken (Sport & Gesundheit): gemeinsamer Kopf mit den Tabs Challenges, Rangliste und Pläne. */
export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Entdecken" description="Mitmachen, vergleichen, gegenseitig motivieren." />
      <DiscoverTabs />
      {children}
    </>
  );
}
