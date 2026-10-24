import Link from "next/link";
import { ChefHat, Martini } from "lucide-react";
import { cn } from "@/lib/utils";

type Area = "kitchen" | "bar";

/**
 * Phase 15: Umschalter Küche | Bar (Rezepte, „Was kann ich kochen/mixen?“, Statistik, Vorrat), über die ganze Breite.
 * Mit Links (hrefs) oder, im Vorrat, als Knöpfe ohne Seitenwechsel (onSelect). counts zeigt z. B. „71 / 96“.
 */
export function KitchenBarSwitch({
  active,
  kitchenHref,
  barHref,
  onSelect,
  counts,
  className,
}: {
  active: Area;
  className?: string;
  counts?: Record<Area, string>;
} & ({ kitchenHref: string; barHref: string; onSelect?: never } | { onSelect: (area: Area) => void; kitchenHref?: never; barHref?: never })) {
  const items = [
    { key: "kitchen", href: kitchenHref, label: "Küche", icon: ChefHat },
    { key: "bar", href: barHref, label: "Bar", icon: Martini },
  ] as const;
  // Knöpfe sind keine Navigation, sondern eine Auswahl
  const Wrapper = onSelect ? "div" : "nav";
  return (
    <Wrapper
      role={onSelect ? "group" : undefined}
      className={cn("mb-5 grid w-full grid-cols-2 gap-1 rounded-full border bg-card p-1", className)}
      aria-label="Küche oder Bar"
    >
      {items.map(({ key, href, label, icon: Icon }) => {
        const itemClass = cn(
          "flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          key === active && "bg-primary text-primary-foreground shadow-sm hover:text-primary-foreground",
        );
        const content = (
          <>
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
            {counts ? <span className="text-xs font-normal tabular-nums opacity-75">{counts[key]}</span> : null}
          </>
        );
        return onSelect ? (
          <button key={key} type="button" aria-pressed={key === active} onClick={() => onSelect(key)} className={itemClass}>
            {content}
          </button>
        ) : (
          <Link key={key} href={href!} aria-current={key === active ? "page" : undefined} className={itemClass}>
            {content}
          </Link>
        );
      })}
    </Wrapper>
  );
}
