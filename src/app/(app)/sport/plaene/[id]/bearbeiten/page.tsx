import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlanEditor } from "@/components/sport/editor/plan-editor";
import { draftFromPlan, keyGenerator } from "@/components/sport/editor/plan-model";
import { requireUser } from "@/lib/auth";
import { getExercises, getTrainingPlan } from "@/lib/server/sport";

export const metadata: Metadata = { title: "Trainingsplan bearbeiten" };

export default async function EditPlanPage({ params }: PageProps<"/sport/plaene/[id]/bearbeiten">) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [plan, exercises] = await Promise.all([getTrainingPlan(id, user.id), getExercises(user.id)]);
  if (!plan || !plan.isOwn) notFound();
  const draft = draftFromPlan(plan, keyGenerator());
  const keyCount = draft.days.length + draft.days.reduce((n, d) => n + d.exercises.length, 0);
  return <PlanEditor initial={draft} exercises={exercises} keyStart={keyCount} />;
}
