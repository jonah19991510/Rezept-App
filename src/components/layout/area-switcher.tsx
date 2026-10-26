"use client";

import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AreaTile } from "./area-tile";
import { AREAS } from "./nav-items";
import { useArea } from "./use-area";

/**
 * Umschalter oben links: zeigt den aktuellen Bereich (Start, Essen & Trinken, Sport & Gesundheit) und klappt die
 * Liste der Bereiche auf. Sport ist noch nicht gebaut und steht ausgegraut mit „Kommt bald“ darin.
 */
/** compact: schmalere Fassung für die Seitenleiste am Desktop. */
export function AreaSwitcher({ compact = false, className }: { compact?: boolean; className?: string }) {
  const key = useArea();
  const current = AREAS.find((a) => a.key === key) ?? AREAS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "-ml-1 inline-flex min-h-12 min-w-0 items-center gap-3 rounded-2xl py-1 pr-2 pl-1 text-left transition-colors hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-popup-open:bg-accent/60",
          className,
        )}
        aria-label={`Bereich: ${current.label}. Bereich wechseln`}
      >
        <AreaTile area={current} size={compact ? "sm" : "md"} />
        <span className={cn("truncate font-heading font-semibold tracking-tight", compact ? "flex-1 text-lg" : "text-2xl")}>
          {current.label}
        </span>
        <ChevronDown className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 rounded-2xl p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2.5">Bereich wechseln</DropdownMenuLabel>
          {AREAS.map((area) => {
            const active = area.key === current.key;
            const content = (
              <>
                <AreaTile area={area} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium">{area.label}</span>
                  {area.soon ? <span className="block text-xs text-muted-foreground">Kommt bald</span> : null}
                </span>
                {active ? <Check className="text-primary" aria-hidden /> : null}
              </>
            );
            return area.soon ? (
              <DropdownMenuItem key={area.key} disabled className="min-h-13 gap-3 rounded-xl px-2 data-disabled:opacity-60">
                {content}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                key={area.key}
                className="min-h-13 gap-3 rounded-xl px-2"
                render={<Link href={area.href} aria-current={active ? "page" : undefined} />}
              >
                {content}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
