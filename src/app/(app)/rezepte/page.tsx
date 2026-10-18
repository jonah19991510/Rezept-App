import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Rezepte" };

export default function RecipesPage() {
  return (
    <>
      <PageHeader title="Rezepte" description="Dein persönliches Rezeptbuch." />
      <EmptyState icon={BookOpen} title="Dein Rezeptbuch ist noch leer">
        Bald kannst du hier Rezepte anlegen, Zutaten suchen und Makros berechnen lassen.
      </EmptyState>
    </>
  );
}
