import Link from "next/link";
import type { ReactNode } from "react";
import {
  BookOpen,
  BookOpenText,
  CalendarDays,
  ChefHat,
  ChevronRight,
  Dumbbell,
  Flame,
  Hourglass,
  Martini,
  Ruler,
  ShoppingBasket,
  Star,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { AreaTile } from "@/components/layout/area-tile";
import { AREAS } from "@/components/layout/nav-items";
import { SLOT_TODAY, upcomingEntry } from "@/lib/domain/home";
import { formatLiters } from "@/lib/domain/drinks";
import { expiryLabel } from "@/lib/domain/pantry";
import { SLOT_LABELS } from "@/lib/domain/plan";
import { formatNumber } from "@/lib/format";
import { addDays, mondayOf, weekdayShort } from "@/lib/domain/week";
import { workoutDuration } from "@/lib/domain/workout";
import type { DrinkToday, ExpiringItem, LongAgoRecipe, SportSummary, TodayPlan } from "@/lib/server/home";
import { cn } from "@/lib/utils";

// Widgets der Startseite (Server-Komponenten). Anordnen und Ausblenden übernimmt HomeWidgets.

const CARD = "rounded-3xl border bg-card p-5 text-card-foreground md:p-6";
const LINK_CARD = cn(CARD, "block transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none");

const fmt = (n: number) => formatNumber(Math.round(n), 0);

/** Kopfzeile kleiner Widgets: Symbol, Titel und rechts ein Hinweis oder Link. */
function WidgetTitle({ icon: Icon, title, aside }: { icon: LucideIcon; title: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-2 font-sans text-base font-semibold tracking-normal">
        <Icon className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{title}</span>
      </h2>
      {aside}
    </div>
  );
}

function AsideLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-lg text-sm font-medium text-primary hover:underline">
      {children}
      <ChevronRight className="size-4" aria-hidden />
    </Link>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

type Ring = { label: string; href: string; color: string; value: string; goal: string; ratio: number | null };

/** Drei Ringe ineinander (außen der erste), Spur in heller Ringfarbe, Fortschritt bis höchstens voll. */
function Rings({ rings }: { rings: Ring[] }) {
  const stroke = 9;
  return (
    // width/height als Rückfall: ohne geladene CSS (alte Datei im Handy-Cache) würde das SVG sonst bildschirmbreit
    <svg viewBox="0 0 120 120" width={128} height={128} className="size-32 shrink-0 -rotate-90 md:size-36" aria-hidden>
      {rings.map((ring, i) => {
        const r = 60 - stroke / 2 - i * (stroke + 3.5);
        const length = 2 * Math.PI * r;
        const ratio = Math.min(1, Math.max(0, ring.ratio ?? 0));
        return (
          <g key={ring.label} style={{ stroke: ring.color }} fill="none" strokeWidth={stroke}>
            <circle cx="60" cy="60" r={r} strokeOpacity={0.2} />
            {ratio > 0 ? (
              <circle cx="60" cy="60" r={r} strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length * (1 - ratio)} />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** „0,50“ bzw. mit `digits = 1` „2,0“ (Liter ohne Einheit) */
const liters = (ml: number, digits = 2) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(ml / 1000);

/**
 * Heute: Ringe für kcal und Protein laut Wochenplan gegen das Tagesziel (Trainingstag oder normal) und die heutige
 * Trinkmenge gegen das Trinkziel. Jede Zeile führt zu ihrer Seite.
 */
export function TodayWidget({ plan, drink }: { plan: TodayPlan; drink: DrinkToday | null }) {
  const { totals, goals } = plan;
  const rings: Ring[] = [
    {
      label: "Kalorien",
      href: "/wochenplan",
      color: "var(--macro-kcal)",
      value: fmt(totals.kcal),
      goal: goals.kcal != null ? `/ ${fmt(goals.kcal)} kcal` : "kcal geplant",
      ratio: goals.kcal ? totals.kcal / goals.kcal : null,
    },
    {
      label: "Protein",
      href: "/wochenplan",
      color: "var(--ring-protein)",
      value: fmt(totals.protein),
      goal: goals.protein != null ? `/ ${fmt(goals.protein)} g` : "g geplant",
      ratio: goals.protein ? totals.protein / goals.protein : null,
    },
  ];
  if (drink) {
    rings.push({
      label: "Trinken",
      href: "/sport/getraenke",
      color: "var(--ring-water)",
      value: liters(drink.ml),
      goal: `/ ${liters(drink.goalMl, 1)} l`,
      ratio: drink.ml / drink.goalMl,
    });
  }

  return (
    <section className={cn(CARD, "flex items-center gap-5 sm:gap-8")} aria-label="Heute">
      <Rings rings={rings} />
      <ul className="min-w-0 flex-1 space-y-1">
        {rings.map((ring) => (
          <li key={ring.label}>
            <Link
              href={ring.href}
              className="-mx-2 block rounded-xl px-2 py-0.5 transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="size-2 shrink-0 rounded-full" style={{ background: ring.color }} aria-hidden />
                {ring.label}
              </span>
              <span className="block truncate">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">{ring.value}</span>{" "}
                <span className="text-sm text-muted-foreground tabular-nums">{ring.goal}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Kachel unter „Als Nächstes“: Symbol oben, Hinweis und Titel unten, in der Farbe des Bereichs. */
function NextTile({ href, area, icon: Icon, label, title }: { href: string; area: "food" | "sport"; icon: LucideIcon; label: string; title: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-36 min-w-0 flex-col justify-between gap-4 rounded-3xl p-4 transition-[filter] hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:hover:brightness-110",
        area === "food" ? "bg-food-soft" : "bg-sport-soft",
      )}
    >
      <span className={cn("grid size-9 place-items-center rounded-xl", area === "food" ? "bg-food text-food-foreground" : "bg-sport text-sport-foreground")}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className={cn("block text-xs font-medium", area === "food" ? "text-food" : "text-sport")}>{label}</span>
        <span className="mt-0.5 line-clamp-3 font-heading text-lg leading-tight font-semibold tracking-tight break-words">{title}</span>
      </span>
    </Link>
  );
}

const clock = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

/** Als Nächstes: nächste Mahlzeit von heute und nächstes (oder laufendes) Training. */
export function NextWidget({ plan, sport, hour }: { plan: TodayPlan | null; sport: SportSummary | null; hour: number }) {
  const meal = plan ? upcomingEntry(plan.entries, hour) : null;
  const food = meal
    ? {
        href: meal.recipeId && meal.available ? `/rezepte/${meal.recipeId}` : "/wochenplan",
        label: SLOT_TODAY[meal.slot],
        title: meal.recipeTitle,
      }
    : { href: "/wochenplan", label: "Heute", title: plan && plan.entries.length > 0 ? "Alles gegessen" : "Noch nichts geplant" };

  const training = sport?.active
    ? { href: `/training/${sport.active.id}`, label: "Training läuft", title: `Seit ${clock.format(new Date(sport.active.startedAt))} Uhr` }
    : sport?.next
      ? { href: "/sport/plaene", label: "Nächstes Training", title: `${sport.next.dayName}${sport.next.focus ? ` · ${sport.next.focus}` : ""}` }
      : { href: "/sport/plaene", label: "Training", title: sport?.hasPlan ? "Plan ohne Tage" : "Ersten Plan anlegen" };

  return (
    <section aria-labelledby="als-naechstes">
      <h2 id="als-naechstes" className="mb-3 text-xl font-semibold">
        Als Nächstes
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <NextTile area="food" icon={Utensils} {...food} />
        <NextTile area="sport" icon={Dumbbell} {...training} />
      </div>
    </section>
  );
}

type Tile = { href: string; label: string; icon: LucideIcon; badge?: number };

/** Bereichskarte: Kachel, Titel, Untertitel und vier runde Abkürzungen in den Bereich. */
function AreaCard({ areaKey, subtitle, tiles }: { areaKey: "food" | "sport"; subtitle: string; tiles: Tile[] }) {
  const area = AREAS.find((a) => a.key === areaKey)!;
  return (
    <section className={cn(CARD, "p-2.5 md:p-4")} aria-label={area.label}>
      <Link
        href={area.href}
        className="flex items-center gap-3 rounded-2xl p-2 transition-colors md:gap-4 hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <AreaTile area={area} size="lg" className="max-md:size-12 max-md:rounded-[0.95rem]" />
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-[1.375rem] leading-tight font-semibold tracking-tight md:text-2xl">{area.label}</span>
          <span className="block text-sm text-muted-foreground">{subtitle}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      <ul className="mt-2 grid grid-cols-4">
        {tiles.map(({ href, label, icon: Icon, badge }) => (
          <li key={label} className="min-w-0">
            <Link
              href={href}
              aria-label={badge ? `${label}, ${badge} offen` : undefined}
              className="group flex flex-col items-center gap-2 rounded-2xl py-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span
                className={cn(
                  "relative grid size-14 place-items-center rounded-full transition-[filter] group-hover:brightness-95 dark:group-hover:brightness-110",
                  areaKey === "food" ? "bg-food-soft text-food" : "bg-sport-soft text-sport",
                )}
              >
                <Icon className="size-6" aria-hidden />
                {badge ? (
                  <span
                    className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-food px-1 text-xs font-semibold text-food-foreground tabular-nums"
                    aria-hidden
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate text-xs font-medium sm:text-sm">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Essen & Trinken: was bis zum kcal-Ziel noch fehlt, Abkürzungen zu Rezepten, Wochenplan, Einkauf und Bar. */
export function FoodAreaWidget({ plan, shoppingCount }: { plan: TodayPlan | null; shoppingCount: number | null }) {
  const rest = plan && plan.goals.kcal != null ? Math.round(plan.goals.kcal - plan.totals.kcal) : null;
  const subtitle =
    rest == null
      ? plan && plan.totals.kcal > 0
        ? `Heute ${fmt(plan.totals.kcal)} kcal geplant`
        : "Rezepte, Wochenplan, Einkauf und Bar"
      : rest > 0
        ? `Noch ${fmt(rest)} kcal bis zum Ziel`
        : rest === 0
          ? "kcal-Ziel für heute erreicht"
          : `${fmt(-rest)} kcal über dem Ziel`;
  return (
    <AreaCard
      areaKey="food"
      subtitle={subtitle}
      tiles={[
        { href: "/rezepte", label: "Rezepte", icon: BookOpen },
        { href: "/wochenplan", label: "Wochenplan", icon: CalendarDays },
        { href: "/einkauf", label: "Einkauf", icon: ShoppingBasket, badge: shoppingCount ?? undefined },
        { href: "/rezepte/bar", label: "Bar", icon: Martini },
      ]}
    />
  );
}

/** Sport & Gesundheit: laufendes Training bzw. was heute noch zu trinken ist, Abkürzungen zu Training, Körper, Energie, Lexikon. */
export function SportAreaWidget({ sport, drink }: { sport: SportSummary; drink: DrinkToday | null }) {
  const rest = drink ? drink.goalMl - drink.ml : null;
  const subtitle = sport.active
    ? `Training läuft seit ${clock.format(new Date(sport.active.startedAt))} Uhr`
    : rest != null
      ? rest > 0
        ? `Trinken: noch ${formatLiters(rest)} heute`
        : "Trinkziel für heute erreicht"
      : sport.next
        ? `Als Nächstes: ${sport.next.dayName}${sport.next.focus ? ` · ${sport.next.focus}` : ""}`
        : sport.hasPlan
          ? "Dein Plan hat noch keine Tage"
          : "Leg deinen ersten Trainingsplan an";
  return (
    <AreaCard
      areaKey="sport"
      subtitle={subtitle}
      tiles={[
        { href: sport.active ? `/training/${sport.active.id}` : "/sport/plaene", label: "Training", icon: Dumbbell },
        { href: "/sport/koerper", label: "Körper", icon: Ruler },
        { href: "/sport/energie", label: "Energie", icon: Flame },
        { href: "/sport/lexikon", label: "Lexikon", icon: BookOpenText },
      ]}
    />
  );
}

/** Heute geplant: Mahlzeiten von heute mit Link zum Rezept. */
export function MealsWidget({ plan }: { plan: TodayPlan }) {
  return (
    <section className={CARD}>
      <WidgetTitle icon={CalendarDays} title="Heute geplant" aside={<AsideLink href="/wochenplan">Wochenplan</AsideLink>} />
      {plan.entries.length === 0 ? (
        <Empty>Für heute ist noch nichts geplant.</Empty>
      ) : (
        <ul className="divide-y">
          {plan.entries.map((e) => (
            <li key={e.id} className="flex min-h-12 items-center gap-3 py-1.5">
              <span className="w-20 shrink-0 text-xs font-medium tracking-wide text-muted-foreground uppercase">{SLOT_LABELS[e.slot]}</span>
              {e.recipeId == null ? (
                // Eigener Eintrag ohne Rezept (Restaurant …)
                <span className="min-w-0 flex-1 truncate font-medium">{e.recipeTitle}</span>
              ) : e.available ? (
                <Link href={`/rezepte/${e.recipeId}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                  {e.recipeTitle}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.recipeTitle}</span>
              )}
              {e.recipeId ? <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{formatNumber(e.servings, 1)} P.</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Einkaufsliste: Zahl der offenen Einträge und die ersten Namen. */
export function ShoppingWidget({ shopping }: { shopping: { count: number; names: string[] } }) {
  const shown = shopping.names.slice(0, 6);
  const more = shopping.count - shown.length;
  return (
    <Link href="/einkauf" className={LINK_CARD}>
      <WidgetTitle
        icon={ShoppingBasket}
        title="Einkaufsliste"
        aside={<span className="text-sm text-muted-foreground tabular-nums">{shopping.count === 1 ? "1 offen" : `${shopping.count} offen`}</span>}
      />
      {shopping.count === 0 ? (
        <Empty>Alles erledigt, die Liste ist leer.</Empty>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {shown.map((name, i) => (
            <li key={`${name}-${i}`} className="max-w-full truncate rounded-full bg-muted px-3 py-1 text-sm">
              {name}
            </li>
          ))}
          {more > 0 ? <li className="px-1 py-1 text-sm text-muted-foreground">+{more} weitere</li> : null}
        </ul>
      )}
    </Link>
  );
}

/** Was kann ich kochen/mixen? Rezepte, die der Vorrat komplett abdeckt. */
export function ReadyWidget({ dishes, cocktails }: { dishes: number; cocktails: number }) {
  const items = [
    { href: "/einkauf/was-kochen", count: dishes, label: dishes === 1 ? "Gericht" : "Gerichte", icon: ChefHat },
    { href: "/einkauf/was-mixen", count: cocktails, label: cocktails === 1 ? "Cocktail" : "Cocktails", icon: Martini },
  ];
  return (
    <section className={CARD}>
      <WidgetTitle icon={ChefHat} title="Was kann ich kochen?" aside={<AsideLink href="/einkauf/vorrat">Vorrat</AsideLink>} />
      <p className="mb-3 text-sm text-muted-foreground">Mit deinem Vorrat sofort möglich:</p>
      <ul className="grid grid-cols-2 gap-3">
        {items.map(({ href, count, label, icon: Icon }) => (
          <li key={href} className="min-w-0">
            <Link
              href={href}
              className="flex min-h-16 items-center gap-3 rounded-2xl bg-muted px-4 transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block font-heading text-2xl leading-tight font-semibold tabular-nums">{count}</span>
                <span className="block truncate text-sm text-muted-foreground">{label}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Läuft bald ab: Vorrat mit Ablaufdatum in den nächsten Tagen oder schon abgelaufen. */
export function ExpiringWidget({ items, today }: { items: ExpiringItem[]; today: string }) {
  const shown = items.slice(0, 5);
  return (
    <section className={CARD}>
      <WidgetTitle icon={Hourglass} title="Läuft bald ab" aside={<AsideLink href="/einkauf/vorrat">Vorrat</AsideLink>} />
      {shown.length === 0 ? (
        <Empty>In den nächsten Tagen läuft nichts ab.</Empty>
      ) : (
        <ul className="divide-y">
          {shown.map((item) => (
            <li key={item.id} className="flex min-h-11 items-center justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate font-medium">{item.name}</span>
              <span className={cn("shrink-0 text-sm", item.status === "expired" ? "text-destructive" : "text-primary")}>
                {expiryLabel(item.expiresOn, today)}
              </span>
            </li>
          ))}
          {items.length > shown.length ? (
            <li className="pt-2 text-sm text-muted-foreground">+{items.length - shown.length} weitere</li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

/** Lange nicht gekocht: gut bewertete Rezepte, deren letztes Kochen lange her ist. */
export function LongNotCookedWidget({ items, weeks }: { items: LongAgoRecipe[]; weeks: number }) {
  return (
    <section className={CARD}>
      <WidgetTitle icon={Star} title="Lange nicht gekocht" />
      {items.length === 0 ? (
        <Empty>Alles, was dir geschmeckt hat, gab es in den letzten {weeks} Wochen.</Empty>
      ) : (
        <ul className="divide-y">
          {items.map((r) => (
            <li key={r.id}>
              <Link href={`/rezepte/${r.id}`} className="flex min-h-12 items-center justify-between gap-3 py-1.5 hover:underline">
                <span className="min-w-0 truncate font-medium">{r.title}</span>
                <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground tabular-nums">
                  vor {r.weeksAgo} Wo. · <Star className="size-3.5 fill-current text-macro-carbs" aria-hidden />
                  <span className="sr-only">Bewertung</span>
                  {formatNumber(r.avgRating, 1)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Training diese Woche: Anzahl und Dauer, Mo–So als Punkte, letztes Training. */
export function TrainingWidget({ sport, today }: { sport: SportSummary; today: string }) {
  const monday = mondayOf(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const trained = new Set(sport.week.map((w) => w.date));
  const seconds = sport.week.reduce(
    (sum, w) => sum + (w.endedAt ? Math.round((new Date(w.endedAt).getTime() - new Date(w.startedAt).getTime()) / 1000) : 0),
    0,
  );
  return (
    <section className={CARD}>
      <WidgetTitle icon={Dumbbell} title="Training diese Woche" aside={<AsideLink href="/sport/verlauf">Verlauf</AsideLink>} />
      <p className="flex items-baseline gap-2">
        <span className="font-heading text-4xl font-semibold tabular-nums">{sport.week.length}</span>
        <span className="text-muted-foreground">
          {sport.week.length === 1 ? "Training" : "Trainings"}
          {seconds > 0 ? ` · ${workoutDuration(seconds)}` : ""}
        </span>
      </p>
      <ol className="mt-3 grid grid-cols-7 gap-1.5" aria-label="Trainingstage dieser Woche">
        {days.map((d) => (
          <li key={d} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "grid size-8 place-items-center rounded-full text-xs font-medium",
                trained.has(d) ? "bg-sport text-sport-foreground" : "bg-muted text-muted-foreground",
                d === today && !trained.has(d) && "ring-2 ring-sport/50",
              )}
            >
              {weekdayShort(d).slice(0, 2)}
            </span>
            <span className="sr-only">{trained.has(d) ? "trainiert" : "nicht trainiert"}</span>
          </li>
        ))}
      </ol>
      {sport.last ? (
        <Link href={`/sport/verlauf/${sport.last.id}`} className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-muted px-3 py-2 transition hover:bg-accent">
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">Zuletzt · {weekdayShort(sport.last.date)}, {sport.last.date.slice(8, 10)}.{sport.last.date.slice(5, 7)}.</span>
            <span className="block truncate font-medium">{sport.last.title}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Noch kein Training. Starte eins über deine Pläne.</p>
      )}
    </section>
  );
}
