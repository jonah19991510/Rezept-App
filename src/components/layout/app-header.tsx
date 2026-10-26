"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AreaSwitcher } from "./area-switcher";
import { areaForPath, isEditorPath } from "./nav-items";

/**
 * Kopf mit Bereichs-Umschalter und Profil (children). Am Desktop steht der Umschalter in der Seitenleiste, nur auf der
 * Startseite (ohne Seitenleiste) im Kopf. Im Rezept-Editor am Handy ausgeblendet: dort hat der Editor einen eigenen Kopf.
 */
export function AppHeader({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const editor = isEditorPath(pathname);
  const start = areaForPath(pathname) === "start";
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center justify-between gap-3 bg-background/90 px-4 py-2 backdrop-blur md:px-8",
        !start && "md:justify-end",
        editor && "max-md:hidden",
      )}
    >
      <AreaSwitcher className={cn(!start && "md:hidden")} />
      {children}
    </header>
  );
}
