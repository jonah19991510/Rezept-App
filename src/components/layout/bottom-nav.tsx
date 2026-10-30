"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { navItemsFor, isActiveItem, isEditorPath } from "./nav-items";
import { useArea } from "./use-area";

/**
 * Schwebende Navigation am unteren Rand, nur auf dem Handy, in jedem Bereich (auf der Startseite: Start, Ernährung,
 * Sport). Inaktive Punkte zeigen nur ihr Symbol, der aktive dazu seinen Namen in einer hellen Pille.
 */
export function BottomNav() {
  const pathname = usePathname();
  const area = useArea();
  // Angetippter Punkt, solange die neue Seite noch lädt: Die Pille springt sofort um statt erst, wenn der Server
  // geantwortet hat. Gilt nur, solange wir noch auf der Seite sind, von der aus getippt wurde.
  const [tapped, setTapped] = useState<{ href: string; from: string } | null>(null);
  const target = tapped?.from === pathname ? tapped.href : null;
  // Im Rezept- und Plan-Editor ersetzt die Speicherleiste die Navigation
  if (isEditorPath(pathname)) return null;

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-40 md:hidden"
    >
      {/* Weichzeichner bewusst mäßig: ein starker Blur muss bei jedem Seitenwechsel neu gerechnet werden (iOS) */}
      <ul className="mx-auto flex max-w-lg items-center gap-1 rounded-full border bg-card/90 p-1.5 shadow-lg shadow-black/20 backdrop-blur-md">
        {navItemsFor(area).map((item) => {
          const { href, label, icon: Icon } = item;
          const active = target ? href === target : isActiveItem(pathname, item);
          return (
            <li key={href} className={cn("min-w-0", active ? "shrink-0" : "flex-1")}>
              <Link
                href={href}
                // Ganze Seite samt Daten im Hintergrund vorladen, damit der Tab beim Antippen sofort fertig ist
                // (sonst nur bis zum Lade-Skelett). Wie lange das gilt: `staleTimes` in next.config.ts.
                prefetch
                onClick={() => setTapped({ href, from: pathname })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-[color,background-color,transform] active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active ? "bg-foreground px-5 text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className={active ? "whitespace-nowrap" : "sr-only"}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
