"use client";

import type { ReactNode } from "react";
import { Search, type LucideIcon } from "lucide-react";
import { chipClass } from "@/components/recipes/chip-select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Gemeinsame Bausteine der Listen-Seiten (Rezepte, Vorrat, Zutaten), damit alle gleich aussehen.

/** Suchfeld als Pille über die volle Breite. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** aria-label des Felds */
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-12 rounded-full pl-10"
      />
    </div>
  );
}

/**
 * Reihe aus Filter-Chips: am Handy seitlich wischbar (innerhalb der Seitenränder), ab Tablet umbrechend. Schrumpft
 * nicht und hat eine Mindesthöhe, sonst schneidet ein Flex-Elternteil die Chips unten ab.
 */
export function ChipRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-12 shrink-0 gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden",
        className,
      )}
      aria-label={label}
      role="group"
    >
      {children}
    </div>
  );
}

/** Filter-Chip mit Zähler-Bubble; aktiv mit Akzent-Rahmen, getönter Fläche und Zähler in Akzentfarbe. */
export function CountChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={chipClass(active)}>
      {children}
      <span
        className={cn(
          "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon: LucideIcon;
  /** Beschriftung neben dem Icon zeigen (sonst nur Icon mit aria-label) */
  showLabel?: boolean;
};

/** Kleiner Umschalter aus Knöpfen in einer Pille, z. B. Ansicht oder Sortierung über einer Liste. */
export function SegmentToggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex shrink-0 rounded-full border bg-card p-0.5" role="group" aria-label={label}>
      {options.map(({ value: v, label: l, icon: Icon, showLabel }) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          aria-label={showLabel ? undefined : l}
          title={l}
          onClick={() => onChange(v)}
          className={cn(
            "flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            showLabel ? "px-3.5" : "w-11",
            value === v && "bg-primary/15 text-primary hover:text-primary",
          )}
        >
          <Icon className="size-5 shrink-0" aria-hidden />
          {showLabel ? l : null}
        </button>
      ))}
    </div>
  );
}

/** Gruppen-Überschrift (Großbuchstaben, gesperrt, grau); im Vorrat als aufklappbarer Knopf. */
export const groupHeadingClass =
  "flex min-h-11 w-full items-center justify-between gap-3 px-1 text-left font-sans text-sm font-semibold tracking-wide text-muted-foreground uppercase";

/** Gruppen-Überschrift mit Angabe rechts (z. B. Anzahl). */
export function GroupHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <h2 className={groupHeadingClass}>
      <span className="truncate">{children}</span>
      {aside != null ? <span className="shrink-0 font-medium tabular-nums normal-case">{aside}</span> : null}
    </h2>
  );
}

/** Abgerundete Karte mit Listenzeilen, getrennt durch feine Linien. */
export function ListCard({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <ul id={id} className={cn("divide-y overflow-hidden rounded-2xl border bg-card", className)}>
      {children}
    </ul>
  );
}
