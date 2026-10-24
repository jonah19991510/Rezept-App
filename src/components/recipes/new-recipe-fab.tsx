import Link from "next/link";
import { Plus } from "lucide-react";

/** Schwebender runder Knopf unten rechts (am Handy über der unteren Navigation); auch für „Zutat hinzufügen“ im Vorrat. */
export const fabClass =
  "fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90 focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 md:right-8 md:bottom-8";

/** Schwebender Knopf unten rechts zum Anlegen (am Handy über der unteren Navigation). */
export function NewRecipeFab({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} title={label} className={fabClass}>
      <Plus className="size-7" aria-hidden />
    </Link>
  );
}

/** Derselbe Knopf ohne Seitenwechsel, z. B. für einen Dialog (Vorrat, Zutaten). */
export function FabButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={fabClass}>
      <Plus className="size-7" aria-hidden />
    </button>
  );
}
