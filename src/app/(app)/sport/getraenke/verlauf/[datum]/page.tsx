import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayDetail } from "@/components/sport/drinks/day-detail";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { addDays, isIsoDate, todayInBerlin } from "@/lib/domain/week";
import { getDrinkEntries, getDrinkSetup } from "@/lib/server/drinks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Getränke an einem Tag" };

const arrow = cn(buttonVariants({ variant: "ghost", size: "icon" }));

/** Ein Tag aus dem Verlauf mit allen Einträgen; Pfeile blättern Tag für Tag. */
export default async function DrinkDayPage({ params }: PageProps<"/sport/getraenke/verlauf/[datum]">) {
  const user = await requireUser();
  const { datum } = await params;
  const today = todayInBerlin();
  if (!isIsoDate(datum) || datum > today) notFound();
  const [{ goalMl, drinks }, entries] = await Promise.all([getDrinkSetup(user.id), getDrinkEntries(user.id, datum, datum)]);

  return (
    <div className="space-y-4">
      <Link href="/sport/getraenke/verlauf" className="inline-flex min-h-10 items-center gap-1 rounded-full bg-muted pr-4 pl-2.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <ChevronLeft className="size-4" aria-hidden />
        Zum Verlauf
      </Link>
      <DayDetail
        key={datum}
        date={datum}
        entries={entries}
        goalMl={goalMl}
        drinks={drinks}
        today={today}
        prev={
          <Link href={`/sport/getraenke/verlauf/${addDays(datum, -1)}`} className={arrow} aria-label="Tag davor">
            <ChevronLeft aria-hidden />
          </Link>
        }
        next={
          datum < today ? (
            <Link href={`/sport/getraenke/verlauf/${addDays(datum, 1)}`} className={arrow} aria-label="Tag danach">
              <ChevronRight aria-hidden />
            </Link>
          ) : (
            <span className="size-11" aria-hidden />
          )
        }
      />
    </div>
  );
}
