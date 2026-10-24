import Link from "next/link";
import { cn } from "@/lib/utils";

type Tab = "liste" | "vorrat" | "kochen";

/**
 * Unterseiten von „Einkauf“ als Tab-Leiste mit Unterstrich: Einkaufsliste, Vorratsschrank, „Was kann ich kochen?“.
 * In der Bar heißt der dritte Tab „Was mixen?“ und der Vorrat öffnet direkt die Bar.
 */
export function ShoppingTabs({ active, bar = false }: { active: Tab; bar?: boolean }) {
  const tabs: { key: Tab; href: string; label: string }[] = [
    { key: "liste", href: "/einkauf", label: "Liste" },
    { key: "vorrat", href: bar ? "/einkauf/vorrat?bereich=bar" : "/einkauf/vorrat", label: "Vorrat" },
    { key: "kochen", href: bar ? "/einkauf/was-mixen" : "/einkauf/was-kochen", label: bar ? "Was mixen?" : "Was kochen?" },
  ];
  return (
    <nav className="mb-5 flex border-b" aria-label="Einkauf">
      {tabs.map(({ key, href, label }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            "relative flex min-h-12 flex-1 items-center justify-center px-2 text-base font-medium whitespace-nowrap text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            key === active && "font-semibold text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:rounded-full after:bg-primary",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
