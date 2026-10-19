# Fortschritt

## Status

| Phase | Stand |
|---|---|
| 1 – Setup, Auth mit Einladung, Schema, noindex, Seed | **fertig** (18.10.2026), vom Nutzer getestet (19.10.2026) |
| 2 – Rezepte CRUD, Zutatensuche (Open Food Facts), Makros, Kategorien, Auto-Tags | **fertig** (19.10.2026), vom Nutzer getestet |
| 3 – Wochenplan mit Tageszielen | **fertig** (19.10.2026), vom Nutzer getestet |
| 4 – Einkaufsliste | **fertig** (19.10.2026), vom Nutzer getestet |
| 5 – Statistiken | **fertig (19.10.2026)**, wartet auf Test und OK des Nutzers |
| 6 – Community: veröffentlichen, Entdecken, übernehmen | offen, **nächste Phase** |
| 7–15 | offen |

**Nächster Schritt:** Nutzer testet Phase 5 (siehe „Wie der Nutzer Phase 5 testet“). Erst nach seinem OK mit
Phase 6 beginnen. Diesmal hat Claude die Diagramme selbst angesehen: mit einer vorübergehenden Vorschauseite
mit Beispieldaten (Desktop, 375 px, hell/dunkel, Klick-Auswahl), die vor dem Commit wieder gelöscht wurde.

**Entwicklungsserver:** Der Nutzer möchte, dass Claude zu Beginn jeder Sitzung den LAN-Server startet
(`npm run dev:lan` bzw. Preview „rezept-app-lan“), damit PC (localhost:3000) und Handy (http://<PC-IP>:3000)
gehen. PC-IP zuletzt 192.168.178.47.

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

## Was in Phase 5 entstanden ist

- **Recharts 3**; Diagramme nach dem Dataviz-Leitfaden: Farben mit dem Palette-Validator geprüft (Farbsehschwäche,
  Kontrast, hell und dunkel), eine y-Achse pro Diagramm, Tooltips, Legende, Tabellenansicht je Diagramm.
- **Farben angepasst:** Makro-Farben (Protein, KH, Fett) kräftiger bzw. im Dunkelmodus besser getrennt, weil die
  alten Werte im Test durchfielen. Kategorie-Palette `--chart-1…6` (feste Reihenfolge) + `--chart-other` (Grau),
  `--chart-grid`, `--chart-axis`. Zahlen stehen jetzt überall in Schriftfarbe mit farbigem Punkt
  (`MacroDot`) statt in Datenfarbe (gelbe Zahlen waren auf Creme schlecht lesbar).
- **Domänenlogik** `stats.ts` mit Tests: Kategorien (max. 5 Segmente, Rest „Weitere“), Auto-Tag-Anteile,
  Zusammensetzung pro Portion in 6 Gruppen, Ø Makroverteilung, Wochenplan-Verlauf (Ø pro geplantem Tag, 8 Wochen),
  meistgeplante Rezepte, Auswahl-Filter.
- **Statistik** `/statistik`: Kennzahlen (Rezepte, Ø kcal, Ø Protein, geplante Mahlzeiten), Donut nach Kategorie
  (+ Legende als Bedienweg), Auto-Tags als Balken, Protein gegen kcal (Streudiagramm, High Protein betont),
  Ø Makroverteilung, Zusammensetzung nach Zutatengruppe (gestapelt, sortierbar, 10 + „alle anzeigen“),
  Wochenplan kcal und Protein gegen Ziel (zwei Liniendiagramme statt zweiter Achse), meistgeplant.
  Klick auf Segment/Balken/Punkt/Tag filtert die Rezeptliste unten; zweiter Klick hebt die Auswahl auf.

## Wie der Nutzer Phase 5 testet

1. Statistik öffnen (PC und Handy). Kennzahlen und Donut prüfen.
2. Im Donut oder in der Legende „Pasta“ antippen → unten erscheinen nur die Pasta-Rezepte; nochmal antippen hebt auf.
3. „High Protein“ bei den Auto-Tags antippen, einen Punkt im Streudiagramm, einen Balken in der Zusammensetzung.
4. Über die Diagramme fahren/tippen: Tooltips. „Als Tabelle anzeigen“ aufklappen.
5. Wochenplan-Diagramme: Linien mit Ziellinie (wenn Tagesziele gesetzt sind).
6. Dunkelmodus kurz ansehen.

## Was in Phase 4 entstanden ist

- **Migration** `…091842_replace_plan_shopping_items`: ersetzt alle Plan-Einträge der Liste in einer
  Transaktion, eigene Einträge (source = manual) bleiben.
- **Domänenlogik** `shopping.ts` mit Tests: gleiche Zutaten zusammenfassen (gleiche Einheitenfamilie → Summe in
  g/ml/Stück, gemischt → Summe der Gramm), Faktor geplante Portionen / Rezeptportionen, Rundung (Stück auf
  halbe nach oben, ab 100 g/ml auf 5), Anzeige kg/l ab 1000, Abteilungs-Reihenfolge wie im Supermarkt.
- **Einkauf** `/einkauf`: „Aus Wochenplan“ mit Zeitraum (Rest dieser Woche, ganze Woche, nächste Woche, nächste
  7 Tage oder frei), Liste nach Abteilung (Obst & Gemüse zusammen, eigene Einträge am Ende), große Abhak-Zeilen
  mit sofortiger Reaktion (optimistisch), „Im Wagen“ eingeklappt, Erledigte/alles löschen, eigene Einträge mit
  freier Menge („2 Packungen“), Grundzutaten (is_staple) standardmäßig ausgeblendet, per Klick einblendbar
  (gemerkt in `user_settings.hide_staples`).

## Wie der Nutzer Phase 4 testet

1. Im Wochenplan ein paar Mahlzeiten planen (z. B. Bolognese 2 Portionen, Dal 1 Portion).
2. Einkauf → „Aus Wochenplan“ → „Ganze Woche“ → Liste erstellen. Mengen prüfen (Bolognese für 4 Portionen
   geplant mit 2 → halbe Mengen), Sortierung nach Abteilung.
3. Salz/Öl/Pfeffer sind ausgeblendet → „anzeigen“ antippen, wieder ausblenden.
4. Am Handy abhaken, „Im Wagen“ aufklappen, Haken wieder entfernen, „Erledigte löschen“.
5. Eigenen Eintrag „Spülmittel“ mit Menge „1 Flasche“ hinzufügen, danach Liste erneut aus dem Plan erstellen:
   Spülmittel bleibt.

## Was in Phase 3 entstanden ist

- **Migration** `…085925_copy_plan_week`: `copy_plan_week(von, nach, ersetzen)` kopiert eine Woche in einer
  Transaktion (SECURITY INVOKER; nur Montage; ergänzen hängt hinten an, ersetzen leert die Zielwoche vorher).
- **Domänenlogik** mit Tests: `week.ts` (Montag, Wochentage, KW nach ISO 8601, heute in deutscher Zeit, robust
  über die Zeitumstellung), `plan.ts` (Makros je Eintrag × Portionen, Summen pro Tag/Woche, Durchschnitt pro
  geplantem Tag, Soll/Ist mit „unter/erreicht/über“, Portionen in Vierteln).
- **Wochenplan** `/wochenplan?woche=YYYY-MM-DD`: Navigation vorige/diese/nächste Woche.
  Handy/Tablet: Tagesauswahl als Leiste, Wischen zwischen Tagen, Soll/Ist-Balken des Tages, Slots Frühstück,
  Mittag, Abend, Snack mit „planen“. Ab Laptop-Breite (lg): ganze Woche als Raster mit kcal/Protein je Tag.
  Darunter Wochenübersicht (Summen, Durchschnitt pro geplantem Tag gegen Ziele).
- **Einplanen-Dialog**: eigene Rezepte durchsuchen (Favoriten zuerst), Tag/Mahlzeit, Portionen ±½.
- **Eintrag-Dialog**: Portionen, Tag und Mahlzeit ändern, entfernen, zum Rezept.
- **Woche kopieren**: nächste/übernächste oder beliebige Woche, ergänzen oder ersetzen, danach Sprung dorthin.
- **Einstellungen → Tagesziele**: kcal, Protein, Kohlenhydrate, Fett (leer = kein Ziel), Hinweis „aus den
  Makros ergeben sich … kcal“ mit Übernehmen-Knopf.

## Wie der Nutzer Phase 3 testet

1. Einstellungen → Tagesziele eintragen (z. B. 2200 kcal, 140 g Protein), speichern.
2. Wochenplan: am Handy einen Tag wählen, „Mittag planen“ → Rezept wählen, 1½ Portionen → Einplanen.
   Balken und „noch … kcal“ ändern sich. Nach links/rechts wischen wechselt den Tag.
3. Eintrag antippen: Portionen ändern, auf einen anderen Tag verschieben, entfernen.
4. Am PC (breites Fenster) die Wochenansicht ansehen; Wochenübersicht unten prüfen.
5. „Woche kopieren“ → „Nächste Woche“ → Kopieren; danach in der nächsten Woche noch einmal mit „Ersetzen“.
6. Vor/zurück durch die Wochen blättern, „Diese Woche“.

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

**Fehler nach dem ersten Test (19.10.2026):** Rezeptseite zeigte „Seite nicht gefunden“. Ursache: PostgREST
antwortete mit 300/PGRST201, weil `recipes` ↔ `profiles` doppelt verbunden ist (direkt über `owner_id` und
als Many-to-Many über `favorites`). Behoben mit Fremdschlüssel-Hinweis (`profiles!recipes_owner_id_fkey`);
Abfragefehler führen jetzt zur Fehlerseite statt zu einem falschen 404. **Regel für später:** Embeddings
zwischen Rezepten und Profilen/anderen Tabellen immer mit `!fk_name` schreiben.
Handy-Test: `npm run dev:lan` (siehe README), `allowedDevOrigins` für 192.168.x.x/10.x in `next.config.ts`.

## Wie der Nutzer Phase 2 testet

1. `npm run dev`, <http://localhost:3000/rezepte>: 5 Beispielrezepte als Karten. Suche „dal“, Filter „Vegan“,
   „High Protein“, Sortierung „Meiste Protein“ ausprobieren.
2. Ein Rezept öffnen: Nährwerte, Zutaten, Schritte. Herz antippen, in der Liste „Favoriten“ filtern.
3. „Neues Rezept“: Titel, 2 Portionen, Zutaten „Ei“ (Stück), „Haferflocken“ (g), „Olivenöl“ (EL) hinzufügen,
   Makros ändern sich live. Speichern → Rezeptseite.
4. Im Zutaten-Dialog etwas suchen, das es nicht gibt (z. B. „Erdnussmus“) → „Bei Open Food Facts suchen“ →
   Treffer wählen, Werte prüfen, speichern. Und einmal „Selbst anlegen“.
5. Rezept bearbeiten, eine Zutat nach oben schieben, einen Schritt löschen, speichern. Duplizieren, Kopie löschen.
6. Alles einmal auf dem Handy ansehen: `npm run dev:lan`, dann `http://<PC-IP>:3000` im selben WLAN.

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

19.10.2026 (Umsetzung Phase 3):

19. **Phase 3 – Umfang:** Trainingstage, Lücken-Hinweis, Meal Prep und Reste kommen laut SPEC in Phase 11,
    Kosten pro Tag/Woche in Phase 12, öffentliche Rezepte im Plan in Phase 6. Einplanen geht vorerst nur mit
    eigenen Rezepten (inkl. übernommener Kopien).
20. **Phase 3 – Woche in der URL** als Datum (`?woche=2026-10-19`, wird auf den Montag normalisiert), Kalendertage
    als ISO-Strings, gerechnet in UTC; „heute“ in Europe/Berlin.
21. **Phase 3 – Ziel „über“** erst ab 110 % (kcal, Kohlenhydrate, Fett), bei Protein gibt es kein „zu viel“.
    „Erreicht“ ab 95 %.

19.10.2026 (Umsetzung Phase 4):

22. **Phase 4 – Umfang:** Vorrat abziehen, „In Vorrat übernehmen“ und Text-Export/Teilen kommen mit Phase 10,
    Kosten und Preis beim Abhaken mit Phase 12, Meal-Prep-Batches nur einmal zählen mit Phase 11.
    Grundzutaten ausblenden ist schon drin (braucht keinen Vorrat).
23. **Phase 4 – Neu erstellen ersetzt** die bisherigen Plan-Einträge (auch abgehakte); eigene Einträge bleiben.
    Der Dialog weist darauf hin.
24. **Phase 4 – Zusammenfassen in TypeScript** (testbar), Speichern atomar per Datenbankfunktion.

19.10.2026 (Umsetzung Phase 5):

25. **Phase 5 – Umfang:** Meistgekocht, Durchschnittsbewertung, Kochaktivität und alle Kosten-Diagramme kommen mit
    Phase 12 (Koch-Log, Preise), Trainingstage-Markierung mit Phase 11, Bar-Statistiken mit Phase 15.
26. **Phase 5 – Donut mit höchstens 5 Segmenten**, der Rest als graues „Weitere“ (12 Kategorien wären farblich
    nicht unterscheidbar). Die Legende daneben listet die Segmente, die Tabelle alle Kategorien. Farben folgen
    der Größe der Kategorie, das ist hier stabil, weil die Auswahl den Donut selbst nicht verändert.
27. **Phase 5 – Zusammensetzung in 6 Gruppen** (Gemüse & Obst, Getreide/Pasta/Reis, Fleisch & Fisch, Milch & Ei,
    Hülsenfrüchte & Nüsse, Sonstiges) statt 15 Zutatengruppen, pro Portion.

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

- **Turbopack-Cache:** Am 19.10. lieferte der Entwicklungsserver nach einer Änderung an `globals.css` selbst nach
  Neustart die alte CSS aus. Abhilfe: Server stoppen, Ordner `.next/dev` löschen, neu starten.

- Security-Advisor meldet `public.rls_auto_enable()` als für `anon` ausführbar. Das ist eine von Supabase
  selbst angelegte Event-Trigger-Funktion (Einstellung „RLS automatisch aktivieren“), nicht aus unseren
  Migrationen, und lässt sich per API nicht sinnvoll aufrufen. Bewusst nicht angefasst.
- Standard-Mails von Supabase sind englisch. Ihr Einmal-Link kann von Link-Scannern mancher Mailprogramme
  (z. B. Outlook mit „Safe Links“) vorab verbraucht werden; dann erscheint „Link abgelaufen“ und eine neue
  Einladung hilft. Abhilfe dauerhaft: eigener SMTP-Dienst + eigene Vorlagen (README Schritt 4).
- Performance-Advisor meldet „unused index“ für alle Indizes – normal bei leerer Datenbank.
- `SIGNUP_MODE` wird teilweise beim Build ausgewertet (statische Seiten). Nach einer Änderung neu bauen/deployen.
