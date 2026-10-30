import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HomeWidgets } from "@/components/home/home-widgets";
import {
  ExpiringWidget,
  FoodAreaWidget,
  LongNotCookedWidget,
  MealsWidget,
  NextWidget,
  ReadyWidget,
  ShoppingWidget,
  SportAreaWidget,
  TodayWidget,
  TrainingWidget,
} from "@/components/home/widgets";
import { requireUser } from "@/lib/auth";
import { berlinHour, greeting, type HomeWidgetId } from "@/lib/domain/home";
import { dayMonth, todayInBerlin, weekdayLong } from "@/lib/domain/week";
import {
  getDrinkToday,
  getExpiringPantry,
  getHomeLayout,
  getLongNotCookedRecipes,
  getOpenShopping,
  getSportSummary,
  getTodayPlan,
} from "@/lib/server/home";
import { countReadyRecipes } from "@/lib/server/pantry";

export const metadata: Metadata = { title: "Start" };

/** Startseite (26.10.2026, neu gestaltet 30.10.2026): Datum, Begrüßung und Widgets in eigener Reihenfolge. */
export default async function HomePage() {
  const user = await requireUser();
  const today = todayInBerlin();
  const hour = berlinHour();
  const layout = await getHomeLayout(user.id);
  const visible = new Set(layout.filter((w) => w.visible).map((w) => w.id));
  const needs = (...ids: HomeWidgetId[]) => ids.some((id) => visible.has(id));

  // Nur laden, was sichtbare Widgets brauchen
  const [plan, drink, shopping, dishes, cocktails, expiring, longAgo, sport] = await Promise.all([
    needs("today", "next", "food", "meals") ? getTodayPlan(user.id, today) : null,
    needs("today", "sport") ? getDrinkToday(user.id, today) : null,
    needs("food", "shopping") ? getOpenShopping(user.id) : null,
    needs("ready") ? countReadyRecipes(user.id, "dish") : null,
    needs("ready") ? countReadyRecipes(user.id, "cocktail") : null,
    needs("expiring") ? getExpiringPantry(user.id, today) : null,
    needs("longNotCooked") ? getLongNotCookedRecipes(user.id, today) : null,
    // Fehler hier (z. B. Sport-Tabellen fehlen) kosten nicht die ganze Startseite
    needs("next", "sport", "training") ? getSportSummary(user.id, today) : null,
  ]);

  const widgets: Partial<Record<HomeWidgetId, ReactNode>> = {
    today: plan ? <TodayWidget plan={plan} drink={drink} /> : null,
    next: visible.has("next") ? <NextWidget plan={plan} sport={sport} hour={hour} /> : null,
    food: visible.has("food") ? <FoodAreaWidget plan={plan} shoppingCount={shopping?.count ?? null} /> : null,
    sport: sport && visible.has("sport") ? <SportAreaWidget sport={sport} drink={drink} /> : null,
    training: sport && visible.has("training") ? <TrainingWidget sport={sport} today={today} /> : null,
    meals: plan ? <MealsWidget plan={plan} /> : null,
    shopping: shopping ? <ShoppingWidget shopping={shopping} /> : null,
    ready: dishes != null && cocktails != null ? <ReadyWidget dishes={dishes} cocktails={cocktails} /> : null,
    expiring: expiring ? <ExpiringWidget items={expiring} today={today} /> : null,
    longNotCooked: longAgo ? <LongNotCookedWidget items={longAgo.items} weeks={longAgo.weeks} /> : null,
  };

  const firstName = user.displayName.trim().split(/\s+/)[0];

  return (
    <>
      <header className="mt-3 mb-6 flex flex-col-reverse">
        <h1 className="text-4xl leading-tight font-semibold md:text-5xl">
          {greeting(hour)}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mb-1 text-muted-foreground">
          {weekdayLong(today)}, {dayMonth(today)}
        </p>
      </header>
      {/* key: nach dem Speichern mit der neuen Anordnung neu starten */}
      <HomeWidgets key={layout.map((w) => `${w.id}:${w.visible ? 1 : 0}`).join(",")} layout={layout} widgets={widgets} />
    </>
  );
}
