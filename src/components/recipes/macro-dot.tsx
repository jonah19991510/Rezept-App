import { cn } from "@/lib/utils";

const COLORS = {
  kcal: "bg-macro-kcal",
  protein: "bg-macro-protein",
  carbs: "bg-macro-carbs",
  fat: "bg-macro-fat",
} as const;

/** Farbiger Punkt als Kennung für einen Makro-Wert. Der Wert selbst steht in normaler Schriftfarbe. */
export function MacroDot({ macro, className }: { macro: keyof typeof COLORS; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", COLORS[macro], className)} aria-hidden />;
}
