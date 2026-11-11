import type { Metadata } from "next";
import { MedicationView } from "@/components/sport/health/medication-view";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/domain/week";
import { getMedicationIntakes, getSickEpisodes } from "@/lib/server/health";

export const metadata: Metadata = { title: "Medikamente" };

/** Medikamente: wann welches Medikament und warum. */
export default async function MedicationPage() {
  const user = await requireUser();
  const [intakes, episodes] = await Promise.all([getMedicationIntakes(user.id), getSickEpisodes(user.id)]);
  return <MedicationView intakes={intakes} episodes={episodes} today={todayInBerlin()} />;
}
