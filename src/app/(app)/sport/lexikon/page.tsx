import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { LexiconView } from "@/components/sport/lexicon/lexicon-view";
import { requireUser } from "@/lib/auth";
import { canWriteLexicon } from "@/lib/domain/lexicon";
import { getLexicon } from "@/lib/server/lexicon";

export const metadata: Metadata = { title: "Lexikon" };

/** Profilmenü (Sport) → Lexikon: Nachschlagewerk zu Gesundheitsthemen. Schreiben vorerst nur Admins. */
export default async function LexiconPage() {
  const user = await requireUser();
  const { entries, categories } = await getLexicon();
  const topLevel = categories.filter((c) => c.parentId == null).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Lexikon" description={`${entries.length} ${entries.length === 1 ? "Eintrag" : "Einträge"} · ${topLevel} Kategorien`} />
      <LexiconView entries={entries} categories={categories} canWrite={canWriteLexicon(user.role)} />
    </div>
  );
}
