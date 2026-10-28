"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  // Im Rezept- und Plan-Editor ersetzt die Speicherleiste die Navigation
  if (isEditorPath(pathname)) return null;

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-40 md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-center gap-1 rounded-full border bg-card/80 p-1.5 shadow-lg shadow-black/20 backdrop-blur-xl">
        {navItemsFor(area).map((item) => {
          const { href, label, icon: Icon } = item;
          const active = isActiveItem(pathname, item);
          return (
            <li key={href} className={cn("min-w-0", active ? "shrink-0" : "flex-1")}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
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
