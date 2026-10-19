# Fortschritt

## Status

| Phase | Stand |
|---|---|
| 1 – Setup, Auth mit Einladung, Schema, noindex, Seed | **fertig** (18.10.2026), vom Nutzer getestet (19.10.2026) |
| 2 – Rezepte CRUD, Zutatensuche (Open Food Facts), Makros, Kategorien, Auto-Tags | **fertig (19.10.2026)**, wartet auf Test und OK des Nutzers |
| 3 – Wochenplan mit Tageszielen | offen, **nächste Phase** |
| 4–15 | offen |

**Nächster Schritt:** Nutzer testet Phase 2 im Browser (siehe „Wie der Nutzer Phase 2 testet“). Erst nach
seinem OK mit Phase 3 beginnen. Hinweis: Claude konnte die eingeloggten Seiten von Phase 2 nicht selbst im
Browser ansehen (kein eigener Account in der echten Supabase-Instanz); Build, Typen, Lint, 60 Unit-Tests und
die Datenbankfunktionen (SQL-Test als Nutzer, zurückgerollt) sind geprüft.

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

## Was in Phase 2 entstanden ist

- **Beispielrezepte** (19.10.) für den Admin eingespielt: 5 öffentliche Rezepte.
- **Migration** `…081927_recipe_functions`: `save_recipe(recipe, ingredients, steps)` speichert alles in einer
  Transaktion (SECURITY INVOKER, RLS gilt), `duplicate_recipe(id)` (eigene Kopie „(Kopie)“, fremde öffentliche
  mit `forked_from_id`), `search_ingredients(query)` (exakt → Wortanfang → Grundbestand → Ähnlichkeit).
- **Domänenlogik** in `src/lib/domain/` mit Tests: `units.ts` (Umrechnung in Gramm), `nutrition.ts`
  (Makros + Auto-Tags, gleiche Formel wie die View), `decimal.ts` (deutsche Zahleneingabe),
  `recipe-filter.ts` (Suche, Filter, Sortierung aus der URL), `openfoodfacts.ts` (Treffer → Zutat,
  Zutatengruppe und vegan/vegetarisch aus den OFF-Tags).
- **Rezeptliste** `/rezepte`: Karten mit kcal/Makros pro Portion, Auto-Tags, Zeit; Suche, Kategorie, Tag
  (automatisch + eigene), Favoriten, „Mehr“ (Protein ab, Minuten bis), Sortierung.
- **Rezeptseite** `/rezepte/[id]`: Nährwerte pro Portion und gesamt (Makro-Farben, kcal-Verteilung), Zutaten
  mit Mengen und ≈ Gramm, Hinweis bei fehlendem Gewicht, Schritte, Quelle, Favorit, Bearbeiten, Duplizieren,
  Löschen (mit Bestätigung). Fremde öffentliche Rezepte: Autor + „In mein Rezeptbuch übernehmen“.
- **Editor** `/rezepte/neu` und `/rezepte/[id]/bearbeiten`: Grunddaten, Kategorie, Meal-Prep-Schalter, eigene
  Tags (Chips mit Vorschlägen), Quelle, Zutaten (suchen/austauschen/sortieren/löschen, Menge + Einheit + Notiz,
  bei Stück ohne Stückgewicht Gewichtsabfrage), Live-Makros und Auto-Tags, Schritte (sortierbar), feste
  Speicherleiste, Warnung beim Verlassen mit ungespeicherten Änderungen, Zod-Prüfung auf Client und Server.
- **Zutaten-Dialog**: eigene Datenbank beim Tippen, „Bei Open Food Facts suchen“ auf Knopfdruck (deutsche
  Produkte zuerst), „Selbst anlegen“; Vorschläge aus OFF werden vor dem Speichern im Formular geprüft.

## Wie der Nutzer Phase 2 testet

1. `npm run dev`, <http://localhost:3000/rezepte>: 5 Beispielrezepte als Karten. Suche „dal“, Filter „Vegan“,
   „High Protein“, Sortierung „Meiste Protein“ ausprobieren.
2. Ein Rezept öffnen: Nährwerte, Zutaten, Schritte. Herz antippen, in der Liste „Favoriten“ filtern.
3. „Neues Rezept“: Titel, 2 Portionen, Zutaten „Ei“ (Stück), „Haferflocken“ (g), „Olivenöl“ (EL) hinzufügen,
   Makros ändern sich live. Speichern → Rezeptseite.
4. Im Zutaten-Dialog etwas suchen, das es nicht gibt (z. B. „Erdnussmus“) → „Bei Open Food Facts suchen“ →
   Treffer wählen, Werte prüfen, speichern. Und einmal „Selbst anlegen“.
5. Rezept bearbeiten, eine Zutat nach oben schieben, einen Schritt löschen, speichern. Duplizieren, Kopie löschen.
6. Alles einmal auf dem Handy (bzw. 375 px schmal) ansehen.

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

19.10.2026 (Umsetzung Phase 2):

14. **Phase 2 – Einheiten:** EL 15 ml, TL 5 ml, Prise 0,5 g, Dash 0,6 ml, Barlöffel 5 ml, cl 10 ml; ml über die
    Dichte der Zutat, sonst 1 g/ml (zentral in `src/lib/domain/units.ts`). Stück ohne Stückgewicht: Editor
    fragt nach dem Gesamtgewicht und speichert es in `grams`.
15. **Phase 2 – Gramm rechnet der Server:** Die Action lädt Dichte/Stückgewicht und berechnet `grams` selbst,
    der Browser schickt nur Menge, Einheit und ggf. das manuelle Gewicht.
16. **Phase 2 – Open Food Facts:** neue Such-API `search.openfoodfacts.org` (die alte `cgi/search.pl` war beim
    Test nicht erreichbar, 503). Nur auf Knopfdruck (OFF begrenzt Suchanfragen stark), deutsche Produkte zuerst.
    Gespeichert als `source = openfoodfacts`, `external_id` = Barcode; gibt es den Barcode schon, wird die
    vorhandene Zutat genommen. Name = Produktname + Marke.
17. **Phase 2 – Filter in TypeScript statt SQL:** Die eigene Rezeptliste ist klein (Familie), daher lädt die Seite
    alle eigenen Rezepte + Makros und filtert in `recipe-filter.ts` (testbar). Bei Bedarf später in SQL verlagern.
18. **Phase 2 – Favoriten** schon jetzt (Herz auf der Rezeptseite, Filter in der Liste), Tabelle gab es seit Phase 1.

## Offene Punkte

- Markdown-Beispieldatei für Phase 13 beim Nutzer anfragen.
- JSON-Export/-Import aller eigenen Rezepte (SPEC Abschnitt 2) ist keiner Phase zugeordnet. Vorschlag: mit
  „Meine Daten herunterladen“ in Phase 8 erledigen. Mit dem Nutzer klären.
- Portionen skalieren auf der Rezeptseite kommt mit Phase 9 (Kochmodus).
- `step_position` (Zutat je Schritt) wird beim Speichern erhalten, aber erst in Phase 9 im Editor bearbeitbar.
- Fotos (Phase 7) und Veröffentlichen-Schalter (Phase 6) fehlen im Editor noch bewusst.
- Advisor-Hinweis „Leaked Password Protection“ (Prüfung neuer Passwörter gegen HaveIBeenPwned, per
  k-Anonymität) ist aus. Optional im Dashboard (Authentication → Policies/Passwords), evtl. nur in bezahlten Plänen.
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
