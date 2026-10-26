import { cn } from "@/lib/utils";
import type { Area } from "./nav-items";

/** Farbige Kachel mit dem Symbol eines Bereichs (Umschalter, Startseite). */
export function AreaTile({ area, size = "md", className }: { area: Area; size?: "sm" | "md" | "lg"; className?: string }) {
  const Icon = area.icon;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center",
        size === "lg" ? "size-14 rounded-[1.1rem]" : size === "md" ? "size-11 rounded-[0.85rem]" : "size-9 rounded-[0.7rem]",
        className,
      )}
      style={{ background: area.tile.background }}
    >
      <Icon className={size === "lg" ? "size-7" : size === "md" ? "size-6" : "size-5"} style={{ color: area.tile.color, stroke: area.tile.color }} aria-hidden />
    </span>
  );
}
