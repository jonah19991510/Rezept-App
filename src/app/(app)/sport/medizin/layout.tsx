import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { RouteTabs } from "@/components/sport/health/health-parts";

const TABS = [
  { href: "/sport/medizin", label: "Krankheitstage", exact: true },
  { href: "/sport/medizin/medikamente", label: "Medikamente" },
  { href: "/sport/medizin/vorsorge", label: "Vorsorge" },
];

/** Medizin & Vorsorge (Profilmenü): gemeinsamer Kopf mit den Tabs Krankheitstage, Medikamente, Vorsorge. */
export default function MedicalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Medizin & Vorsorge" />
      <RouteTabs tabs={TABS} label="Medizin & Vorsorge" />
      {children}
    </>
  );
}
