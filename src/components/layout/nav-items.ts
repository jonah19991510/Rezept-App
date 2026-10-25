import { BookOpen, CalendarDays, ChartPie, Compass, ShoppingBasket, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Hauptnavigation: höchstens fünf Punkte (SPEC „Navigation“). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/rezepte", label: "Rezepte", icon: BookOpen },
  { href: "/wochenplan", label: "Wochenplan", icon: CalendarDays },
  { href: "/einkauf", label: "Einkauf", icon: ShoppingBasket },
  { href: "/statistik", label: "Statistik", icon: ChartPie },
  { href: "/entdecken", label: "Entdecken", icon: Compass },
];

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Rezept-Editor (neu/bearbeiten): ohne untere Navigation, am Handy ohne App-Kopf (eigene Leiste unten). */
export function isEditorPath(pathname: string) {
  return /^\/rezepte\/(neu|[^/]+\/bearbeiten)\/?$/.test(pathname);
}
