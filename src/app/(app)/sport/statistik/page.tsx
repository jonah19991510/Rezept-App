import type { Metadata } from "next";
import { ChartLine } from "lucide-react";
import { ComingSoon } from "@/components/sport/coming-soon";

export const metadata: Metadata = { title: "Statistik" };

export default function SportStatsPage() {
  return (
    <ComingSoon
      icon={ChartLine}
      title="Statistik"
      intro="Sobald du Trainings aufzeichnest, siehst du hier deinen Fortschritt."
      features={[
        "Gewicht und geschätztes 1RM je Übung im Verlauf",
        "Bestwerte, Volumen und Sätze pro Muskelgruppe",
        "Trainings pro Woche, Dauer und Serie",
      ]}
    />
  );
}
