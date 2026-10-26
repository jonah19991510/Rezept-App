import type { Metadata } from "next";
import { GlassWater } from "lucide-react";
import { ComingSoon } from "@/components/sport/coming-soon";

export const metadata: Metadata = { title: "Getränke" };

export default function DrinksPage() {
  return (
    <ComingSoon
      icon={GlassWater}
      title="Getränke"
      intro="Hier trägst du bald ein, was du über den Tag trinkst."
      features={["Wasser, Kaffee, Shakes mit einem Tipp eintragen", "Tagesziel für Flüssigkeit mit Fortschritt", "Verlauf in der Statistik"]}
    />
  );
}
