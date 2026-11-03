import type { Metadata } from "next";
import { ChallengeEditor } from "@/components/sport/challenges/challenge-editor";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/domain/week";

export const metadata: Metadata = { title: "Neue Challenge" };

export default async function NewChallengePage() {
  await requireUser();
  return <ChallengeEditor challenge={null} locked={false} today={todayInBerlin()} />;
}
