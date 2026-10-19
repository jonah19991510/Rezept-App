import { Dumbbell, Leaf, Salad, Wheat, Boxes } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AUTO_TAG_LABELS, type AutoTag } from "@/lib/labels";
import { cn } from "@/lib/utils";

const AUTO_TAG_ICONS: Record<AutoTag, LucideIcon> = {
  high_protein: Dumbbell,
  vegetarian: Salad,
  vegan: Leaf,
  low_carb: Wheat,
  meal_prep: Boxes,
};

/** Auto-Tags (berechnet) in Salbei, eigene Tags neutral. */
export function RecipeTags({ autoTags, tags = [], className }: { autoTags: AutoTag[]; tags?: string[]; className?: string }) {
  if (autoTags.length === 0 && tags.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Tags">
      {autoTags.map((tag) => {
        const Icon = AUTO_TAG_ICONS[tag];
        return (
          <li
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-sage/15 px-2.5 py-1 text-xs font-medium text-foreground"
          >
            <Icon className="size-3.5 text-sage" aria-hidden />
            {AUTO_TAG_LABELS[tag]}
          </li>
        );
      })}
      {tags.map((tag) => (
        <li key={tag} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
          {tag}
        </li>
      ))}
    </ul>
  );
}
