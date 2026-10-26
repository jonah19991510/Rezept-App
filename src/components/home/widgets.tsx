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
  type LucideIcon,
} from "lucide-react";
import { AreaTile } from "@/components/layout/area-tile";
import { AREAS } from "@/components/layout/nav-items";
import { SLOT_TODAY, upcomingEntry } from "@/lib/domain/home";
import { expiryLabel } from "@/lib/domain/pantry";
import { SLOT_LABELS } from "@/lib/domain/plan";
import { hasAnyGoal } from "@/lib/domain/training";
import { formatNumber } from "@/lib/format";
import { addDays, mondayOf, weekdayShort } from "@/lib/domain/week";
import { workoutDuration } from "@/lib/domain/workout";
import type { ExpiringItem, LongAgoRecipe, SportSummary, TodayPlan } from "@/lib/server/home";
import { cn } from "@/lib/utils";

// Widgets der Startseite (Server-Komponenten). Anordnen und Ausblenden übernimmt HomeWidgets.

const CARD = "rounded-3xl border bg-card p-5 text-card-foreground md:p-6";
const LINK_CARD = cn(CARD, "block transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none");

const fmt = (n: number) => formatNumber(Math.round(n), 0);
const portions = (n: number) => `${formatNumber(n, 1)} ${n === 1 ? "Portion" : "Portionen"}`;

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

/** Heute: kcal laut Wochenplan gegen das Tagesziel, Trainingstag, Protein mit Balken. */
export function TodayWidget({ plan }: { plan: TodayPlan }) {
  const { totals, goals, training, entries } = plan;
  const proteinRest = goals.protein != null ? Math.round(goals.protein - totals.protein) : null;
  const proteinRatio = goals.protein ? Math.min(1, totals.protein / goals.protein) : 0;

  return (
    <Link href="/wochenplan" className={LINK_CARD} aria-label="Heute im Wochenplan öffnen">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <p className="flex items-baseline gap-2">
          <span className="font-heading text-4xl font-semibold tracking-tight tabular-nums">{fmt(totals.kcal)}</span>
          <span className="text-muted-foreground">{goals.kcal != null ? `von ${fmt(goals.kcal)} kcal` : "kcal geplant"}</span>
        </p>
        {training ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sport-soft px-3 py-1 text-sm font-medium text-sport">
            <Dumbbell className="size-4" aria-hidden />
            Trainingstag
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span className="font-medium">Protein</span>
          <span className="text-muted-foreground tabular-nums">
            {goals.protein != null ? (
              <>
                {fmt(totals.protein)} / {fmt(goals.protein)} g ·{" "}
                {proteinRest != null && proteinRest > 0 ? `noch ${fmt(proteinRest)} g` : "Ziel erreicht"}
              </>
            ) : (
              `${fmt(totals.protein)} g`
            )}
          </span>
        </div>
        {goals.protein ? (
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={`Protein: ${Math.round(proteinRatio * 100)} % vom Ziel`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(proteinRatio * 100)}
          >
            <div className="h-full rounded-full bg-macro-protein" style={{ width: `${proteinRatio * 100}%` }} />
          </div>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Für heute ist noch nichts geplant.</p>
      ) : !hasAnyGoal(goals) ? (
        <p className="mt-3 text-sm text-muted-foreground">Tagesziele legst du in den Einstellungen fest.</p>
      ) : null}
    </Link>
  );
}

type Tile = { href: string; label: string; icon: LucideIcon };

/** Bereichskarte: Kachel, Titel, Untertitel und vier Abkürzungen in den Bereich. */
function AreaCard({ areaKey, subtitle, tiles, tileClass }: { areaKey: "food" | "sport"; subtitle: string; tiles: Tile[]; tileClass: string }) {
  const area = AREAS.find((a) => a.key === areaKey)!;
  return (
    <section className={cn(CARD, "p-2.5 md:p-4")} aria-label={area.label}>
      <Link
        href={area.href}
        className="flex items-center gap-4 rounded-2xl p-2 transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <AreaTile area={area} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-2xl leading-tight font-semibold tracking-tight">{area.label}</span>
          <span className="block text-muted-foreground">{subtitle}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      <ul className="mt-2 grid grid-cols-2 gap-2.5 md:mt-3 md:gap-3">
        {tiles.map(({ href, label, icon: Icon }) => (
          <li key={label} className="min-w-0">
            <Link
              href={href}
              className={cn(
                "flex min-h-14 items-center gap-2.5 rounded-2xl px-3 font-medium transition-[filter] hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:gap-3 md:px-4 dark:hover:brightness-110",
                tileClass,
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Essen & Trinken: nächste Mahlzeit von heute, Abkürzungen zu Rezepten, Wochenplan, Einkauf und Bar. */
export function FoodAreaWidget({ plan, hour, shoppingCount }: { plan: TodayPlan | null; hour: number; shoppingCount: number | null }) {
  const next = plan ? upcomingEntry(plan.entries, hour) : null;
  const subtitle = next
    ? `${SLOT_TODAY[next.slot]}: ${next.recipeTitle} · ${portions(next.servings)}`
    : plan && plan.entries.length > 0
      ? "Für heute ist alles gegessen"
      : "Rezepte, Wochenplan, Einkauf und Bar";
  return (
    <AreaCard
      areaKey="food"
      subtitle={subtitle}
      tileClass="bg-primary/10 text-primary dark:bg-primary/15"
      tiles={[
        { href: "/rezepte", label: "Rezepte", icon: BookOpen },
        { href: "/wochenplan", label: "Wochenplan", icon: CalendarDays },
        { href: "/einkauf", label: shoppingCount ? `Einkauf · ${shoppingCount}` : "Einkauf", icon: ShoppingBasket },
        { href: "/rezepte/bar", label: "Bar", icon: Martini },
      ]}
    />
  );
}

const clock = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

/** Sport & Gesundheit: laufendes Training bzw. nächster Tag, Abkürzungen zu Plänen, Körper, Energie und Lexikon. */
export function SportAreaWidget({ sport }: { sport: SportSummary }) {
  const subtitle = sport.active
    ? `Training läuft seit ${clock.format(new Date(sport.active.startedAt))} Uhr`
    : sport.next
      ? `Als Nächstes: ${sport.next.dayName}${sport.next.focus ? ` · ${sport.next.focus}` : ""}`
      : sport.hasPlan
        ? "Dein Plan hat noch keine Tage"
        : "Leg deinen ersten Trainingsplan an";
  return (
    <AreaCard
      areaKey="sport"
      subtitle={subtitle}
      tileClass="bg-sport-soft text-sport"
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
              {e.available ? (
                <Link href={`/rezepte/${e.recipeId}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                  {e.recipeTitle}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.recipeTitle}</span>
              )}
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{formatNumber(e.servings, 1)} P.</span>
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
