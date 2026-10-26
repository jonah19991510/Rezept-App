import {
  BookOpen,
  BookOpenText,
  CalendarDays,
  ChartLine,
  ChartPie,
  ClipboardList,
  Compass,
  GlassWater,
  HeartPulse,
  House,
  ShoppingBasket,
  Utensils,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Hauptnavigation Essen & Trinken: höchstens fünf Punkte (SPEC „Navigation“). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/rezepte", label: "Rezepte", icon: BookOpen },
  { href: "/wochenplan", label: "Wochenplan", icon: CalendarDays },
  { href: "/einkauf", label: "Einkauf", icon: ShoppingBasket },
  { href: "/statistik", label: "Statistik", icon: ChartPie },
  { href: "/entdecken", label: "Entdecken", icon: Compass },
];

/** Hauptnavigation Sport & Gesundheit (Getränke und Lexikon kommen später, bis dahin Platzhalterseiten). */
export const SPORT_NAV_ITEMS: NavItem[] = [
  { href: "/sport/plaene", label: "Pläne", icon: ClipboardList },
  { href: "/sport/getraenke", label: "Getränke", icon: GlassWater },
  { href: "/sport/statistik", label: "Statistik", icon: ChartLine },
  { href: "/sport/lexikon", label: "Lexikon", icon: BookOpenText },
  { href: "/sport/entdecken", label: "Entdecken", icon: Compass },
];

/** Navigation des Bereichs, zu dem die Seite gehört. */
export function navItemsFor(pathname: string): NavItem[] {
  return areaForPath(pathname) === "sport" ? SPORT_NAV_ITEMS : NAV_ITEMS;
}

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Rezept- und Plan-Editor (neu/bearbeiten): ohne untere Navigation, am Handy ohne App-Kopf (eigene Leiste unten). */
export function isEditorPath(pathname: string) {
  return /^\/(rezepte|sport\/plaene)\/(neu|[^/]+\/bearbeiten)\/?$/.test(pathname);
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

/** Bereiche der App (26.10.2026): Startseite, Essen & Trinken (alles bisherige), Sport & Gesundheit (ab Phase S1). */
export const AREAS: Area[] = [
  { key: "start", label: "Start", href: "/", icon: House, tile: { background: "var(--foreground)", color: "var(--background)" } },
  { key: "food", label: "Essen & Trinken", href: "/rezepte", icon: Utensils, tile: { background: "var(--primary)", color: "var(--primary-foreground)" } },
  { key: "sport", label: "Sport & Gesundheit", href: "/sport/plaene", icon: HeartPulse, tile: { background: "var(--sport)", color: "var(--sport-foreground)" } },
];

/** Zu welchem Bereich eine Seite gehört. Alles außer Start und Sport ist Essen & Trinken. */
export function areaForPath(pathname: string): AreaKey {
  if (pathname === "/") return "start";
  if (isActivePath(pathname, "/sport")) return "sport";
  return "food";
}
