"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AreaSwitcher } from "./area-switcher";
import { areaForPath, navItemsFor, isActivePath } from "./nav-items";

/** Seitenleiste am Desktop (ab md), oben der Bereichs-Umschalter. Die Startseite hat keine. */
export function Sidebar() {
  const pathname = usePathname();
  if (areaForPath(pathname) === "start") return null;

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r bg-sidebar px-4 py-6 text-sidebar-foreground md:flex">
      <AreaSwitcher compact className="ml-0 w-full" />
      <nav aria-label="Hauptnavigation">
        <ul className="grid gap-1">
          {navItemsFor(pathname).map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                  )}
                >
                  <Icon className={cn("size-5", active && "text-primary")} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
