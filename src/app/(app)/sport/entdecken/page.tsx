import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { ComingSoon } from "@/components/sport/coming-soon";

export const metadata: Metadata = { title: "Entdecken" };

export default function SportDiscoverPage() {
  return (
    <ComingSoon
      icon={Compass}
      title="Entdecken"
      intro="Hier findest du bald die Trainingspläne, die andere veröffentlicht haben."
      features={["Eigene Pläne veröffentlichen", "Pläne anderer direkt trainieren", "Pläne in deine eigenen übernehmen"]}
    />
  );
}
