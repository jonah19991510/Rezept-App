import Link from "next/link";
import { ChevronRight, Timer } from "lucide-react";
import type { ActiveWorkout } from "@/lib/server/workouts";

const time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

/** Hinweis „Training läuft“ mit Link zurück ins Training. */
export function ActiveWorkoutBanner({ workout }: { workout: ActiveWorkout }) {
  return (
    <Link
      href={`/training/${workout.id}`}
      className="mb-5 flex items-center gap-3 rounded-3xl bg-sport px-4 py-3 text-sport-foreground transition hover:brightness-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Timer className="size-6 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Training läuft</span>
        <span className="block truncate text-sm opacity-90">
          {workout.title} · seit {time.format(new Date(workout.startedAt))} Uhr
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-sm font-medium">
        Fortsetzen
        <ChevronRight className="size-4" aria-hidden />
      </span>
    </Link>
  );
}
