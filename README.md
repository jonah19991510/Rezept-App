# Rezeptbuch

Private Web-App für Rezepte, Makronährstoffe, Wochenplan und Einkaufsliste – für Freunde und Familie.
Läuft auf Handy und Desktop, Daten liegen in Supabase (Frankfurt), Registrierung nur auf Einladung.

**Stand:** Phase 5 (Rezepte mit Makros und Open-Food-Facts-Suche, Wochenplan mit Tageszielen, Einkaufsliste, Statistiken). Details in [PROGRESS.md](PROGRESS.md),
die vollständige Anforderung in [SPEC.md](SPEC.md).

## Tech-Stack

Next.js 16 (App Router, TypeScript strict) · Supabase (Auth, Postgres, Storage, RLS) · Tailwind CSS 4 +
shadcn/ui (Base UI) · lucide-react · Zod · Vitest. Deployment später auf Vercel (Region `fra1`).

## Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.9 (getestet mit 24).

```bash
npm install
```

Dann `.env.example` nach `.env.local` kopieren und ausfüllen (siehe unten, „API-Keys“). Danach:

```bash
npm run dev
```

Die App läuft unter <http://localhost:3000>.

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver (nur auf diesem PC) |
| `npm run dev:lan` | Entwicklungsserver, auch vom Handy im selben WLAN erreichbar |
| `npm run build` | Produktions-Build (prüft auch TypeScript) |
| `npm test` | Unit-Tests (Vitest) |
| `npm run typecheck` | Nur TypeScript prüfen |
| `npm run lint` | ESLint |

### Auf dem Handy testen

Bis zum Deployment (Phase 8) läuft die App nur auf deinem PC. Im selben WLAN geht es trotzdem:

1. Statt `npm run dev` den Befehl `npm run dev:lan` starten.
2. Fragt Windows nach der Firewall, Zugriff für **private Netzwerke** erlauben (nicht für öffentliche).
3. Auf dem Handy `http://<IP-des-PCs>:3000` öffnen. Die IP steht in der Eingabeaufforderung unter
   `ipconfig` bei „WLAN → IPv4-Adresse“ (z. B. `192.168.178.47`).

Wenn eine Änderung (z. B. an Farben) nicht ankommt, obwohl der Server neu gestartet wurde: Server stoppen,
den Ordner `.next/dev` löschen und neu starten.

Nur im Heimnetz nutzen. Mails (Einladung, Passwort) verlinken weiterhin auf `localhost` und funktionieren
deshalb nur am PC.

## Supabase einrichten

Das Supabase-Projekt „Rezept App“ existiert bereits (Region Frankfurt, `eu-central-1`) und die
Migrationen aus `supabase/migrations/` sind eingespielt. Die folgenden Schritte musst du einmalig im
[Supabase-Dashboard](https://supabase.com/dashboard) erledigen.

### 1. API-Keys in `.env.local` eintragen

**Project Settings → API Keys**

- `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (beginnt mit `sb_publishable_`)
  sind schon in `.env.local` eingetragen.
- `SUPABASE_SECRET_KEY`: Im selben Bereich unter **Secret keys** einen Key anlegen bzw. anzeigen
  (beginnt mit `sb_secret_`) und in `.env.local` eintragen. Alternativ geht der alte `service_role`-Key
  unter „Legacy API Keys“.

> **Wichtig:** Der Secret Key umgeht alle Sicherheitsregeln. Er gehört nur in `.env.local` bzw. später
> in die Vercel-Umgebungsvariablen, nie ins Repo, nie in eine Variable mit `NEXT_PUBLIC_`.

### 2. Freie Registrierung abschalten

**Authentication → Sign In / Providers**

- Ganz oben unter **User Signups** den Schalter **„Allow new users to sign up“ ausschalten** und speichern.
- Der Provider **Email** bleibt aktiviert (sonst funktioniert der Login nicht).

Einladungen über die Admin-Seite funktionieren trotzdem, weil sie mit dem Secret Key serverseitig laufen.

### 3. URLs eintragen

**Authentication → URL Configuration**

- **Site URL:** `http://localhost:3000` (nach dem Deployment auf deine Vercel-Adresse ändern)
- **Redirect URLs:** `http://localhost:3000/**` hinzufügen (später zusätzlich `https://DEINE-APP.vercel.app/**`)

### 4. E-Mail-Vorlagen (nichts zu tun)

Die App funktioniert mit den **Standard-Vorlagen** von Supabase. Du musst dort nichts ändern. Wichtig
ist nur, dass Site URL und Redirect URLs aus Schritt 3 stimmen, denn dorthin führen die Links in den Mails.

Die Standard-Mails sind auf Englisch („You have been invited“). Solange Supabase den eingebauten
Mailversand nutzt, lassen sich die Vorlagen im Dashboard nicht bearbeiten (so war es bei uns). Mit einem eigenen SMTP-Dienst
(steht ohnehin auf der Checkliste in [DATENVERARBEITUNG.md](DATENVERARBEITUNG.md)) geht das. Dann lohnen sich
deutsche Vorlagen mit diesen Links, die zusätzlich vor Link-Scannern in Mailprogrammen schützen
(die App löst sie erst nach einem Klick auf einen Knopf ein):

| Vorlage | Link |
|---|---|
| Invite user | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` |
| Reset Password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` |
| Confirm signup | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` |

Beispiel für „Invite user“ (Betreff: `Du bist zum Rezeptbuch eingeladen`):

```html
<h2>Du bist eingeladen!</h2>
<p>Jemand hat dich zum gemeinsamen Rezeptbuch eingeladen.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">Einladung annehmen</a></p>
<p>Über den Link legst du deinen Anzeigenamen und dein Passwort fest.</p>
```

> Der Standard-Mailversand von Supabase ist stark begrenzt (nur wenige Mails pro Stunde) und
> eigentlich für Tests gedacht. Für die Familie reicht das meist; bei Problemen siehe
> „Eigener SMTP-Dienst“ in [DATENVERARBEITUNG.md](DATENVERARBEITUNG.md).

### 5. Deinen eigenen Account anlegen

Weil die freie Registrierung aus ist, legst du den ersten Account im Dashboard an:

**Authentication → Users → Add user → Send invitation**, deine E-Mail-Adresse eintragen.
Dann `npm run dev` starten und den Link in der Mail („Accept the invite“) öffnen. Die App meldet dich an
und führt dich zur Seite, auf der du Anzeigenamen und Passwort festlegst.

(Alternative ohne Mail: **Add user → Create new user**, E-Mail und Passwort eintragen, „Auto Confirm User“
anhaken. Dann direkt unter <http://localhost:3000/login> anmelden.)

### 6. Dich zum Admin machen (einmalig)

**SQL Editor → New query**, deine E-Mail-Adresse einsetzen und ausführen:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'deine@mail.de');
```

Danach die App neu laden: Im Profilmenü (oben rechts) erscheint **Nutzerverwaltung**. Normale Nutzer
können ihre Rolle nicht selbst ändern; das geht nur so im SQL-Editor bzw. per Migration.

### 7. Beispielrezepte einspielen (optional)

Den Inhalt von [`supabase/scripts/beispielrezepte.sql`](supabase/scripts/beispielrezepte.sql) im
SQL-Editor ausführen. Das legt 5 öffentliche Beispielrezepte für den ersten Admin an und zeigt am Ende
ihre berechneten Makros. Das Skript kann gefahrlos mehrfach laufen.

## Andere einladen

Profilmenü → **Nutzerverwaltung** → E-Mail-Adresse eingeben → **Einladung senden**. Die Person bekommt
eine Mail, setzt über den Link Anzeigenamen und Passwort und ist drin. In der Liste siehst du alle
Nutzer mit Anzeigename, E-Mail und Registrierungsdatum und kannst Accounts löschen (inklusive aller Daten).

## Rezepte und Zutaten

- **Rezepte** unter „Rezepte“ anlegen, bearbeiten, duplizieren, löschen und als Favorit markieren.
  Suche und Filter (Kategorie, Tags, Protein ab, Zeit bis) stehen in der Adresszeile, Zurück funktioniert.
- **Zutaten** sucht der Editor zuerst in der eigenen Zutatentabelle. Findet sich nichts, gibt es
  „Bei Open Food Facts suchen“ (deutsche Produkte zuerst) oder „Selbst anlegen“. Übernommene Zutaten
  stehen danach allen zur Verfügung. Open-Food-Facts-Daten stehen unter der Open Database License (ODbL).
- **Mengen** in g, ml, cl, Stück, EL (15 ml), TL (5 ml), Prise (0,5 g), Dash (0,6 ml) und Barlöffel (5 ml)
  werden in Gramm umgerechnet: ml über die Dichte der Zutat (sonst wie Wasser), Stück über das
  Stückgewicht. Ist kein Stückgewicht bekannt, fragt der Editor nach dem Gewicht.
- **Makros** rechnet der Editor live mit; gespeichert und überall angezeigt werden sie aus der
  Datenbank-View `recipe_nutrition` (gleiche Formel, gleiche Schwellenwerte).
- **Auto-Tags:** High Protein (≥ 30 g Protein pro Portion oder ≥ 30 % der kcal aus Protein),
  Vegetarisch, Vegan, Low Carb (≤ 20 g Kohlenhydrate pro Portion), Meal-Prep (Schalter im Rezept).
  Schwellenwerte ändern: neue Migration, die `app_config` aktualisiert.

## Wochenplan

- **Wochenplan** mit Frühstück, Mittag, Abend und Snack. Am Handy ein Tag pro Ansicht (wischen oder die
  Tagesleiste antippen), am PC die ganze Woche. Portionen pro Eintrag in halben Schritten.
- **Tagesziele** unter Einstellungen → Tagesziele. Der Plan zeigt pro Tag Soll gegen Ist; bei kcal,
  Kohlenhydraten und Fett gilt mehr als 110 % als „über dem Ziel“, Protein darf drüber.
- **Woche kopieren** in die nächste oder eine beliebige Woche, ergänzend oder ersetzend.

## Einkaufsliste

- **Aus dem Wochenplan** für einen wählbaren Zeitraum erstellen. Gleiche Zutaten werden zusammengerechnet
  (im Verhältnis geplante Portionen zu Rezeptportionen) und nach Supermarkt-Abteilung sortiert.
- Neu erstellen ersetzt die Einträge aus dem Plan; **eigene Einträge** (z. B. „Spülmittel“) bleiben.
- **Grundzutaten** wie Salz, Pfeffer und Öl sind ausgeblendet und lassen sich mit einem Tipp einblenden.

## Statistik

Diagramme zum eigenen Rezeptbuch und Wochenplan (Kategorien, Auto-Tags, Protein gegen kcal, Zusammensetzung,
Makroverteilung, Verlauf gegen Tagesziele, meistgeplant). Ein Tipp auf ein Segment, einen Balken oder Punkt
filtert die Rezeptliste darunter. Jedes Diagramm hat eine Tabellenansicht.

Die Diagrammfarben sind auf Farbsehschwäche und Kontrast geprüft (hell und dunkel). Neue Farben bitte vorher
ebenso prüfen statt nach Gefühl wählen.

## Registrierungsmodus

`SIGNUP_MODE` in `.env.local` (bzw. in Vercel):

- `invite` (Standard): kein „Registrieren“-Knopf, Accounts nur per Einladung.
- `open`: normale Registrierung mit Bestätigungsmail, Links zu Impressum und Datenschutz im Footer.
  Vorher die Checkliste in [DATENVERARBEITUNG.md](DATENVERARBEITUNG.md) abarbeiten und in Supabase die
  Registrierung wieder erlauben. Nach einer Änderung den Dev-Server bzw. das Deployment neu starten.

## Datenbank

- Schema als Migrationen in `supabase/migrations/` (nie nachträglich ändern, immer eine neue anlegen).
- Jede Tabelle hat Row Level Security. Prüfanleitung: [docs/RLS-PRUEFUNG.md](docs/RLS-PRUEFUNG.md).
- Makros pro Rezept berechnet die View `recipe_nutrition` (gesamt, pro Portion, Auto-Tags).
  Schwellenwerte für „High Protein“ und „Low Carb“ stehen in der Tabelle `app_config`.
- TypeScript-Typen der Datenbank: `src/lib/supabase/database.types.ts` (nach Schemaänderungen neu generieren).

Neues Supabase-Projekt von Grund auf? Dann die Dateien aus `supabase/migrations/` in Dateinamen-Reihenfolge
im SQL-Editor ausführen (oder mit der Supabase-CLI: `npx supabase link` und `npx supabase db push`).

## Datenschutz

- Keine Analytics, kein Tracking, keine eingebetteten Fremdinhalte. Schriften (Fraunces, Inter) werden
  selbst ausgeliefert.
- Nur technisch notwendige Cookies (Supabase-Session), daher kein Cookie-Banner. Die Wahl Hell/Dunkel
  liegt nur im `localStorage` des Geräts.
- Suchmaschinen: `robots.txt` sperrt alle Bots, jede Seite hat `noindex, nofollow` als Meta-Tag und als
  `X-Robots-Tag`-Header.
- Welche Daten wo liegen: [DATENVERARBEITUNG.md](DATENVERARBEITUNG.md).
- Next.js schickt beim Bauen anonyme Nutzungsstatistiken an Vercel. Abschalten mit
  `npx next telemetry disable`.

## Projektstruktur

```
src/app/(auth)/        Login, Passwort vergessen/setzen, Registrieren (nur bei SIGNUP_MODE=open)
src/app/(app)/         Rezepte, Wochenplan, Einkauf, Statistik, Entdecken, Einstellungen, Admin
src/app/(legal)/       Impressum, Datenschutz (Platzhalter)
src/app/auth/confirm/  Ziel der Links aus Einladungs- und Passwort-Mails
src/proxy.ts           Session-Erneuerung und Login-Pflicht (früher „Middleware“)
src/components/        ui/ (shadcn), layout/ (Navigation, Seitenleiste), forms/
src/lib/supabase/      Clients: server.ts, client.ts, admin.ts (nur Server, Secret Key)
src/lib/validation/    Zod-Schemas (Client und Server)
supabase/migrations/   Datenbankschema
supabase/scripts/      Einmalige Skripte (Beispielrezepte)
supabase/tests/        SQL-Prüfungen (RLS)
```

## Deployment

Kommt in Phase 8 (Vercel, Region `fra1` ist in `vercel.json` schon gesetzt).
