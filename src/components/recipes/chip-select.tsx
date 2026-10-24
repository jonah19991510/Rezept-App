"use client";

import { useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const chipClass = (active: boolean) =>
  cn(
    "relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0",
    active ? "border-primary/60 bg-primary/15 text-primary" : "bg-card text-foreground hover:bg-muted",
  );

/**
 * Auswahl als Chip mit der eingebauten Auswahlliste des Handys. Die native Auswahl liegt unsichtbar unter dem Chip,
 * nimmt aber keine Berührungen an (sonst schluckt sie am Handy das seitliche Wischen der Chip-Reihe). Ein Tipp auf
 * den Chip öffnet sie per showPicker() bzw. focus() (iOS öffnet die Auswahl beim Fokus aus einem Tipp heraus).
 */
export function ChipSelect({
  label,
  value,
  display,
  onChange,
  children,
}: {
  label: string;
  value: string;
  display: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const select = useRef<HTMLSelectElement>(null);

  function openPicker() {
    const el = select.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  }

  return (
    <div className="relative shrink-0">
      <button type="button" aria-label={value ? `${label}: ${display}` : label} onClick={openPicker} className={chipClass(value !== "")}>
        <span>{display}</span>
        <ChevronDown aria-hidden />
      </button>
      <select
        ref={select}
        tabIndex={-1}
        aria-hidden
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute inset-0 appearance-none opacity-0"
      >
        {children}
      </select>
    </div>
  );
}
