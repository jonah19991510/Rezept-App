import type { Metadata } from "next";
import { BookOpenText } from "lucide-react";
import { ComingSoon } from "@/components/sport/coming-soon";

export const metadata: Metadata = { title: "Lexikon" };

export default function LexiconPage() {
  return (
    <ComingSoon
      icon={BookOpenText}
      title="Lexikon"
      intro="Das Nachschlagewerk zu allen Übungen kommt in einer späteren Phase."
      features={["Alle Übungen nach Muskelgruppe und Gerät", "Ausführung, typische Fehler, Varianten", "Eigene Übungen bearbeiten"]}
    />
  );
}
