"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useTheme } from "next-themes";
import { LogOut, Monitor, Moon, Scale, Settings, ShieldCheck, Sun } from "lucide-react";
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

const ITEM = "min-h-11 gap-2.5 px-2.5";

/** Profilmenü oben rechts: Einstellungen, Admin (nur Admins), Darstellung, Abmelden. */
export function UserMenu({ displayName, isAdmin }: { displayName: string; isAdmin: boolean }) {
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();

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
        <DropdownMenuItem className={ITEM} render={<Link href="/umrechner" />}>
          <Scale aria-hidden />
          Einheiten-Umrechner
        </DropdownMenuItem>
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
