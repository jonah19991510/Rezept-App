import type { Metadata } from "next";
import { ChallengeOverview } from "@/components/sport/challenges/challenge-cards";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/domain/week";
import { getChallenges } from "@/lib/server/challenges";

export const metadata: Metadata = { title: "Challenges" };

/** Entdecken › Challenges: eigene Challenges mit heutigem Stand, öffentliche zum Mitmachen. */
export default async function ChallengesPage() {
  const user = await requireUser();
  const items = await getChallenges(user.id);
  return <ChallengeOverview items={items} today={todayInBerlin()} />;
}
