"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItemsFor, isActivePath, isEditorPath } from "./nav-items";
import { useArea } from "./use-area";

/** Navigation am unteren Rand, nur auf dem Handy (Essen & Trinken). */
export function BottomNav() {
  const pathname = usePathname();
  const area = useArea();
  // Im Rezept-Editor ersetzt die Speicherleiste die Navigation; die Startseite führt über ihre Kacheln weiter
  if (isEditorPath(pathname) || area === "start") return null;

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pr-[max(0.375rem,env(safe-area-inset-right))] pb-[env(safe-area-inset-bottom)] pl-[max(0.375rem,env(safe-area-inset-left))] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {navItemsFor(area).map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[0.68rem] leading-tight font-medium tracking-tight transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors",
                    active && "bg-primary/12",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
