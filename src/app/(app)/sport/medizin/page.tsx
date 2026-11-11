import type { Metadata } from "next";
import { SickView } from "@/components/sport/health/sick-view";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/domain/week";
import { getMedicationIntakes, getSickEpisodes } from "@/lib/server/health";

export const metadata: Metadata = { title: "Krankheitstage" };

/** Krankheitstage mit Symptomen, Fieber und den Medikamenten dazu. */
export default async function SickPage() {
  const user = await requireUser();
  const [episodes, intakes] = await Promise.all([getSickEpisodes(user.id), getMedicationIntakes(user.id)]);
  // Beschwerden (z. B. Kopfschmerzen) haben einen eigenen Tab und zählen hier nicht mit
  return <SickView episodes={episodes.filter((e) => e.kind === "krank")} intakes={intakes} today={todayInBerlin()} />;
}
