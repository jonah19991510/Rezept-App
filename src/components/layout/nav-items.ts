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

export type NavItem = { href: string; label: string; icon: LucideIcon; /** weitere Seiten, bei denen der Punkt aktiv ist */ also?: string[] };

/** Hauptnavigation Essen & Trinken: höchstens fünf Punkte (SPEC „Navigation“). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/rezepte", label: "Rezepte", icon: BookOpen },
  { href: "/wochenplan", label: "Wochenplan", icon: CalendarDays },
  { href: "/einkauf", label: "Einkauf", icon: ShoppingBasket },
  { href: "/statistik", label: "Statistik", icon: ChartPie },
  { href: "/entdecken", label: "Entdecken", icon: Compass },
];

/** Hauptnavigation Sport & Gesundheit (Lexikon kommt später, bis dahin Platzhalterseite). */
export const SPORT_NAV_ITEMS: NavItem[] = [
  { href: "/sport/plaene", label: "Pläne", icon: ClipboardList, also: ["/sport/verlauf"] },
  { href: "/sport/getraenke", label: "Getränke", icon: GlassWater },
  { href: "/sport/statistik", label: "Statistik", icon: ChartLine },
  { href: "/sport/lexikon", label: "Lexikon", icon: BookOpenText },
  { href: "/sport/entdecken", label: "Entdecken", icon: Compass },
];

/** Untere Navigation der Startseite: zu den Bereichen. */
export const START_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Start", icon: House },
  { href: "/rezepte", label: "Ernährung", icon: Utensils },
  { href: "/sport/plaene", label: "Sport", icon: HeartPulse },
];

/** Navigation eines Bereichs. */
export function navItemsFor(area: AreaKey): NavItem[] {
  return area === "sport" ? SPORT_NAV_ITEMS : area === "start" ? START_NAV_ITEMS : NAV_ITEMS;
}

/** Ist der Navigationspunkt auf dieser Seite aktiv? */
export function isActiveItem(pathname: string, item: NavItem) {
  return [item.href, ...(item.also ?? [])].some((href) => isActivePath(pathname, href));
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
  { key: "food", label: "Essen & Trinken", href: "/rezepte", icon: Utensils, tile: { background: "var(--food)", color: "var(--food-foreground)" } },
  { key: "sport", label: "Sport & Gesundheit", href: "/sport/plaene", icon: HeartPulse, tile: { background: "var(--sport)", color: "var(--sport-foreground)" } },
];

/**
 * Seiten für alle Bereiche (Einstellungen, Nutzerverwaltung): Sie bleiben im Bereich, aus dem man kommt; von der
 * Startseite aus gehören sie zu „Start“ (Einstellungen beider Bereiche zusammen).
 */
const SHARED_PATHS = ["/einstellungen", "/admin"];

/** Parameter, mit dem gemeinsame Seiten ihren Bereich mitbekommen (`?bereich=sport` bzw. `?bereich=start`). */
export const AREA_PARAM = "bereich";

/**
 * Zu welchem Bereich eine Seite gehört. Alles außer Start und Sport ist Essen & Trinken; gemeinsame Seiten
 * gehören zum Bereich aus `?bereich=` (Sport oder Start, sonst Essen & Trinken).
 */
export function areaForPath(pathname: string, areaParam?: string | null): AreaKey {
  if (pathname === "/") return "start";
  if (isActivePath(pathname, "/sport")) return "sport";
  if (SHARED_PATHS.some((p) => isActivePath(pathname, p)) && (areaParam === "sport" || areaParam === "start")) return areaParam;
  return "food";
}

/** Link auf eine gemeinsame Seite, die im aktuellen Bereich bleiben soll, z. B. „/einstellungen?bereich=sport“. */
export function sharedHref(path: string, area: AreaKey): string {
  if (area === "food") return path;
  const [base, hash] = path.split("#");
  return `${base}?${AREA_PARAM}=${area}${hash ? `#${hash}` : ""}`;
}
