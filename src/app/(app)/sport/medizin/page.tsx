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
  return <SickView episodes={episodes} intakes={intakes} today={todayInBerlin()} />;
}
