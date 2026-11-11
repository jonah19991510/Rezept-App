import type { Metadata } from "next";
import { ComplaintView } from "@/components/sport/health/complaint-view";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/domain/week";
import { getMedicationIntakes, getSickEpisodes } from "@/lib/server/health";

export const metadata: Metadata = { title: "Beschwerden" };

/** Beschwerden wie Kopfschmerzen: eigene Liste und Statistik, zählen nicht als Krankheitstage. */
export default async function ComplaintsPage() {
  const user = await requireUser();
  const [episodes, intakes] = await Promise.all([getSickEpisodes(user.id), getMedicationIntakes(user.id)]);
  return <ComplaintView complaints={episodes.filter((e) => e.kind === "beschwerde")} intakes={intakes} today={todayInBerlin()} />;
}
