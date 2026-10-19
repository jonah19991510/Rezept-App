import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CopyWeekDialog } from "@/components/plan/copy-week-dialog";
import { WeekPlanner } from "@/components/plan/week-planner";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { planRecipeOptions } from "@/lib/domain/community";
import { leftoverIdeas, type LeftoverIdea } from "@/lib/domain/leftovers";
import { isTrainingDay } from "@/lib/domain/training";
import { addDays, mondayOf, resolveWeekParam, todayInBerlin, weekDays, weekLabel } from "@/lib/domain/week";
import { getAllGoals, getPlannedBefore, getRecipeBases, getTrainingDays, getWeekBatches, getWeekEntries } from "@/lib/server/plan";
import { getOwnRecipeList, getPublicRecipeList } from "@/lib/server/recipes";

export const metadata: Metadata = { title: "Wochenplan" };

export default async function MealPlanPage({ searchParams }: PageProps<"/wochenplan">) {
  const user = await requireUser();
  const { woche } = await searchParams;
  const today = todayInBerlin();
  const monday = resolveWeekParam(woche, today);
  const days = weekDays(monday);

  const [entries, goals, training, batches, before, ownRecipes, publicRecipes] = await Promise.all([
    getWeekEntries(user.id, monday),
    getAllGoals(user.id),
    getTrainingDays(user.id, monday, addDays(monday, 6)),
    getWeekBatches(user.id, monday),
    getPlannedBefore(user.id, monday),
    getOwnRecipeList(user.id),
    getPublicRecipeList(user.id),
  ]);

  // Eigenes Buch und öffentliche Rezepte anderer (Phase 6)
  const recipeOptions = planRecipeOptions(ownRecipes, publicRecipes);

  // Reste-Vorschläge (Phase 11): Basen der geplanten Rezepte und eigene Rezepte mit derselben Basis
  const plannedByDate: Record<string, string[]> = {};
  for (const e of [...before, ...entries]) (plannedByDate[e.date] ??= []).push(e.recipeId);
  const bases = await getRecipeBases([...new Set([...ownRecipes.map((r) => r.id), ...Object.values(plannedByDate).flat()])]);
  const ideas: Record<string, LeftoverIdea[]> = Object.fromEntries(
    days.map((d) => [d, leftoverIdeas(d, plannedByDate, bases, ownRecipes)]),
  );

  const trainingDays = Object.fromEntries(days.map((d) => [d, isTrainingDay(d, training.weekdays, training.overrides)]));
  const isCurrentWeek = monday === mondayOf(today);

  return (
    <>
      <PageHeader title="Wochenplan" description={weekLabel(monday)} actions={<CopyWeekDialog monday={monday} hasEntries={entries.length > 0} />} />

      <nav className="mb-5 flex items-center gap-2" aria-label="Wochen">
        <Link
          href={`/wochenplan?woche=${addDays(monday, -7)}`}
          className={buttonVariants({ variant: "outline", size: "icon" })}
          aria-label="Vorherige Woche"
        >
          <ChevronLeft aria-hidden />
        </Link>
        <Link
          href="/wochenplan"
          className={buttonVariants({ variant: isCurrentWeek ? "secondary" : "outline" })}
          aria-current={isCurrentWeek ? "page" : undefined}
        >
          Diese Woche
        </Link>
        <Link
          href={`/wochenplan?woche=${addDays(monday, 7)}`}
          className={buttonVariants({ variant: "outline", size: "icon" })}
          aria-label="Nächste Woche"
        >
          <ChevronRight aria-hidden />
        </Link>
      </nav>

      {/* key: bei Wochenwechsel den gewählten Tag neu bestimmen */}
      <WeekPlanner
        key={monday}
        days={days}
        today={today}
        entries={entries}
        goals={goals}
        trainingDays={trainingDays}
        batches={batches}
        leftoverIdeas={ideas}
        recipes={recipeOptions}
      />
    </>
  );
}
