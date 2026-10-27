"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/sport/getraenke", label: "Heute", exact: true },
  { href: "/sport/getraenke/statistik", label: "Statistik" },
  { href: "/sport/getraenke/tipps", label: "Tipps" },
  { href: "/sport/getraenke/verlauf", label: "Verlauf" },
  { href: "/sport/getraenke/liste", label: "Getränke" },
];

/** Tabs des Getränketrackers mit Unterstrich (wie bei Pläne/Verlauf); am Handy seitlich wischbar, falls zu eng. */
export function DrinkTabs() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 mb-5 flex overflow-x-auto border-b px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden" aria-label="Getränke">
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
