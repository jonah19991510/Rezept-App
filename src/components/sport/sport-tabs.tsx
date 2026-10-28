import Link from "next/link";
import { cn } from "@/lib/utils";

type Tab = "plaene" | "verlauf";

/** Unterseiten von „Pläne“ als runder Umschalter (wie Küche | Bar, aktiv aber hell statt im Bereichs-Akzent). */
export function SportTabs({ active }: { active: Tab }) {
  const tabs: { key: Tab; href: string; label: string }[] = [
    { key: "plaene", href: "/sport/plaene", label: "Pläne" },
    { key: "verlauf", href: "/sport/verlauf", label: "Verlauf" },
  ];
  return (
    <nav className="mb-5 grid w-full grid-cols-2 gap-1 rounded-full border bg-card p-1" aria-label="Training">
      {tabs.map(({ key, href, label }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 items-center justify-center rounded-full px-4 text-sm font-medium whitespace-nowrap text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            key === active && "bg-foreground text-background shadow-sm hover:text-background",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
