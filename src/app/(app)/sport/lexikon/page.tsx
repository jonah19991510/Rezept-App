import type { Metadata } from "next";
import { BookOpenText } from "lucide-react";
import { ComingSoon } from "@/components/sport/coming-soon";

export const metadata: Metadata = { title: "Lexikon" };

export default function LexiconPage() {
  return (
    <ComingSoon
      icon={BookOpenText}
      title="Lexikon"
      intro="Hier entsteht ein Nachschlagewerk zu Gesundheitsthemen: verständlich erklärt und mit Quellen. Es ersetzt keine ärztliche Beratung."
      features={[
        "Ernährung: Makro- und Mikronährstoffe, Kalorien, Trinken",
        "Supplements: was belegt ist, wie viel sinnvoll ist, worauf man achten sollte",
        "Training: Begriffe, Belastung, Erholung und Regeneration",
        "Blutwerte: was sie bedeuten und welche Bereiche als normal gelten",
      ]}
    />
  );
}
