# Fortschritt

## Status

| Phase | Stand |
|---|---|
| 1 – Setup, Auth mit Einladung, Schema, noindex, Seed | **fertig (18.10.2026)**, vom Nutzer getestet (19.10.2026), wartet auf OK für Phase 2 |
| 2 – Rezepte CRUD, Zutatensuche (Open Food Facts), Makros, Kategorien, Auto-Tags | offen, **nächste Phase** |
| 3–15 | offen |

**Nächster Schritt:** Auf das OK des Nutzers für Phase 2 warten. Beispielrezepte sind noch nicht eingespielt
(Skript `supabase/scripts/beispielrezepte.sql`, Nutzer wollte sich noch entscheiden).

**Stand Supabase (19.10.2026):** Admin-Account des Nutzers angelegt (Anzeigename „Jonah“, Rolle admin per SQL),
Secret Key in `.env.local`, Registrierung im Dashboard aus, Mail-Vorlagen unverändert (Standard).

**Test durch den Nutzer (19.10.2026):** Login, Navigation, Dark Mode, Nutzerverwaltung, Einladung eines
Test-Accounts inkl. Passwort/Anzeigename setzen, `/admin` mit Test-Account → 404, Test-Account gelöscht: alles ok.
Der Admin sah danach kurz ebenfalls 404: Laut Supabase-Auth-Log hatte der Einladungslink im selben Browser
die Admin-Session durch die Test-Session ersetzt (der Logout um 08:11 war der des Test-Accounts). Kein Fehler
in der Rechteprüfung; Hinweis in `docs/RLS-PRUEFUNG.md` ergänzt.

## Was in Phase 1 entstanden ist

- **Projekt:** Next.js 16.4 (App Router, TS strict), Tailwind 4, shadcn/ui (Base-UI-Variante „base-nova“),
  lucide-react, Zod 4, Vitest 5, lokales Git-Repo.
- **Designsystem** (`src/app/globals.css`): Creme-Hintergrund, Terrakotta-Akzent, Salbei für positive Werte,
  einheitliche Makro-Farben (`--macro-kcal/protein/carbs/fat/fiber`), Dark Mode (next-themes, Klasse),
  Bar-Stimmung als `[data-mood="bar"]` vorbereitet, Fraunces + Inter über `next/font`. Buttons/Inputs ≥ 44 px.
- **App-Rahmen:** Bottom-Nav (Handy), Seitenleiste (Desktop), Profilmenü (Einstellungen, Nutzerverwaltung
  nur für Admins, Hell/Dunkel/System, Abmelden), Leer-Zustände für alle fünf Bereiche, Skeleton beim Laden,
  deutsche 404- und Fehlerseite.
- **Datenbank** (Supabase-Projekt `kqampuiwxseubvecbcmz`, Frankfurt), Migrationen in `supabase/migrations/`:
  1. `…123355_schema` – alle Tabellen aus SPEC.md, Enums, Trigger (Profil + Einstellungen bei neuem User,
     `updated_at`, Diät-Vorbelegung, Rollenschutz), `app_config`
  2. `…123432_rls` – RLS auf jeder Tabelle, Policies, Spaltenrechte (role nicht änderbar)
  3. `…123456_recipe_nutrition` – View mit Makros gesamt/pro Portion, Gramm je Zutatengruppe, Auto-Tags
  4. `…123537_seed_ingredients` – 70 Zutaten mit Dichte/Stückgewicht, Grundzutaten markiert
  5. `…123629_split_child_write_policies` – Advisor-Hinweis behoben (überlappende Policies)
- **Auth:** Login, Passwort vergessen, Passwort setzen (+ Anzeigename bei Einladung), `/auth/confirm`
  (Token wird erst per Knopfdruck eingelöst), Registrierung nur bei `SIGNUP_MODE=open`, Login-Pflicht und
  Session-Erneuerung im Proxy (`src/proxy.ts`), sichere Weiterleitung nach Login (`?weiter=`).
- **Admin-Seite** `/admin`: einladen (`inviteUserByEmail`), Nutzerliste (Anzeigename, E-Mail, Datum,
  „Einladung offen“), Nutzer löschen (Storage-Ordner + Auth-User, Rest per Cascade). Normale Nutzer: 404.
- **noindex:** `robots.txt` (Disallow: /), Meta-Tag, `X-Robots-Tag`-Header (next.config.ts).
- **Beispielrezepte:** `supabase/scripts/beispielrezepte.sql` (5 Rezepte für den ersten Admin, öffentlich).
- **Doku:** README (Setup-Anleitung), `.env.example`, `DATENVERARBEITUNG.md`, `docs/RLS-PRUEFUNG.md`.
- **Tests:** Vitest (Zahlen-/Datumsformat, sichere Weiterleitung), SQL-Test `supabase/tests/rls_check.sql`
  (am 18.10. gegen die echte DB gelaufen, alle Werte wie erwartet, rückstandsfrei zurückgerollt).
- `vercel.json` mit Region `fra1` schon angelegt.

## Wie der Nutzer Phase 1 testet

1. README Schritte 1–6 erledigen (Schritt 4, die Mail-Vorlagen, entfällt), `npm run dev`, <http://localhost:3000>.
2. Mit dem eigenen Account anmelden → Rezepte-Seite mit Leer-Zustand, Navigation unten (Handy) bzw. links (Desktop).
3. Profilmenü → Nutzerverwaltung → eine zweite eigene Adresse einladen, Mail öffnen, Einladung annehmen,
   Anzeigenamen + Passwort setzen.
4. Mit dem zweiten Account `/admin` öffnen → „Seite nicht gefunden“.
5. Abmelden → „Passwort vergessen“ ausprobieren.
6. Optional: Beispielrezepte-Skript und `supabase/tests/rls_check.sql` im SQL-Editor ausführen.
7. Testaccount in der Nutzerverwaltung wieder löschen.

## Entscheidungen

18.10.2026 (Planung):

1. **Speicherort:** Projekt außerhalb von OneDrive. Backup über Git, später GitHub.
2. **Supabase:** Nutzer legt das Projekt im Dashboard an (Frankfurt), Claude spielt Migrationen über die
   Supabase-Integration ein. Lokale Migrationsdateien tragen dieselben Versionsnummern wie in Supabase.
3. **Beispielrezepte:** Skript ordnet sie dem ersten Admin zu und macht sie öffentlich.
4. **Low Carb:** höchstens 20 g Kohlenhydrate pro Portion (`app_config`).
5. **GitHub:** erst mit dem Vercel-Deployment (Phase 8).

18.10.2026 (Umsetzung Phase 1):

6. **Cache Components aus:** Next 16 aktiviert sie im Template standardmäßig. Da fast jede Seite die
   Session liest, bringt das hier wenig und macht den Code komplizierter. Klassisches dynamisches Rendering.
7. **Enum-Werte englisch, Anzeige deutsch:** z. B. `unit = 'tbsp'` → „EL“, `food_group = 'grains'` →
   „Getreide/Pasta/Reis“. Die deutschen Labels kommen in Phase 2 nach `src/lib/labels.ts`.
   Zusätzlich: Einheit `barspoon` (Barlöffel), Zutatenquelle `seed` für den Grundbestand.
8. **Alle Nutzer-FKs zeigen auf `profiles(id)`** (das wiederum per Cascade an `auth.users` hängt), damit
   sich Anzeigenamen direkt mitladen lassen.
9. **`ingredients.diet`** (vegan/vegetarisch/keine): per Trigger aus der Zutatengruppe vorbelegt, `other`
   gilt vorsichtshalber als „keine“. Grundlage für die Auto-Tags vegetarisch/vegan.
10. **Kohlenhydrate nach EU-Konvention** (ohne Ballaststoffe), passend zu Open Food Facts.
11. **E-Mail-Links:** Die Vorlagen lassen sich mit dem eingebauten Supabase-Mailversand nicht bearbeiten
    (Rückmeldung des Nutzers). Deshalb verarbeitet die App die Standard-Links: Supabase leitet mit den
    Tokens im URL-Fragment zurück, `AuthHashHandler` (im Root-Layout) setzt die Session, entfernt die Tokens
    aus der Adresszeile und leitet je nach Typ weiter (Einladung → Passwort + Anzeigename setzen).
    Abgelaufene Links zeigen eine Meldung. Passwort-Reset und Registrierung laufen über einen Client mit
    Implicit Flow (`src/lib/supabase/anon.ts`), damit der Link auch auf einem anderen Gerät funktioniert.
    Der `token_hash`-Weg über `/auth/confirm` mit Knopf bleibt für eigene Vorlagen (mit eigenem SMTP) erhalten.
12. **Impressum/Datenschutz-Platzhalter** schon jetzt angelegt (eigentlich Phase 8), weil das
    Registrierungsformular bei `SIGNUP_MODE=open` darauf verlinkt.
13. **Supabase-Keys:** neue Key-Typen (`sb_publishable_…`, `sb_secret_…`); Variable `SUPABASE_SECRET_KEY`.

## Offene Punkte

- Markdown-Beispieldatei für Phase 13 beim Nutzer anfragen.
- Phase 8: „Account löschen“ in den Einstellungen nutzt `deleteUserCompletely` aus `src/lib/server/delete-user.ts`.
- Phase 7: Storage-Bucket `recipe-photos` anlegen (Name steht in `src/lib/storage.ts`).
- Phase 14: Security-Definer-Funktion `get_shared_recipe(token)` für `/r/[token]` (Proxy lässt `/r/` schon durch).

## Bekannte Probleme

- Security-Advisor meldet `public.rls_auto_enable()` als für `anon` ausführbar. Das ist eine von Supabase
  selbst angelegte Event-Trigger-Funktion (Einstellung „RLS automatisch aktivieren“), nicht aus unseren
  Migrationen, und lässt sich per API nicht sinnvoll aufrufen. Bewusst nicht angefasst.
- Standard-Mails von Supabase sind englisch. Ihr Einmal-Link kann von Link-Scannern mancher Mailprogramme
  (z. B. Outlook mit „Safe Links“) vorab verbraucht werden; dann erscheint „Link abgelaufen“ und eine neue
  Einladung hilft. Abhilfe dauerhaft: eigener SMTP-Dienst + eigene Vorlagen (README Schritt 4).
- Performance-Advisor meldet „unused index“ für alle Indizes – normal bei leerer Datenbank.
- `SIGNUP_MODE` wird teilweise beim Build ausgewertet (statische Seiten). Nach einer Änderung neu bauen/deployen.
