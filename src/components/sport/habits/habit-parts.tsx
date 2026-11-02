"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Minus, Pill, Plus, Sparkles } from "lucide-react";
import { isActivePath } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { drinkColor } from "@/lib/domain/drinks";
import type { HabitKind } from "@/lib/domain/habits";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// Kleine Bausteine des Habit Trackers: Tabs, Symbol, Abhak-Knopf, Zähler.

const TABS = [
  { href: "/sport/habits", label: "Heute", exact: true },
  { href: "/sport/habits/wochenplan", label: "Wochenplan" },
  { href: "/sport/habits/statistik", label: "Statistik" },
  { href: "/sport/habits/liste", label: "Habits" },
];

/** Tabs mit Unterstrich (wie beim Getränketracker); am Handy seitlich wischbar, falls zu eng. */
export function HabitTabs() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 mb-5 flex overflow-x-auto border-b px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden" aria-label="Habit Tracker">
      {TABS.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : isActivePath(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-12 flex-1 items-center justify-center px-2.5 text-[0.95rem] font-medium whitespace-nowrap text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active && "font-semibold text-foreground after:absolute after:inset-x-1 after:-bottom-px after:h-[3px] after:rounded-full after:bg-primary",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Symbol in heller Fläche der Habit-Farbe: Funken für Gewohnheiten, Kapsel für Supplemente. */
export function HabitIcon({ kind, color, className }: { kind: HabitKind; color: string; className?: string }) {
  const c = drinkColor(color);
  const Icon = kind === "supplement" ? Pill : Sparkles;
  return (
    <span
      className={cn("grid size-10 shrink-0 place-items-center rounded-2xl", className)}
      style={{ background: `color-mix(in srgb, ${c} 16%, var(--card))`, color: c }}
      aria-hidden
    >
      <Icon className="size-5" />
    </span>
  );
}

/**
 * Runder Abhak-Knopf. Erledigt: Fläche in der Habit-Farbe mit Haken. Mehrmals am Tag: Ring füllt sich, Zahl in der
 * Mitte. `periodMet`: Woche/Monat schon geschafft (heute aber nicht abgehakt), dann leicht getönt.
 */
export function CheckButton({
  count,
  target,
  color,
  label,
  onClick,
  disabled,
  periodMet,
  size = "lg",
}: {
  count: number;
  target: number;
  color: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  periodMet?: boolean;
  size?: "md" | "lg";
}) {
  const c = drinkColor(color);
  const done = count >= target;
  const share = Math.min(1, count / target);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={done}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full transition active:scale-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
        size === "lg" ? "size-12" : "size-10",
      )}
      style={
        done
          ? { background: c, color: "white" }
          : {
              // Fortschritt als Ring (conic-gradient), innen Kartenfarbe
              background: `radial-gradient(closest-side, var(--card) calc(100% - 3px), transparent calc(100% - 2px)), conic-gradient(${c} ${share * 360}deg, color-mix(in srgb, ${c} ${periodMet ? 45 : 28}%, var(--card)) 0)`,
              color: c,
            }
      }
    >
      {done ? <Check className="size-6" strokeWidth={3} aria-hidden /> : target > 1 ? (
        <span className="text-xs font-semibold tabular-nums" aria-hidden>
          {count}/{target}
        </span>
      ) : periodMet ? (
        <Check className="size-5 opacity-60" aria-hidden />
      ) : null}
    </button>
  );
}

/** Zahl mit Minus/Plus (z. B. „3× pro Woche“). */
export function CountStepper({ value, min, max, onChange, unit, label }: { value: number; min: number; max: number; onChange: (v: number) => void; unit: string; label: string }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <Button type="button" variant="outline" size="icon-lg" className="rounded-full" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Einmal weniger">
        <Minus aria-hidden />
      </Button>
      <output className="min-w-28 text-center text-lg font-semibold tabular-nums" aria-live="polite">
        {value}× <span className="text-sm font-normal text-muted-foreground">{unit}</span>
      </output>
      <Button type="button" variant="outline" size="icon-lg" className="rounded-full" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Einmal mehr">
        <Plus aria-hidden />
      </Button>
    </div>
  );
}

/** „67 %“ */
export const percent = (share: number) => `${formatNumber(Math.round(share * 100), 0)} %`;
