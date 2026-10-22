import Link from "next/link";
import { ChefHat, Martini } from "lucide-react";
import { cn } from "@/lib/utils";

/** Phase 15: Umschalter Küche | Bar (Rezepte, „Was kann ich kochen/mixen?“, Statistik), über die ganze Breite. */
export function KitchenBarSwitch({
  active,
  kitchenHref,
  barHref,
  className,
}: {
  active: "kitchen" | "bar";
  kitchenHref: string;
  barHref: string;
  className?: string;
}) {
  const items = [
    { key: "kitchen", href: kitchenHref, label: "Küche", icon: ChefHat },
    { key: "bar", href: barHref, label: "Bar", icon: Martini },
  ] as const;
  return (
    <nav className={cn("mb-5 grid w-full grid-cols-2 gap-1 rounded-full border bg-card p-1", className)} aria-label="Küche oder Bar">
      {items.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            key === active && "bg-primary text-primary-foreground shadow-sm hover:text-primary-foreground",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
