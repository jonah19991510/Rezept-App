"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AREA_PARAM, areaForPath, type AreaKey } from "./nav-items";

/** Bereich der aktuellen Seite (gemeinsame Seiten wie die Einstellungen über `?bereich=`). */
export function useArea(): AreaKey {
  return areaForPath(usePathname(), useSearchParams().get(AREA_PARAM));
}
