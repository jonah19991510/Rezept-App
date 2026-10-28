"use client";

import { useEffect, type ReactNode } from "react";
import { useArea } from "./use-area";

/**
 * Setzt `data-area` für den Bereichs-Akzent (globals.css: Sport färbt `primary` in Petrol). Am Wrapper gilt es schon
 * beim ersten Rendern, an `<html>` auch für Dialoge und Menüs, die außerhalb des Layouts eingehängt werden.
 */
export function AreaTheme({ children }: { children: ReactNode }) {
  const area = useArea();
  useEffect(() => {
    document.documentElement.dataset.area = area;
    return () => {
      delete document.documentElement.dataset.area;
    };
  }, [area]);
  return (
    <div data-area={area} className="contents">
      {children}
    </div>
  );
}
