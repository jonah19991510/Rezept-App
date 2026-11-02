import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Bausteine der Startseiten-Widgets (Karte, Kopfzeile, Link rechts, Leertext); auch für Client-Widgets.

export const CARD = "rounded-3xl border bg-card p-5 text-card-foreground md:p-6";
export const LINK_CARD = cn(CARD, "block transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none");

/** Kopfzeile kleiner Widgets: Symbol, Titel und rechts ein Hinweis oder Link. */
export function WidgetTitle({ icon: Icon, title, aside }: { icon: LucideIcon; title: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-2 font-sans text-base font-semibold tracking-normal">
        <Icon className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{title}</span>
      </h2>
      {aside}
    </div>
  );
}

export function AsideLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-lg text-sm font-medium text-primary hover:underline">
      {children}
      <ChevronRight className="size-4" aria-hidden />
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
