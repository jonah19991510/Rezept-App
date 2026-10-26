import { BookOpen, CalendarDays, ChartPie, Compass, HeartPulse, House, ShoppingBasket, Utensils, type LucideIcon } from "lucide-react";

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

export type AreaKey = "start" | "food" | "sport";

export type Area = {
  key: AreaKey;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Farben der Kachel mit dem Symbol (CSS-Variablen; als Inline-Stil, damit Fokus-Farben im Menü sie nicht überdecken) */
  tile: { background: string; color: string };
  /** Bereich noch nicht gebaut: im Umschalter ausgegraut mit „Kommt bald“ */
  soon?: boolean;
};

/** Bereiche der App (26.10.2026): Startseite, Essen & Trinken (alles bisherige), Sport & Gesundheit (kommt bald). */
export const AREAS: Area[] = [
  { key: "start", label: "Start", href: "/", icon: House, tile: { background: "var(--foreground)", color: "var(--background)" } },
  { key: "food", label: "Essen & Trinken", href: "/rezepte", icon: Utensils, tile: { background: "var(--primary)", color: "var(--primary-foreground)" } },
  { key: "sport", label: "Sport & Gesundheit", href: "/sport", icon: HeartPulse, tile: { background: "var(--sport)", color: "var(--sport-foreground)" }, soon: true },
];

/** Zu welchem Bereich eine Seite gehört. Alles außer Start und Sport ist Essen & Trinken. */
export function areaForPath(pathname: string): AreaKey {
  if (pathname === "/") return "start";
  if (isActivePath(pathname, "/sport")) return "sport";
  return "food";
}
