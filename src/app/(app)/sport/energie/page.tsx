import type { Metadata } from "next";
import { Calculator } from "lucide-react";
import { ComingSoon } from "@/components/sport/coming-soon";

export const metadata: Metadata = { title: "Energiebedarf" };

export default function EnergyPage() {
  return (
    <ComingSoon
      icon={Calculator}
      title="Energiebedarfsrechner"
      intro="Berechnet bald deinen Grund- und Gesamtumsatz."
      features={["Grundumsatz aus Alter, Größe und Gewicht", "Gesamtbedarf mit Alltag und Training", "Ergebnis als Tagesziel übernehmen"]}
    />
  );
}
