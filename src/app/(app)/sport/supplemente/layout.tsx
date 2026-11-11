import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { RouteTabs } from "@/components/sport/health/health-parts";

const TABS = [
  { href: "/sport/supplemente", label: "Supplemente", exact: true },
  { href: "/sport/supplemente/blutwerte", label: "Blutwerte" },
];

/** Supplemente & Blutwerte (Profilmenü): gemeinsamer Kopf mit den Tabs Supplemente und Blutwerte. */
export default function SupplementsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Supplemente & Blutwerte" />
      <RouteTabs tabs={TABS} label="Supplemente & Blutwerte" />
      {children}
    </>
  );
}
