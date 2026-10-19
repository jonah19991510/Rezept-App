import Link from "next/link";
import { ChefHat, ListChecks, Refrigerator } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/einkauf", label: "Liste", icon: ListChecks },
  { href: "/einkauf/vorrat", label: "Vorrat", icon: Refrigerator },
  { href: "/einkauf/was-kochen", label: "Was kochen?", icon: ChefHat },
] as const;

/** Unterseiten von „Einkauf“: Einkaufsliste, Vorratsschrank, „Was kann ich kochen?“. */
export function ShoppingTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav className="mb-6 grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1" aria-label="Einkauf">
      {TABS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={href === active ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            href === active && "bg-card text-foreground shadow-sm",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
