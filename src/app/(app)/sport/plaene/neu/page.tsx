import type { Metadata } from "next";
import { PlanEditor } from "@/components/sport/editor/plan-editor";
import { emptyPlan, keyGenerator } from "@/components/sport/editor/plan-model";
import { requireUser } from "@/lib/auth";
import { getExercises } from "@/lib/server/sport";

export const metadata: Metadata = { title: "Neuer Trainingsplan" };

export default async function NewPlanPage() {
  const user = await requireUser();
  const exercises = await getExercises(user.id);
  const plan = emptyPlan(keyGenerator());
  return <PlanEditor initial={plan} exercises={exercises} keyStart={1} />;
}
