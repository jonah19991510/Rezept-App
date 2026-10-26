import Link from "next/link";
import { cn } from "@/lib/utils";

type Tab = "plaene" | "verlauf";

/** Unterseiten von „Pläne“ als Tab-Leiste mit Unterstrich (wie bei Einkauf): Pläne, Verlauf. */
export function SportTabs({ active }: { active: Tab }) {
  const tabs: { key: Tab; href: string; label: string }[] = [
    { key: "plaene", href: "/sport/plaene", label: "Pläne" },
    { key: "verlauf", href: "/sport/verlauf", label: "Verlauf" },
  ];
  return (
    <nav className="mb-5 flex border-b" aria-label="Training">
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
