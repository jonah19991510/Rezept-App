import Link from "next/link";
import { CookingPot } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ href = "/rezepte", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
        <CookingPot className="size-5" aria-hidden />
      </span>
      <span className="font-heading text-xl font-semibold tracking-tight">Rezeptbuch</span>
    </Link>
  );
}
