import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { CopyWeekDialog } from "@/components/plan/copy-week-dialog";
import { WeekPlanner } from "@/components/plan/week-planner";
import { requireUser } from "@/lib/auth";
import { planRecipeOptions } from "@/lib/domain/community";
import { longNotCooked } from "@/lib/domain/cooklog";
import { leftoverIdeas, type LeftoverIdea } from "@/lib/domain/leftovers";
import { isTrainingDay } from "@/lib/domain/training";
import { addDays, resolveWeekParam, todayInBerlin, weekDays } from "@/lib/domain/week";
import { getAllGoals, getPlannedBefore, getRecipeBases, getTrainingDays, getWeekBatches, getWeekEntries } from "@/lib/server/plan";
import { getCookLogs, getLongNotCookedWeeks, getRecipeCosts } from "@/lib/server/kitchen-log";
import { getOwnRecipeList, getPublicRecipeList } from "@/lib/server/recipes";
import { hasPlanShoppingItems } from "@/lib/server/shopping";

export const metadata: Metadata = { title: "Wochenplan" };

export default async function MealPlanPage({ searchParams }: PageProps<"/wochenplan">) {
  const user = await requireUser();
  const { woche } = await searchParams;
  const today = todayInBerlin();
  const monday = resolveWeekParam(woche, today);
  const days = weekDays(monday);

  const [entries, goals, training, batches, before, ownRecipes, publicRecipes, logs, weeks, planOnList] = await Promise.all([
    getWeekEntries(user.id, monday),
    getAllGoals(user.id),
    getTrainingDays(user.id, monday, addDays(monday, 6)),
    getWeekBatches(user.id, monday),
    getPlannedBefore(user.id, monday),
    getOwnRecipeList(user.id),
    getPublicRecipeList(user.id),
    getCookLogs(user.id),
    getLongNotCookedWeeks(user.id),
    hasPlanShoppingItems(user.id),
  ]);

  // Eigenes Buch und öffentliche Rezepte anderer (Phase 6)
  const recipeOptions = planRecipeOptions(ownRecipes, publicRecipes);

  // Reste-Vorschläge (Phase 11): Basen der geplanten Rezepte und eigene Rezepte mit derselben Basis
  const plannedByDate: Record<string, string[]> = {};
  for (const e of [...before, ...entries]) if (e.recipeId) (plannedByDate[e.date] ??= []).push(e.recipeId);
  const bases = await getRecipeBases([...new Set([...ownRecipes.map((r) => r.id), ...Object.values(plannedByDate).flat()])]);
  const ideas: Record<string, LeftoverIdea[]> = Object.fromEntries(
    days.map((d) => [d, leftoverIdeas(d, plannedByDate, bases, ownRecipes)]),
  );

  // Phase 12: Kosten pro Portion (eigene Preise) und „Lange nicht gekocht“ (nur eigene Rezepte)
  const costs = await getRecipeCosts([...new Set(entries.flatMap((e) => (e.recipeId ? [e.recipeId] : [])))]);
  const costPerServing = Object.fromEntries([...costs].map(([id, c]) => [id, { perServing: c.perServing, complete: c.priced === c.count }]));
  const titles = new Map(ownRecipes.map((r) => [r.id, r.title]));
  const longAgo = longNotCooked(logs, today, weeks)
    .filter((l) => titles.has(l.recipeId) && !entries.some((e) => e.recipeId === l.recipeId))
    .slice(0, 5)
    .map((l) => ({ id: l.recipeId, title: titles.get(l.recipeId)!, weeksAgo: l.weeksAgo, avgRating: l.avgRating }));

  const trainingDays = Object.fromEntries(days.map((d) => [d, isTrainingDay(d, training.weekdays, training.overrides)]));

  return (
    <>
      <PageHeader title="Wochenplan" actions={<CopyWeekDialog monday={monday} hasEntries={entries.length > 0} />} />

      {/* key: bei Wochenwechsel den gewählten Tag neu bestimmen */}
      <WeekPlanner
        key={monday}
        monday={monday}
        days={days}
        today={today}
        entries={entries}
        goals={goals}
        trainingDays={trainingDays}
        batches={batches}
        leftoverIdeas={ideas}
        recipes={recipeOptions}
        costs={costPerServing}
        longNotCooked={{ items: longAgo, weeks }}
        hasPlanShoppingItems={planOnList}
      />
    </>
  );
}
