"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { isActivePath } from "@/components/layout/nav-items";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Status } from "@/lib/domain/blood";
import type { Verdict } from "@/lib/domain/supplements";
import { cn } from "@/lib/utils";

// Gemeinsame Bausteine von Supplemente & Blutwerte und Medizin & Vorsorge.

export type Tab = { href: string; label: string; exact?: boolean };

/** Tabs mit Unterstrich (wie bei den Getränken); am Handy seitlich wischbar, falls zu eng. */
export function RouteTabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 mb-5 flex overflow-x-auto border-b px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden" aria-label={label}>
      {tabs.map(({ href, label: text, exact }) => {
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
            {text}
          </Link>
        );
      })}
    </nav>
  );
}

/** Schwebender Knopf unten rechts (über der unteren Leiste) plus Platzhalter am Seitenende. */
export function Fab({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] z-30 inline-flex h-14 items-center gap-2 rounded-full bg-sport px-5 font-semibold text-sport-foreground shadow-lg transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 md:right-8 md:bottom-8"
      >
        <Plus className="size-5" aria-hidden />
        {children}
      </button>
      <div className="h-20" aria-hidden />
    </>
  );
}

/** Kleine Überschrift über einem Abschnitt. */
export function SectionTitle({ id, children, aside }: { id?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {children}
      </h2>
      {aside ? <span className="text-xs text-muted-foreground">{aside}</span> : null}
    </div>
  );
}

export type Tone = "good" | "warn" | "bad" | "neutral" | "info";

const TONE: Record<Tone, string> = {
  good: "bg-sport-soft text-sport",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  bad: "bg-destructive/12 text-destructive",
  neutral: "bg-muted text-muted-foreground",
  info: "bg-primary/12 text-primary",
};

/** Abzeichen in einer Ampelfarbe. */
export function ToneBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", TONE[tone], className)}>{children}</span>;
}

/** Ampelfarbe zum Ergebnis eines Supplement-Abgleichs. */
const VERDICT_TONE: Record<Verdict, Tone> = { zu_viel: "bad", ueber_bfr: "warn", passt: "good", unter: "neutral", ohne: "neutral" };
export const verdictTone = (v: Verdict): Tone => VERDICT_TONE[v];

/** Ampelfarbe zum Status eines Blutwerts. */
export const statusTone = (s: Status): Tone => (s === "normal" ? "good" : s === "unbekannt" ? "neutral" : "warn");

/** Textfarbe einer Ampelfarbe (für Zahlen). */
export const toneText = (tone: Tone) =>
  ({ good: "text-sport", warn: "text-amber-700 dark:text-amber-300", bad: "text-destructive", neutral: "text-muted-foreground", info: "text-primary" })[tone];

/** Hinweis „ersetzt keine ärztliche Beratung“. */
export function MedicalNote({ children }: { children?: ReactNode }) {
  return (
    <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
      {children ?? "Orientierungswerte, keine ärztliche Beratung. Bei Fragen zu Dosierung, Blutwerten oder Beschwerden bitte ärztlich abklären."}
    </p>
  );
}

/** Feld mit Beschriftung und Fehlermeldung. */
export function Field({ id, label, error, children, className }: { id: string; label: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

/** Eingabe mit Einheit rechts im Feld. */
export function UnitInput({ unit, className, ...props }: React.ComponentProps<typeof Input> & { unit: string }) {
  return (
    <div className="relative">
      <Input {...props} className={cn("h-12 pr-12 text-base tabular-nums", className)} />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span>
    </div>
  );
}

/** Kachel mit Kennzahl. */
export function StatTile({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl border bg-card p-4", className)}>
      <span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="mt-0.5 block font-heading text-3xl font-semibold tabular-nums">{value}</span>
      {sub ? <span className="block text-sm text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

/** Datum lang: „Mi., 11. Nov. 2026“. */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Datum kurz: „11.11.26“. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

export const euro = (v: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
