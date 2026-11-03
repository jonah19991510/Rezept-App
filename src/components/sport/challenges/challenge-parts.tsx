import {
  Apple,
  Bike,
  BookOpen,
  Brain,
  CalendarRange,
  CandyOff,
  CigaretteOff,
  CircleCheckBig,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  History,
  Moon,
  ShieldAlert,
  Smartphone,
  Snowflake,
  Salad,
  Sparkles,
  Sun,
  Target,
  Trophy,
  Waves,
  WineOff,
  type LucideIcon,
} from "lucide-react";
import { drinkColor } from "@/lib/domain/drinks";
import type { ChallengePhase, ParticipationStatus, RuleLine } from "@/lib/domain/challenges";
import { dateLabel } from "@/lib/domain/challenges";
import { cn } from "@/lib/utils";

// Kleine Bausteine der Challenges: Symbol, Status, Fortschrittsbalken, Regel-Karte.

export const CHALLENGE_ICON_MAP: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  footprints: Footprints,
  bike: Bike,
  waves: Waves,
  flame: Flame,
  heart: Heart,
  droplet: Droplet,
  "wine-off": WineOff,
  "cigarette-off": CigaretteOff,
  "candy-off": CandyOff,
  apple: Apple,
  salad: Salad,
  moon: Moon,
  sun: Sun,
  brain: Brain,
  "book-open": BookOpen,
  smartphone: Smartphone,
  snowflake: Snowflake,
  target: Target,
  trophy: Trophy,
};

export const CHALLENGE_ICON_LABELS: Record<string, string> = {
  dumbbell: "Hantel",
  footprints: "Laufen",
  bike: "Rad",
  waves: "Schwimmen",
  flame: "Flamme",
  heart: "Herz",
  droplet: "Wasser",
  "wine-off": "Kein Alkohol",
  "cigarette-off": "Nicht rauchen",
  "candy-off": "Keine Süßigkeiten",
  apple: "Apfel",
  salad: "Salat",
  moon: "Schlaf",
  sun: "Sonne",
  brain: "Kopf",
  "book-open": "Lesen",
  smartphone: "Handy",
  snowflake: "Kälte",
  target: "Ziel",
  trophy: "Pokal",
};

/** Symbol in heller Fläche der Challenge-Farbe. */
export function ChallengeIcon({ icon, color, size = "md", className }: { icon: string; color: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const c = drinkColor(color);
  const Icon = CHALLENGE_ICON_MAP[icon] ?? Trophy;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center",
        size === "sm" && "size-9 rounded-xl",
        size === "md" && "size-12 rounded-2xl",
        size === "lg" && "size-16 rounded-3xl",
        className,
      )}
      style={{ background: `color-mix(in srgb, ${c} 16%, var(--card))`, color: c }}
      aria-hidden
    >
      <Icon className={size === "lg" ? "size-8" : size === "md" ? "size-6" : "size-5"} />
    </span>
  );
}

const STATUS_TONE: Record<ParticipationStatus, string> = {
  upcoming: "bg-muted text-muted-foreground",
  active: "bg-sport-soft text-sport",
  completed: "bg-sage/15 text-sage",
  failed: "bg-destructive/10 text-destructive",
  ended: "bg-muted text-muted-foreground",
};

/** Kleines Status-Label der eigenen Teilnahme. */
export function StatusPill({ status, children }: { status: ParticipationStatus; children: React.ReactNode }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_TONE[status])}>{children}</span>;
}

/** Wann die Challenge läuft: „Startet in 3 Tagen“, „Tag 5 von 30“, „Vorbei“, „Start jederzeit“. */
export function phaseLabel(phase: ChallengePhase): string {
  switch (phase.kind) {
    case "upcoming":
      return phase.daysUntil === 1 ? "Startet morgen" : phase.daysUntil === 0 ? "Startet heute" : `Startet am ${dateLabel(phase.startsOn)}`;
    case "running":
      return `Läuft · Tag ${phase.day} von ${phase.of}`;
    case "over":
      return `Vorbei seit ${dateLabel(phase.endedOn)}`;
    default:
      return "Start jederzeit";
  }
}

/** Fortschrittsbalken in der Challenge-Farbe. */
export function ProgressBar({ share, color, label }: { share: number; color: string; label: string }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(share > 0 ? 4 : 0, share * 100)}%`, background: drinkColor(color) }} />
    </div>
  );
}

const RULE_ICONS: Record<RuleLine["key"], LucideIcon> = {
  goal: Target,
  time: CalendarRange,
  missed: ShieldAlert,
  done: CircleCheckBig,
  backfill: History,
  points: Sparkles,
};

/** Regel-Karte: jede Regel als Zeile mit Symbol, Überschrift und Klartext. */
export function RuleCard({ lines, className, title = "Regeln" }: { lines: RuleLine[]; className?: string; title?: string }) {
  return (
    <section className={cn("rounded-3xl border bg-card p-4 md:p-5", className)} aria-label={title}>
      <h2 className="mb-3 font-heading text-xl font-semibold">{title}</h2>
      <ul className="space-y-3">
        {lines.map((l) => {
          const Icon = RULE_ICONS[l.key];
          return (
            <li key={l.key} className="flex gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground" aria-hidden>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{l.title}</span>
                <span className="block text-sm text-muted-foreground">{l.text}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
