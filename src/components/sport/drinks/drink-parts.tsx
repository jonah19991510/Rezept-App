"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { clock, drinkColor, formatLiters, type DrinkEntry } from "@/lib/domain/drinks";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// Kleine Bausteine des Getränketrackers: Farbpunkt, Getränke-Chip, gestapelter Balken, Eintragsliste.

export function DrinkDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block size-3 shrink-0 rounded-full", className)} style={{ background: drinkColor(color) }} aria-hidden />;
}

/** Getränk als farbiger Chip; gewählt mit Rahmen und Fläche in der Farbe des Getränks. */
export function DrinkChip({ name, color, active, onClick, children }: { name: string; color: string; active: boolean; onClick: () => void; children?: ReactNode }) {
  const c = drinkColor(color);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active ? "border-2 px-[15px] font-semibold" : "bg-card hover:bg-muted",
      )}
      style={active ? { borderColor: c, background: `color-mix(in srgb, ${c} 16%, var(--card))` } : undefined}
    >
      <span className="size-3 shrink-0 rounded-full" style={{ background: c }} aria-hidden />
      {name}
      {children}
    </button>
  );
}

/** Waagrechter Balken, nach Getränk gestapelt; `max` = volle Breite (z. B. das Tagesziel). */
export function StackedBar({ parts, max, className }: { parts: { key: string; color: string; ml: number }[]; max: number; className?: string }) {
  const total = parts.reduce((s, p) => s + p.ml, 0);
  const scale = Math.max(max, total) || 1;
  return (
    <div className={cn("flex h-3 overflow-hidden rounded-full bg-muted", className)} aria-hidden>
      {parts.map((p) => (
        <span key={p.key} className="h-full border-r border-card last:border-r-0" style={{ width: `${(p.ml / scale) * 100}%`, background: drinkColor(p.color) }} />
      ))}
    </div>
  );
}

/** Einträge eines Tages: Uhrzeit, Getränk, Menge (antippen öffnet das Bearbeiten). */
export function EntryList({ entries, onSelect, empty }: { entries: DrinkEntry[]; onSelect?: (entry: DrinkEntry) => void; empty: ReactNode }) {
  if (entries.length === 0) return <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">{empty}</p>;
  const sorted = [...entries].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
      {sorted.map((e) => {
        const content = (
          <>
            <span className="w-12 shrink-0 text-sm text-muted-foreground tabular-nums">{clock(e.minutes)}</span>
            <DrinkDot color={e.color} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{e.name}</span>
              {e.caffeine > 0 || e.sugar > 0 ? (
                <span className="block truncate text-xs text-muted-foreground tabular-nums">
                  {[e.caffeine > 0 ? `${formatNumber(Math.round(e.caffeine), 0)} mg Koffein` : null, e.sugar > 0 ? `${formatNumber(e.sugar, 1)} g Zucker` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{formatLiters(e.ml)}</span>
            {onSelect ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
          </>
        );
        return (
          <li key={e.id}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(e)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">
                {content}
              </button>
            ) : (
              <div className="flex min-h-14 items-center gap-3 px-4 py-2">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
