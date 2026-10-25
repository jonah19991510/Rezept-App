"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isEditorPath } from "./nav-items";

/** Kopf mit Logo (Handy) und Profil. Im Rezept-Editor am Handy ausgeblendet: dort hat der Editor einen eigenen Kopf. */
export function AppHeader({ children }: { children: ReactNode }) {
  const editor = isEditorPath(usePathname());
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center justify-between gap-3 bg-background/90 px-4 py-2 backdrop-blur md:justify-end md:px-8",
        editor && "max-md:hidden",
      )}
    >
      {children}
    </header>
  );
}
