"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { useTheme } from "next-themes";
import { Calculator, Carrot, Euro, LogOut, Monitor, Moon, Ruler, Scale, Settings, ShieldCheck, Sun } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/initials";
import { areaForPath } from "./nav-items";

const ITEM = "min-h-11 gap-2.5 px-2.5";

/**
 * Profilmenü oben rechts: Einstellungen, je Bereich die passenden Werkzeuge (Essen & Trinken: Zutaten, Preise, Umrechner;
 * Sport: Körpermaße, Energiebedarf), Admin (nur Admins), Darstellung, Abmelden.
 */
export function UserMenu({ displayName, isAdmin }: { displayName: string; isAdmin: boolean }) {
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const area = areaForPath(usePathname());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Profilmenü öffnen" />}
      >
        <Avatar size="lg">
          <AvatarFallback className="bg-accent font-medium text-accent-foreground">{initials(displayName)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2.5 py-2 text-sm text-foreground">{displayName}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={ITEM} render={<Link href="/einstellungen" />}>
          <Settings aria-hidden />
          Einstellungen
        </DropdownMenuItem>
        {area === "food" ? (
          <>
            <DropdownMenuItem className={ITEM} render={<Link href="/zutaten" />}>
              <Carrot aria-hidden />
              Zutaten
            </DropdownMenuItem>
            <DropdownMenuItem className={ITEM} render={<Link href="/preise" />}>
              <Euro aria-hidden />
              Preise
            </DropdownMenuItem>
            <DropdownMenuItem className={ITEM} render={<Link href="/umrechner" />}>
              <Scale aria-hidden />
              Einheiten-Umrechner
            </DropdownMenuItem>
          </>
        ) : null}
        {area === "sport" ? (
          <>
            <DropdownMenuItem className={ITEM} render={<Link href="/sport/koerper" />}>
              <Ruler aria-hidden />
              Körpermaße
            </DropdownMenuItem>
            <DropdownMenuItem className={ITEM} render={<Link href="/sport/energie" />}>
              <Calculator aria-hidden />
              Energiebedarfsrechner
            </DropdownMenuItem>
          </>
        ) : null}
        {isAdmin ? (
          <DropdownMenuItem className={ITEM} render={<Link href="/admin" />}>
            <ShieldCheck aria-hidden />
            Nutzerverwaltung
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2.5">Darstellung</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(value) => setTheme(String(value))}>
            <DropdownMenuRadioItem className={ITEM} value="light">
              <Sun aria-hidden />
              Hell
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem className={ITEM} value="dark">
              <Moon aria-hidden />
              Dunkel
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem className={ITEM} value="system">
              <Monitor aria-hidden />
              Wie das Gerät
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={ITEM}
          disabled={pending}
          onClick={() => startTransition(() => logoutAction())}
        >
          <LogOut aria-hidden />
          Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
