import type { Metadata } from "next";
import { BookOpenText } from "lucide-react";
import { ComingSoon } from "@/components/sport/coming-soon";

export const metadata: Metadata = { title: "Lexikon" };

export default function LexiconPage() {
  return (
    <ComingSoon
      icon={BookOpenText}
      title="Lexikon"
      intro="Das Nachschlagewerk zu allen Übungen kommt in einer späteren Phase. Die Übungen selbst findest du schon im Profilmenü unter „Übungen“."
      features={["Ausführung Schritt für Schritt", "Typische Fehler und Varianten", "Welche Muskeln arbeiten"]}
    />
  );
}
