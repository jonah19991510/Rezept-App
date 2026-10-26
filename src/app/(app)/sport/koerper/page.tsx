import type { Metadata } from "next";
import { Ruler } from "lucide-react";
import { ComingSoon } from "@/components/sport/coming-soon";

export const metadata: Metadata = { title: "Körpermaße" };

export default function BodyPage() {
  return (
    <ComingSoon
      icon={Ruler}
      title="Körpermaße"
      intro="Gewicht und Umfänge festhalten und den Verlauf sehen."
      features={["Körpergewicht, Körperfett und Umfänge eintragen", "Verlauf als Diagramm", "Fortschritt neben deinen Trainings"]}
    />
  );
}
