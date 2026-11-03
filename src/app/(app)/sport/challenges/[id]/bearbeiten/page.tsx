import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChallengeEditor } from "@/components/sport/challenges/challenge-editor";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/domain/week";
import { getChallengeForEdit } from "@/lib/server/challenges";

export const metadata: Metadata = { title: "Challenge bearbeiten" };

/** Bearbeiten nur für Ersteller und Admins; machen andere mit, sind die Regeln gesperrt. */
export default async function EditChallengePage({ params }: PageProps<"/sport/challenges/[id]/bearbeiten">) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getChallengeForEdit(id);
  if (!data || (data.challenge.createdBy !== user.id && user.role !== "admin")) notFound();
  return <ChallengeEditor challenge={data.challenge} locked={data.locked} today={todayInBerlin()} />;
}
