# Fortschritt

## Status

| Phase | Stand |
|---|---|
| 1 – Setup, Auth mit Einladung, Schema, noindex, Seed | **fertig** (18.10.2026), vom Nutzer getestet (19.10.2026) |
| 2 – Rezepte CRUD, Zutatensuche (Open Food Facts), Makros, Kategorien, Auto-Tags | **fertig** (19.10.2026), vom Nutzer getestet |
| 3 – Wochenplan mit Tageszielen | **fertig** (19.10.2026), vom Nutzer getestet |
| 4 – Einkaufsliste | **fertig** (19.10.2026), vom Nutzer getestet |
| 5 – Statistiken | **fertig** (19.10.2026), vom Nutzer abgenommen |
| 6 – Community: veröffentlichen, Entdecken, übernehmen | **fertig** (19.10.2026), vom Nutzer abgenommen |
| 7 – Fotos und Import per Link | **fertig** (19.10.2026), vom Nutzer abgenommen |
| 8 – PWA, Feinschliff, Einstellungen, Deployment | **fertig** (19.10.2026), live, vom Nutzer abgenommen |
| 9 – Kochmodus, Portionen skalieren, Einheiten-Umrechnung | **fertig** (19.10.2026), live, vom Nutzer abgenommen |
| 10 – Vorratsschrank, „Was kann ich kochen?“, Text-Export | **fertig** (19.10.2026), live, vom Nutzer abgenommen (Teilen am Handy erst über HTTPS prüfbar) |
| 11 – Trainingstage, Lücken-Hinweis, Meal Prep, Reste-Vorschläge | **fertig** (19.10.2026), live, vom Nutzer abgenommen |
| 12 – Preise und Kosten, Koch-Log mit Bewertungen, „Lange nicht gekocht“, Rezept-Versionen, Statistiken | **fertig** (19.10.2026), live, vom Nutzer abgenommen |
| 13 – Markdown-Import und -Export | **fertig** (20.10.2026), vom Nutzer an PC und Handy getestet, live |
| 14 – Teilen per Link, Rezeptkarte, Open-Graph-Bild, Druck- und Bildexport | **fertig** (20.10.2026), live (vom Nutzer bestätigt); Bugfix Handy-Zoom gepusht |
| 15 – Cocktail-Bereich (Bar), Abschluss-Prüfung Export/Löschen | **fertig** (20.10.2026), live; dazu Seite „Zutaten“ (ansehen, bearbeiten, löschen, Preise) |

**Stand:** Alle Phasen der SPEC sind fertig und live (Push `9c7e479` am 20.10.2026 → Deployment
`dpl_FmC9e9SW7UtQPKKZvh1dC8tstMtq`, `source: git`, `target: production`, `fra1`, nach ca. 57 s „READY“, auf
unser-rezeptbuch.vercel.app geschaltet; per Vercel-Connector geprüft).

**Nächster Schritt:** Gesamttest am Handy auf der Live-Seite (Anleitung unter „Wie der Nutzer Phase 15 testet“),
danach nur noch Wünsche des Nutzers und die offenen Punkte unten.

**WhatsApp-Vorschau (20.10.2026):** Funktioniert (über mobile Daten getestet). Im Heim-WLAN fehlte sie, weil Vercel
die IP des Heimnetzes mit dem „Security Checkpoint“ belegt hatte (403, `X-Vercel-Mitigated: challenge`) – sehr
wahrscheinlich ausgelöst durch Claudes Abfrage-Schleife nach dem Push (40 Anfragen in 400 s). Der Browser löst die
Challenge selbst, die Vorschau (wird auf dem Handy erzeugt) nicht. Läuft normalerweise von allein ab. Künftig die
Live-Seite nicht in Schleifen abfragen. Der Vercel-Connector hat seit 20.10.2026 Zugriff auf den Account
`jonah19991510` (Deployments lesen geht).

**Production-Branch (20.10.2026, erledigt):** Bis dahin erzeugte ein Push auf `master` nur ein Preview-Deployment;
live ging es erst per „Redeploy“ des Nutzers (daher früher „Deployment hängt“). Der Nutzer hat den Production-Branch
in Vercel auf `master` gestellt. Geprüft per Connector: Push `a0cdab6` → Deployment `source: git`,
`target: production`, `fra1`, nach 26 s „READY“ und auf unser-rezeptbuch.vercel.app geschaltet. **Push = live.**
Deployments prüft Claude ab jetzt über den Vercel-Connector (`list_deployments`), nicht über die Live-Seite.

**Bugfix 20.10.2026 (nach Phase 14):** Am Handy hing die untere Navigation beim Scrollen mitten im Bild, auf allen
Seiten, bis zum Neuladen. Ursache: Das Link-Feld in „Teilen per Link“ hatte 12 px Schrift (`text-xs`); iPhones
zoomen bei Eingabefeldern unter 16 px automatisch hinein und bleiben gezoomt, fest positionierte Leisten hängen
dann im Bild. Jetzt am Handy 16 px wie alle anderen Felder (`md:text-xs` nur ab Desktop). Andere Felder geprüft:
keines setzt eine kleinere Schrift. Regel für später: Eingabefelder am Handy nie unter 16 px.

**Stand Deployment (19.10.2026):** Live unter <https://unser-rezeptbuch.vercel.app>, Vercel-Projekt `unser-rezeptbuch`
(Hobby, Konto jonah19991510), verbunden mit GitHub `jonah19991510/Rezept-App`, Produktionszweig `master`
(Push = Deployment). Variablen hat der Nutzer in Vercel eingetragen, Supabase-URLs umgestellt. Von außen geprüft:
`X-Vercel-Id: fra1::fra1` (Functions in Frankfurt), Login-Pflicht (307 → /login), `X-Robots-Tag`, robots.txt,
Meta-noindex, HSTS, Manifest/Icons/sw.js/offline.html erreichbar, keine Analytics und keine fremden Domains im HTML.
Der Vercel-Connector von Claude hat keine Rechte auf dieses Konto (403); Logs/Deployments sieht nur der Nutzer im
Dashboard.

**Deployment hing (19.10.2026, abends, behoben):** Nach dem ersten Deployment kamen spätere Pushes nicht live
(Phase 9 fehlte, von außen an der ausgelieferten CSS erkennbar). Der Nutzer hat es in Vercel behoben; danach waren
Phase 9 und der Push von Phase 10 (`4ce7102`) innerhalb weniger Minuten live. Prüfen von außen: die CSS-Datei aus
`/login` laden und nach einer Klasse suchen, die erst mit der neuen Phase dazukam.

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

## Ergänzung nach Phase 15: Seite „Zutaten“ (20.10.2026, Wunsch des Nutzers)

- **Profilmenü → Zutaten** (`/zutaten`): alle Zutaten aus den eigenen Rezepten und Cocktails plus alle selbst
  angelegten, mit Suche und Ansichten „Alle / In Rezepten / Selbst angelegt / Ohne Preis“. „Selbst angelegt“ heißt
  selbst erstellt (Quelle „user“); aus Open Food Facts übernommene Zutaten stehen nur unter „Alle“ (bzw. „In Rezepten“). Je Zeile Zutatengruppe,
  Herkunft (Grundbestand, Open Food Facts, selbst angelegt), Anzahl Rezepte und eigener Preis pro 100 g/ml.
- Antippen öffnet **Preis** (eintragen, ändern, löschen; dasselbe Formular wie unter Preise), **Bearbeiten** (nur
  selbst angelegte Zutaten: Name, Nährwerte, Gruppe, Ernährungsform, Stückgewicht, Dichte, Alkoholgehalt) bzw.
  **Angaben** (nur lesen bei Grundbestand, Open Food Facts und Zutaten anderer) und **Rezepte** (Links).
- **Migration** `…20261020170000_ingredient_grams_recompute` (schon in der DB, additiv): Trigger rechnet bei Änderung
  von Dichte oder Stückgewicht die Gramm aller Rezeptzeilen mit dieser Zutat neu (gleiche Regeln wie `units.ts`;
  g und Prise bleiben, Stück ohne Stückgewicht behält die letzte Angabe). Rechte unverändert (Policy
  `ingredients_update_own`: nur eigene mit Quelle „user“). Geprüft mit `supabase/tests/ingredient_edit_check.sql`
  (rollt sich zurück; auch das Rezept eines anderen Nutzers wird mitgerechnet, fremde/Grundbestand/OFF nicht änderbar).
  Security-Advisor: keine neuen Hinweise.
- Domain `src/lib/domain/my-ingredients.ts` (6 Tests), Server `src/lib/server/my-ingredients.ts`, Action
  `zutaten/actions.ts`, Oberfläche `components/ingredients/ingredient-manager.tsx`; `IngredientForm` kann jetzt auch
  bearbeiten. 298 Tests, Typecheck, Lint und Build grün. Browser-Check über eine temporäre Vorschauseite (wieder
  gelöscht) bei 375 px: Liste, Ansichten, Dialog mit Preis/Bearbeiten/Angaben, keine Felder unter 16 px. Speichern
  nicht im Browser geprüft (braucht Login; Datenbankteil per SQL-Test).

- **Löschen** (mit Rückfrage; bei selbst erstellten unter „Bearbeiten“, bei aus Open Food Facts übernommenen unter
  „Angaben“): nur eigene Zutaten, die in keinem Rezept mehr stecken. Nicht automatisch, nur von Hand. Migration
  `…20261020190000_delete_own_off_ingredients`: Policy `ingredients_delete_own` erlaubt jetzt auch selbst übernommene
  Open-Food-Facts-Zutaten (ändern bleibt gesperrt).
  Eigener Preis und Vorrats-Eintrag gehen mit, Einkaufslisten behalten den Namen. Migration
  `…20261020180000_protect_shared_ingredient_delete`: Trigger lehnt ab, wenn andere Nutzer die Zutat im Vorrat oder mit
  Preis haben (sonst würden deren Einträge per Cascade still verschwinden); Rezepte sperrt schon der Fremdschlüssel.
  Geprüft mit `supabase/tests/ingredient_delete_check.sql` (rollt sich zurück, alle Werte wie erwartet).

**So testest du es:** Profilbild → „Zutaten“. Ansicht „Ohne Preis“ → eine Zutat antippen → Preis eintragen →
erscheint in der Liste und unter „Preise“, die Kosten im Rezept stimmen. Eine selbst angelegte Zutat (Stift-Symbol)
→ „Bearbeiten“ → z. B. Stückgewicht ändern → im Rezept ändern sich Gramm und Nährwerte. Eine Zutat aus dem
Grundbestand zeigt nur „Angaben“. Löschen: eine selbst angelegte Zutat, die in keinem Rezept steckt → „Bearbeiten“ →
„Zutat löschen“ → „Endgültig löschen“; steckt sie noch in einem Rezept, steht dort ein Hinweis statt des Knopfs.
Eine aus Open Food Facts übernommene Zutat ohne Rezept (unter „Alle“) → „Angaben“ → „Zutat löschen“.

## Was in Phase 15 entstanden ist

- **Migration** `…20261020150000_cocktails` (schon in der Datenbank; nur additiv, die Live-Version läuft unverändert):
  `app_config.cocktail_dilution` = gerührt +20 %, geshaked +25 %, gebaut +10 %, geblendet +30 % (ohne Methode keine
  Verdünnung), View `recipe_alcohol` (Security Invoker: % vol, ml und g Alkohol, Volumen im Glas pro Drink),
  `save_recipe` mit gleicher Signatur, aber `recipe_type` und `cocktail` im JSON (fehlt der Typ, bleibt der
  gespeicherte; so speichern die ältere App und „Version wiederherstellen“ weiter richtig), Versions-Snapshot mit
  Cocktail-Feldern (Methodenwechsel = neue Version), `get_shared_recipe` mit `cocktail` und `alcohol`, 25 Bar-Zutaten
  im Grundbestand (Wodka, Tequila, Whisky, Bourbon, Rum braun, Cachaça, Angostura, Triple Sec, Campari, Aperol,
  Wermut rot/trocken, Kaffeelikör, Prosecco, Säfte, Grenadine, Soda, Tonic, Ginger Beer, Cola, Minze, Eiweiß).
  Gegen die echte DB mit `supabase/tests/bar_check.sql` geprüft (rollt sich selbst zurück, alle Werte wie erwartet).
  Security-Advisor: keine neuen Hinweise.
- **Alkoholberechnung** `src/lib/domain/cocktail.ts` (gleiche Formel wie die View, 19 Unit-Tests): Volumen aus
  cl/ml/Dash (0,6 ml)/Barlöffel (5 ml)/TL/EL, Gramm nur bei Getränkezutaten über die Dichte, Stück/Prise zählen nicht;
  Alkohol = Volumen × abv; % vol = Alkohol / (Volumen × (1 + Verdünnung)); Gramm = ml × 0,789. Dazu Basisspirituose
  (Spirituose mit dem größten Volumen, sonst Likör/Wein; „Rum, weiß“ → „Rum“) und `bottleHints` für „die eine Flasche“.
- **Umschalter Küche | Bar** oben auf Rezepte (`/rezepte/bar`), „Was kann ich kochen/mixen?“, Statistik
  (`/statistik/bar`) und Entdecken (`/entdecken/bar`). Die Bar hat dasselbe Design wie die Küche (Wunsch des
  Nutzers, siehe Entscheidung 68). Cocktail-Karten zeigen
  Basisspirituose · Methode · Glas, % vol, g Alkohol, kcal; Filter Basisspirituose, Methode (unter „Mehr“), Sortierung
  „Stärkste/Leichteste zuerst“.
- **Editor** (`/rezepte/neu?typ=cocktail`): Drinks, Zubereitungszeit, Glas, Methode, Eis, Garnitur; Einheiten mit cl,
  ml, Dash, Barlöffel zuerst (Getränkezutaten starten mit cl); live % vol, g Alkohol, ml im Glas und kcal, Hinweis bei
  Spirituosen ohne Alkoholgehalt. Neue Zutaten: Feld „Alkoholgehalt (% vol)“ bei Spirituosen und Likören/Wein.
- **Rezeptseite** für Cocktails: Glas, Eis, Garnitur, Karte „Pro Drink“ (% vol, g Alkohol, ml im Glas, Verdünnung,
  darunter Nährwerte), Drinks statt Portionen, „Mixen starten“, Koch-Log heißt „Gemixt“, Kosten pro Drink.
- **Mix-Modus:** Kochmodus mit „Wie viele Drinks mixt du?“, „Gemixt!“ am Ende (Bewertung, Notiz,
  Vorrat abziehen wie beim Kochen).
- **Bar-Bestand / „Was kann ich mixen?“** (`/einkauf/was-mixen`): wie „Was kann ich kochen?“ (ganzer Vorrat, Küche
  und Bar), oben „Die eine Flasche: X“ mit den Cocktails, die sie freischaltet, und den nächstbesten. Ohne Bar-Bestand
  Hinweis mit Link `/einkauf/vorrat?bereich=bar` (öffnet direkt den Bereich Bar).
- **Bar-Statistik:** Anzahl, Ø % vol, Ø g Alkohol, Ø kcal; Donuts nach Basisspirituose und Methode (Tipp → gefilterte
  Bar-Liste), Balken nach Alkoholgehalt (alkoholfrei, bis 10, 10–20, 20–30, über 30 %), die stärksten und die am
  häufigsten gemixten. Gemixtes zählt nicht mehr bei den gekochten Gerichten der Küchen-Statistik.
- **Rezept-Sicherung Version 2:** enthält Cocktails (Typ, Cocktail-Felder) und den Alkoholgehalt der Zutaten;
  Dateien der Version 1 werden weiter importiert (als Gerichte). **Markdown:** Cocktails mit
  „*Cocktail* · 1 Drink · geshaked · Glas Coupette“, Eis, Garnitur, „Pro Drink: 17,5 % vol · 18,9 g Alkohol · kcal“;
  im Buch als Gruppe „Cocktails“ am Ende. Der Import erkennt das wieder (auch „Art: Cocktail“, „Glas:“, „Methode:“,
  „Garnitur:“ aus anderen Quellen). **Geteilte Karte** `/r/[token]`: Cocktail · Methode, Glas, Eis, Garnitur, „Pro
  Drink“, Vorschau- und Story-Bild mit % vol, g Alkohol und kcal, Vorschautext „1 Drink · 17,5 % vol · … kcal“.
- **Abschluss-Prüfung:** „Meine Daten herunterladen“ enthält Cocktails samt `cocktail_details` und Versionen sowie den
  Bar-Bestand (keine neuen Tabellen nötig); Account-Löschung entfernt Cocktails und Cocktail-Felder per Cascade
  (SQL-Test). Doku: `DATENVERARBEITUNG.md` (Abschnitt „Bar“, Änderungsverlauf), `docs/RLS-PRUEFUNG.md` (Bar-Test,
  Punkt 11).
- 292 Tests, Typecheck, Lint und Build grün. Browser-Check über eine temporäre Seite `/r/vorschau-bar` (Beispieldaten,
  ohne Login, wieder gelöscht) am PC und bei 375 px: Karten, Filter, „Pro Drink“, Mix-Modus (2 Drinks → 12 cl),
  „die eine Flasche“, Bar-Statistik, Editor (Methode „gebaut“ → live 19,8 % vol); kein waagrechtes Scrollen, kein
  Eingabefeld unter 16 px. Dazu die echte Karte `/r/<token>` mit einem kurz angelegten Test-Cocktail (Seite,
  Vorschau- und Story-Bild angesehen, danach gelöscht, Link → 404). Nicht im Browser geprüft (braucht Login): Seiten
  unter `/rezepte/bar`, `/einkauf/was-mixen`, `/statistik/bar`, `/entdecken/bar`, Speichern eines Cocktails
  (Datenbankteil per SQL-Test geprüft).

## Wie der Nutzer Phase 15 testet

Am PC <http://localhost:3000>, am Handy <http://192.168.178.47:3000> (LAN-Server läuft).

1. Rezepte → oben „Bar“ → „Neuer Cocktail“: Daiquiri, 1 Drink, Coupette, geshaked, Garnitur Limettenrad; Zutaten
   6 cl Rum weiß, 3 cl Limettensaft, 2 cl Zuckersirup. Unten steht live ca. 17,5 % vol, 18,9 g Alkohol, ≈ 138 ml.
   Methode auf „gerührt“ stellen → 18,2 % vol. Speichern.
2. Rezeptseite (gleiches Design wie bei Gerichten): „Pro Drink“-Karte, Drinks-Schalter (2 Drinks → 12 cl Rum), „Mixen starten“ →
   Mix-Modus bis „Gemixt!“, Bewertung speichern → Abschnitt „Gemixt“ auf der Rezeptseite.
3. Zwei, drei weitere Cocktails (z. B. Negroni gerührt, Gin Tonic gebaut, ein alkoholfreier). Bar-Liste: Filter
   „Alle Spirituosen“, Sortierung „Stärkste zuerst“, unter „Mehr“ die Methode.
4. Einkauf → Vorrat → Bereich „Bar“: Gin, Limettensaft, Tonic eintragen. Einkauf → „Was kochen?“ → „Bar“: was sofort
   geht, was fehlt, oben „Die eine Flasche“.
5. Statistik → „Bar“: Donuts antippen (springt in die gefilterte Bar-Liste), Balken nach Alkoholgehalt.
6. Einen Cocktail „Öffentlich“ schalten → Entdecken → „Bar“. „Teilen per Link“ → Link abgemeldet öffnen: Karte mit
   % vol, „Als Bild“, „Drucken“ (hell).
7. Einstellungen: „Rezepte sichern“ (Datei enthält `"version": 2` und die Cocktails), „Rezeptbuch als Markdown“
   (Cocktails am Ende), eine alte Sicherung aus Phase 8–14 importieren geht weiterhin.

### Gesamttest am Handy (alle Phasen, Abschluss)

Am Handy im WLAN, einmal durch alles; was hakt, bitte mit Seite und Schritt notieren:

1. **Anmelden**, Navigation unten (Rezepte, Wochenplan, Einkauf, Statistik, Entdecken), Profilmenü oben, Dark Mode.
2. **Rezepte:** neues Rezept mit Zutatensuche (auch Open Food Facts), Foto hochladen, Import per Link, Markdown-Import;
   Filter und Suche; Kochmodus mit Timer und Portionen; Koch-Log; Version ändern und vergleichen.
3. **Bar:** Punkte 1–5 von oben.
4. **Wochenplan:** Rezept einplanen, Trainingstag, Meal Prep mit Resten, Woche kopieren, Tagesziele.
5. **Einkauf:** Liste aus dem Wochenplan erzeugen, abhaken mit Preis, in den Vorrat übernehmen, Text teilen.
6. **Statistik** Küche und Bar, **Entdecken** Küche und Bar, ein Rezept übernehmen.
7. **Teilen per Link** und **Als Bild** (Story), Link in WhatsApp (nach dem Deployment).
8. **Einstellungen:** Ziele, „Lange nicht gekocht“, „Meine Daten herunterladen“ (Datei öffnet sich, enthält Rezepte,
   Cocktails, Vorrat mit Bar …), Rezepte sichern.
9. **Account löschen** nur mit einem Test-Account (vorher einladen): danach Anmeldung unmöglich, Prüfung wie in
   `docs/RLS-PRUEFUNG.md` Punkt 5, 8 und 11.
10. **PWA:** „Zum Home-Bildschirm“, App öffnen, ohne Netz die Offline-Seite.
11. Eingabefelder: Beim Antippen darf das Handy nirgends hineinzoomen; die untere Navigation bleibt unten.

## Was in Phase 14 entstanden ist

- **Migration** `…20261020080000_share_links` (schon in der Datenbank, live läuft unverändert weiter):
  Format-Check für `recipes.share_token` (22 Zeichen base64url), `set_recipe_share(recipe, enabled)` (Invoker, nur
  Owner; behält einen vorhandenen Token, Widerrufen setzt null), `get_shared_recipe(token)` (Security Definer, auch
  für `anon`; liefert genau ein Rezept als JSON ohne IDs/E-Mail, Autor nur Anzeigename, Nährwerte pro Portion),
  `fork_shared_recipe(token)` (Security Definer, nur eingeloggt; private Kopie mit `forked_from_id`). An der RLS von
  `recipes` ändert sich nichts. Gegen die echte DB mit einem sich selbst zurückrollenden Test geprüft (Token-Länge,
  gleich bleibender Token, keine IDs, anon liest keine Tabelle und kann nicht kopieren, falsche Tokens → null,
  Kopie gehört dem Aufrufer). Security-Advisor: die neuen Warnungen „Security Definer ausführbar“ für
  `get_shared_recipe`/`fork_shared_recipe` sind gewollt (SPEC). `rls_auto_enable()` (anon ausführbar) und
  „Leaked Password Protection“ waren schon vorher da.
- **Rezeptseite (Owner):** Karte „Teilen per Link“ (`share-link.tsx`): Link erstellen, Kopieren (ohne HTTPS mit
  Fallback zum Markieren), Teilen (Web Share API, wo vorhanden), Ansehen, Widerrufen mit Bestätigung.
- **Öffentliche Rezeptkarte** `/r/[token]` (ohne Login, Pfad war im Proxy schon frei): Foto, Kategorie, Titel,
  „von <Anzeigename>“, Beschreibung, Portionen/Zeit, Tags, Nährwerte und Zutaten mit Portions-Skalierung
  (`ScaledRecipeContent` mit `showCookButton={false}`), Schritte, Stand und Quelle. Knöpfe: „In mein Rezeptbuch
  übernehmen“ (eingeloggt; Foto wird mit dem Admin-Client in den eigenen Ordner kopiert, weil das Original privat
  sein kann), „Dein Rezept öffnen“ (eigenes Rezept), „Anmelden zum Übernehmen“ (Gast, zurück per `?weiter=`),
  „Drucken“, „Als Bild“. Ungültiger/widerrufener Link: eigene Seite „Link ungültig“.
- **Foto** `/r/[token]/foto`: Server lädt den Pfad, den `get_shared_recipe` liefert, mit dem Admin-Client; der
  Speicherpfad (enthält die Nutzer-ID) erreicht nie den Browser. `Cache-Control: private, max-age=600`.
- **Link-Vorschau** `opengraph-image.tsx` (1200×630, JPEG ~110 KB) und **Story-Bild** `/r/[token]/bild`
  (1080×1920, JPEG ~270 KB, Download `titel.jpg`), gebaut in `src/lib/share-images.tsx` mit ImageResponse. WebP-Fotos
  zeichnet der ImageResponse-Renderer nicht, daher wandelt **sharp** (jetzt direkte Abhängigkeit, gleiche Version
  0.35.5 wie in Next) das Foto vorher in JPEG und das fertige PNG danach in JPEG (WhatsApp zeigt große Bilder sonst
  nicht). Schrift: die in Next eingebaute (Fraunces/Inter gibt es nur als woff2, das ImageResponse nicht liest).
- **Meta:** `metadataBase` aus `SITE_URL` (absolute og:image-Adressen), og:title/description/type/locale, Twitter-Card.
  noindex bleibt überall. `robots.ts`: Vorschau-Bots (facebookexternalhit, WhatsApp, TelegramBot, Twitterbot,
  Slackbot-LinkExpanding, Discordbot, LinkedInBot) dürfen `/r/` lesen, sonst `Disallow: /` für alle.
- **Druckansicht:** Kopf, Knöpfe, Portionsschalter ausgeblendet, Karte ohne Rahmen, Schritte brechen nicht mitten durch.
- Domain `src/lib/domain/shared-recipe.ts` (Zod-Prüfung der DB-Antwort, Texte, Dateiname; Tests), Server
  `src/lib/server/shared-recipes.ts`, Actions `rezepte/share-actions.ts` und `r/[token]/actions.ts`.
- Doku: `DATENVERARBEITUNG.md` (Abschnitt „Teilen per Link“, Änderungsverlauf Phase 13/14),
  `docs/RLS-PRUEFUNG.md` Punkt 10.
- 256 Tests, Typecheck, Lint und Build grün. Browser-Check als Gast mit einem kurz gesetzten Test-Token auf
  „Pad Kra Pao“ (privat, mit Foto): Karte am PC und bei 375 px, Portionen 2 → 4, Meta-Tags, Vorschau- und Story-Bild
  angesehen, nach dem Widerrufen 404 für Seite und Foto. Test-Token wieder entfernt. Nicht im Browser geprüft (braucht
  Login): die Karte „Teilen per Link“ auf der Rezeptseite und „In mein Rezeptbuch übernehmen“ (Datenbankteil per
  SQL-Test geprüft, Foto-Kopie nicht).

## Wie der Nutzer Phase 14 testet

1. Ein privates Rezept mit Foto öffnen → ganz unten „Teilen per Link“ → „Link erstellen“ → „Kopieren“.
2. Den Link in einem privaten Fenster (abgemeldet) öffnen: Rezeptkarte mit Foto, Portionen umschalten, „Drucken“
   (Vorschau: ohne Knöpfe), „Als Bild“ (JPEG im Story-Format).
3. Mit einem zweiten Account (oder wieder angemeldet im normalen Fenster): „In mein Rezeptbuch übernehmen“ → private
   Kopie mit Foto. Beim eigenen Rezept steht stattdessen „Dein Rezept öffnen“.
4. Am Handy (http://192.168.178.47:3000) dasselbe; „Teilen“ öffnet dort das Teilen-Menü.
5. „Widerrufen“ → der alte Link zeigt „Link ungültig“.
6. Nach dem Deployment: den Link per WhatsApp an dich selbst schicken → Vorschau mit Foto, Titel und Makros.

## Was in Phase 13 entstanden ist: Markdown-Export

- **Format** `src/lib/domain/recipe-markdown.ts` (mit Tests): je Rezept Überschrift, Zeile mit Kategorie, Portionen,
  Vorbereitung/Kochen, Meal-Prep, dann Beschreibung, `**Tags:**`, `**Pro Portion:**` (kcal + Makros, nur wenn
  berechenbar), `Zutaten` als Liste („250 g Rote Linsen, Notiz“ wie auf der Rezeptseite, Brüche wie ½ TL),
  `Zubereitung` nummeriert (mehrzeilige Schritte eingerückt, Timer als „*(Timer: 20 Min.)*“), `Quelle: <URL>`.
  Markdown-Zeichen im Text werden maskiert.
- **Einzelnes Rezept:** Rezeptseite → „⋮“ → „Als Markdown“ → `/rezepte/[id]/markdown` (Titel als `#`, Dateiname aus
  dem Titel, z. B. `kaesespaetzle.md`). Nur für eigene Rezepte im Menü; die Route liefert, was RLS lesen lässt.
- **Ganzes Buch:** Einstellungen → „Rezeptbuch als Markdown“ → `/einstellungen/rezepte-markdown`
  (`rezeptbuch-JJJJ-MM-TT.md`): `# Rezeptbuch von <Name>`, Datum und Anzahl, `## Inhalt` mit Links, nach Kategorie
  gruppiert (Reihenfolge wie im Filter, „Ohne Kategorie“ zuletzt, darin alphabetisch), dann alle Rezepte als `##`
  mit `---` dazwischen. Sprungmarken wie GitHub/Obsidian/VS Code (Umlaute bleiben, Doppelte bekommen -1, -2, die
  wiederholten „Zutaten“/„Zubereitung“ zählen mit). Wie die Rezept-Sicherung nur Küchenrezepte, ohne Fotos.
- Abfrage in `data-export.ts` (`getRecipeForMarkdown`, `getOwnRecipesForMarkdown`) mit dem Client des Nutzers;
  Typprüfung der Select-Strings ohne Cast.
- 225 Tests, Typecheck und Lint grün; beide Routen leiten ohne Login auf `/login` um. Kein Browser-Check mit echten
  Daten (Claude kann sich nicht anmelden), deshalb Test durch den Nutzer.

## Was in Phase 13 entstanden ist: Markdown-Import

- **Quelle des Nutzers:** Notion-Datenbank „Rezepte“ (Dashboard / Personal / Essen & Trinken, ca. 120 Einträge).
  Aufbau je Rezeptseite (per Notion-Connector gelesen, nichts verändert): Eigenschaften „Art“ (Pasta, Auflauf, Reis,
  Fleisch, Pizza/Flammenkuchen, Getränk, Sandwich, Suppe, Frittiert, Saucen, Burger, Brötchen/ Brot, Wrap, Toastie,
  Bowl, Snacks, Mexikanisch), „Kategorie“ (Mittag/Abend, Snack, Frühstück), kcal/Eiweiß/Fett/KH „pro Person“ als Text;
  graue Kästen „Vorbereitung“, „Koch- / Backzeit“, „Küche“, „Anzahl Personen“ (oft leer); Bild; „### Zutaten“ und
  „### Zubereitung“ als Listen, teils mit Gruppen („Teig:“, „Für die Füllung: Wrap“), „**Optionale Zutat**“ und
  „**Optionaler Zubereitungsschritt**“; leere Vorlagen „Page 3“.
- **Parser** `src/lib/domain/markdown-import.ts` (Tests): ein Rezept pro Überschrift. Die Rezept-Ebene ist die tiefste
  Überschriften-Ebene, unter der „Zutaten“/„Zubereitung“ stehen (Notion: `#` je Datei, eigener Buch-Export: `##`);
  sonst oberste Ebene bzw. unter einem einzelnen Buchtitel; ohne Überschrift der Dateiname (Notion-ID wird entfernt).
  Erkennt Eigenschaften als Zeilen/Zitate/fett („Art: Pasta“, „> Anzahl Personen: 4“, „**Tags:** …“), Zeiten
  („10 min“, „1 Std. 15 Min.“, „1,5 h“), Portionen (Spanne → kleinere Zahl + Hinweis), Kategorie aus Art/Kategorie
  (nicht passende Werte wie „Wrap“ werden Tags, „Mittag/Abend“ wird ignoriert), „Küche“ als Tag, Quelle,
  Nährwerte als Vergleichstext („Laut Datei: 972 kcal · Eiweiß 46,9 g …“), Gruppen und „optional“ als Zusatz in der
  Notiz, Gruppen in Schritten als Präfix („Teig: …“), Aufzählungen ohne Menge („Salz, Pfeffer, Olivenöl“) als einzelne
  Zutaten (nur groß geschriebene Wörter, also nicht „Zwiebel, gewürfelt“), Tabellen, Timer aus dem eigenen Export.
  Leere Seiten (ohne Zutaten, Schritte, Beschreibung) werden übersprungen. Hinweise: „Portionen fehlen“, „Keine Zutaten
  erkannt“, „Keine Schritte erkannt“, „Kein richtiger Titel“ (Page 3 …). Rundreise mit dem eigenen Export getestet.
- **Dateien lesen** `src/lib/markdown-files.ts` (nur im Browser, Tests): `.md`/`.txt`, mehrere Dateien oder ZIP
  (auch das verschachtelte „…-Part-1.zip“ großer Notion-Exporte), nur Markdown wird entpackt, höchstens 30 MB Text.
  Neue Abhängigkeit **fflate** 0.8 (MIT, ohne weitere Abhängigkeiten).
- **Ablauf** `/rezepte/import?quelle=markdown` (Reiter „Per Link“ / „Aus Markdown“, Knopf auf `/rezepte` heißt jetzt
  „Importieren“), Komponente `markdown-import-flow.tsx`:
  1. Datei wählen (mit Anleitung für den Notion-Export).
  2. Vorschau aller erkannten Rezepte mit Häkchen; vorausgewählt ist alles außer Doppelten (Titel schon im Buch)
     und Seiten ohne richtigen Titel.
  3. Zutaten zuordnen auf dem Server in Paketen zu 10 Rezepten (`matchMarkdownIngredientsAction`, Zod;
     gemeinsamer Matcher `src/lib/server/ingredient-match.ts`, auch vom Link-Import benutzt, mit Cache).
  4. **Sicher erkannte** Rezepte (`reviewReasons` leer: Portionen da, Zutaten und Schritte da, jede Zutat genau
     gefunden und in Gramm umrechenbar) werden direkt gespeichert (`saveRecipesBatchAction`, je 20).
  5. Alle anderen nacheinander: dieselbe Bestätigungsansicht wie beim Link-Import (`ImportReview`, jetzt exportiert,
     mit Hinweisen, was unsicher war) → Editor → Speichern → nächstes Rezept; „Überspringen“ jederzeit. Beim Verlassen
     der Seite fragt der Browser nach, solange noch Rezepte offen sind.
  6. Zusammenfassung (direkt gespeichert, geprüft, übersprungen, Fehler). Alles privat, ohne Fotos.
- `saveRecipeAction(input, { stay: true })` gibt die ID zurück statt weiterzuleiten; der Editor hat dafür `onSaved`
  und `cancel` (z. B. „Überspringen“).
- 250 Tests, Typecheck, Lint und Build grün. Browser-Check über eine Vorschauseite (Datei per Skript gewählt,
  Auswahl-Liste am PC und bei 375 px, Notion-Anleitung aufklappen) – wieder gelöscht. Zuordnen/Speichern braucht
  Login und ist deshalb nur durch die Unit-Tests und den Typcheck abgesichert.

## Wie der Nutzer Phase 13 testet

1. Ein Rezept öffnen → „⋮“ → „Als Markdown“: Datei wird gespeichert, Titel, Zutaten mit Mengen, Schritte stimmen.
2. Einstellungen → „Rezeptbuch als Markdown“: Datei z. B. in VS Code (Vorschau) oder Obsidian öffnen, im
   Inhaltsverzeichnis auf ein Rezept klicken → springt dorthin.
3. Am Handy dasselbe (Download landet in „Dateien“ bzw. „Downloads“).
4. Notion: Seite „Rezepte“ → „•••“ → „Exportieren“ → „Markdown & CSV“, „Unterseiten einschließen“ und „Ordner für
   Unterseiten erstellen“ an → ZIP speichern.
5. Rezepte → „Importieren“ → „Aus Markdown“ → ZIP auswählen: Liste prüfen (Titel, Zutaten-/Schrittzahl, Hinweise,
   leere „Page 3“ übersprungen). Zum Testen erst nur 2–3 Rezepte auswählen.
6. „Übernehmen“: Zutaten zuordnen bzw. weglassen, im Editor Portionen ergänzen, speichern → nächstes Rezept.
7. Die eben exportierte Buch-Datei (Schritt 2) wieder importieren: Doppelte sind abgewählt.

## Was in Phase 12 entstanden ist

- **Migration** `…190513_recipe_versions_and_costs` (schon in der Datenbank, die Live-Version läuft damit weiter):
  `save_recipe` legt Versionen an (neue optionale Änderungsnotiz `p_change_note`; alte Aufrufe mit drei Argumenten
  funktionieren weiter), Hilfsfunktionen `private.recipe_snapshot`/`private.recipe_content`, View `recipe_costs`
  (Kosten gesamt/pro Portion nach den Preisen des Aufrufers, Anzahl Zutaten mit Preis). In einer zurückgerollten
  Transaktion als Nutzer geprüft: nur Titel geändert → keine neue Version, Portionen geändert → Version 2.
- **Preise** `/preise` (Profilmenü → Preise): Preis für eine Packung in g, ml oder Stück, optional Laden; Anzeige
  pro 100 g/ml. **Schnelleingabe** in der Einkaufsliste: nach dem Abhaken erscheint „Preis eintragen“, bei
  abgehakten Einträgen mit Menge gibt es ein €-Symbol („Was hast du für 500 g Spaghetti bezahlt?“).
- **Kosten** (`costs.ts` mit Tests): Rezeptseite „ca. 2,10 € pro Portion · 8,40 € gesamt“ bzw. „mindestens …“ mit
  „3 von 9 Zutaten ohne Preis“; Wochenplan Kosten pro Tag (Tageskopf am PC, Tageskarte am Handy) und Woche;
  Einkaufsliste „Geschätzt ca. 23,40 €“ für das, was noch gekauft werden muss; Rezeptkarten „ab 2,10 €“.
- **Koch-Log** (`cooklog.ts` mit Tests): Rezeptseite „Gekocht“ mit „Zuletzt gekocht vor 3 Tagen · 2-mal · Ø ★ 4,5“,
  allen Einträgen (Datum, Sterne, Portionen, Version, Notiz) und „Gekocht eintragen“ (Datum frei, nicht in der
  Zukunft); Einträge löschbar. Die letzte Notiz steht im Kochmodus groß vor dem Start. Sterne-Auswahl als eigene
  Komponente (`star-rating.tsx`), auch im Kochmodus-Abschluss.
- **„Lange nicht gekocht“:** gut bewertete Rezepte (Ø ab 4 Sternen), seit X Wochen nicht gekocht (Einstellungen,
  Standard 6) als Liste mit „Einplanen“ unter dem Wochenplan; Filter in der Rezeptliste.
- **Rezeptliste:** unter „Mehr“ zusätzlich „Höchstens (€/Portion)“, „Bewertung ab“ und „Lange nicht gekocht“;
  Karten zeigen Ø-Bewertung und Kosten pro Portion.
- **Versionen** (`versions.ts` mit Tests): Editor-Feld „Was hast du geändert?“ (nur beim Bearbeiten). Rezeptseite
  (nur Owner) mit Versionsverlauf, Kurzfassung je Version („1 Zutat geändert, 1 neu, Portionen 4 → 6“),
  Vergleich zweier Versionen (Zutaten neu/entfernt/geändert farbig, geänderte Schritte, Makros pro Portion mit
  Differenz) und „Wiederherstellen“ (legt eine neue Version an, Gramm werden neu berechnet).
- **Statistik:** Meistgekocht mit Ø-Bewertung, Kochaktivität (gekochte Gerichte pro Woche), Lange nicht gekocht,
  Essenskosten pro Woche (Linie), Kosten pro Portion je Rezept, Protein pro Euro (Scatter, nur Rezepte mit allen
  Preisen); alle mit Tabellenansicht.
- 216 Tests, Typecheck, Lint und Build grün; Browser-Check über eine Vorschauseite mit Beispieldaten (wieder gelöscht).

## Wie der Nutzer Phase 12 testet

Über den LAN-Server (PC: <http://localhost:3000>, Handy: <http://192.168.178.47:3000>).

1. Profilmenü → **Preise** → „Preis eintragen“: z. B. Spaghetti 1,29 € für 500 g, Eier 2,99 € für 10 Stück.
2. Ein Rezept mit diesen Zutaten öffnen: Abschnitt **Kosten** (pro Portion, gesamt, „x von y Zutaten ohne Preis“).
3. Auf der Rezeptseite **„Gekocht eintragen“**: Datum, Sterne, Notiz → erscheint unter „Gekocht“. Danach
   „Kochen starten“: die Notiz steht oben („Letztes Mal notiert“).
4. Rezept **bearbeiten**, eine Menge ändern, unten „Was hast du geändert?“ ausfüllen, speichern → auf der Rezeptseite
   unter **Versionen** steht Version 2 (beim ersten Bearbeiten wird die alte Fassung als Version 1 gesichert).
   „Vergleichen“ und „Wiederherstellen“ ausprobieren. Nur den Titel ändern → keine neue Version.
5. **Einkaufsliste:** einen Eintrag mit Menge abhaken → unten „Preis eintragen“ → Preis eingeben. Oben steht die
   geschätzte Summe, sobald Preise da sind.
6. **Wochenplan:** Kosten pro Tag und Woche. Ein gut bewertetes Rezept (mit Datum vor mehr als 6 Wochen eingetragen)
   erscheint unter „Lange nicht gekocht“.
7. **Rezepte** → „Mehr“: nach Kosten, Bewertung und „Lange nicht gekocht“ filtern.
8. Einstellungen → „Lange nicht gekocht“: Wochenzahl ändern.
9. **Statistik:** Meistgekocht, Kochaktivität, Kosten-Diagramme.

## Was in Phase 11 entstanden ist

Keine Migration nötig: `plan_days`, `meal_prep_batches`, `meal_plan_entries.batch_id/is_leftover`,
`user_goals` (Typ „training“) und `user_settings.training_weekdays` gab es seit Phase 1 (RLS, Cascade, Datenexport).

- **Trainingstage:** Einstellungen → „Trainingstage“: Standard-Wochentage (Mo–So antippen) und ein eigenes Ziel für
  Trainingstage (leere Felder übernehmen das normale Tagesziel). Im Wochenplan pro Tag mit der Hantel umschaltbar
  (Handy: Knopf über dem Tagesfortschritt, PC: kleine Hantel im Tageskopf); eine Abweichung vom Standard landet in
  `plan_days`, wer zurückschaltet, löscht sie wieder. Der Tag nutzt automatisch das passende Ziel, in der Tagesleiste
  steht eine kleine Hantel. Der Wochenschnitt vergleicht mit dem Schnitt der Tagesziele.
- **Lücken-Hinweis** (`training.ts`): „Bis zum Ziel fehlen noch 35 g Protein · 420 kcal“ (ab 5 g bzw. 100 kcal) und
  bis zu drei Rezepte aus dem eigenen Buch und Entdecken, die die Lücke am besten schließen (½ oder 1 Portion,
  nichts, was kcal/KH/Fett über 110 % brächte, Favoriten bei Gleichstand zuerst). „Einplanen“ öffnet den Dialog mit
  Rezept, Portionen und passender Mahlzeit (kleine Sachen als Snack, sonst die erste freie Mahlzeit).
- **Meal Prep** (`mealprep.ts`): Im Einplanen-Dialog „Für mehrere Tage kochen“: Folgetage (bis 6, auch über die
  Woche hinaus) antippen, Reste stehen im selben Slot; „Insgesamt kochen“ (mindestens so viel wie eingeplant).
  Als Meal Prep markierte Rezepte schlagen das mit zwei Folgetagen gleich vor. Kochtag mit Kisten-Symbol, Reste mit
  Pfeil-Symbol; der Eintrag-Dialog erklärt, was dazugehört. Kochtag entfernen nimmt alle Reste mit, Kochtag
  verschieben verschiebt den Batch. Die **Einkaufsliste zählt den Batch einmal** am Kochtag mit allen gekochten
  Portionen, Reste gar nicht.
- **Reste-Vorschläge** (`leftovers.ts`): Übrige Meal-Prep-Portionen erscheinen 1–3 Tage nach dem Kochen
  („Vom Meal Prep Chili sind noch 2 Portionen übrig“ → „Als Abend einplanen“). Wurde an einem der zwei Vortage etwas
  mit Reis, Nudeln oder Kartoffeln gekocht (erkannt am Zutatennamen), schlägt der Tag eigene Rezepte mit derselben
  Basis vor („Reis von gestern übrig? Damit passt: Bratreis, Reissalat“).
- **Am PC** zeigt der Wochenplan unter der Woche den gewählten Tag im Detail (Tageskopf antippen): Ziele, Lücke,
  Reste.
- **Statistik:** Die Wochenplan-Diagramme vergleichen mit dem Ø-Ziel der geplanten Tage (Trainingstage mit ihrem
  Ziel; schwankt es, als gestrichelte Linie), Wochen mit Trainingstagen haben einen Ring um den Punkt, Tooltip und
  Tabelle nennen die Trainingstage.
- 197 Tests (neu: `training.test.ts`, `mealprep.test.ts`, `leftovers.test.ts`, Statistik mit Trainingstagen),
  Typecheck, Lint und Build grün; Browser-Check bei 375 px und am PC über eine Vorschauseite mit Beispieldaten
  (wieder gelöscht).

## Wie der Nutzer Phase 11 testet

Über den LAN-Server (PC: <http://localhost:3000>, Handy: <http://192.168.178.47:3000>).

1. Einstellungen → **Trainingstage**: z. B. Mo, Mi, Fr antippen, speichern. Darunter das Ziel an Trainingstagen,
   z. B. 2600 kcal und 170 g Protein, speichern.
2. Wochenplan: Mo/Mi/Fr haben in der Tagesleiste eine kleine Hantel und zeigen das höhere Ziel. Bei einem anderen
   Tag die Hantel antippen → wird Trainingstag; nochmal antippen → wieder normal.
3. An einem Tag nur ein Frühstück planen: darunter „Bis zum Ziel fehlen noch …“ mit Vorschlägen. Bei einem
   „Einplanen“ antippen → Dialog mit vorausgewähltem Rezept → Einplanen.
4. Ein Rezept (z. B. Chili) einplanen, „Für mehrere Tage kochen“ anhaken, zwei Folgetage wählen, „Insgesamt kochen“
   auf eine Portion mehr stellen → Einplanen. Kochtag mit Kisten-Symbol, Reste mit Pfeil-Symbol.
5. Am Tag nach dem Kochen: „Vom Meal Prep … noch 1 Portion übrig“ → einplanen.
6. Einkauf → „Aus Wochenplan“ für die Woche: das Chili zählt einmal mit allen gekochten Portionen.
7. Rezept mit Reis/Nudeln/Kartoffeln einplanen: am nächsten Tag „Reis von gestern übrig?“ mit passenden Rezepten
   (nur wenn es im Buch weitere Rezepte mit Reis gibt).
8. Kochtag des Meal Preps antippen → „Mit Resten entfernen“: alle Reste sind weg.
9. Statistik: in „Wochenplan: Kalorien“ Tooltip und Tabelle zeigen Trainingstage und Ø-Ziel.

## Was in Phase 10 entstanden ist

- **Einkauf hat drei Tabs:** Liste, Vorrat (`/einkauf/vorrat`), Was kochen? (`/einkauf/was-kochen`). Keine neue
  Tabelle, `pantry_items` gab es seit Phase 1 (RLS, Cascade, Datenexport schon dabei).
- **Vorratsschrank:** Bereiche Küche und Bar, Zutat über die bekannte Zutatensuche, Menge (g/ml/Stück) und
  „Haltbar bis“ freiwillig, ohne Menge „vorhanden“. Hinweis „Bald verbrauchen“ für Abgelaufenes und alles, was in
  höchstens 3 Tagen abläuft. Eintrag antippen → ändern oder entfernen.
- **Einkaufsliste mit Vorrat:** Reicht der Vorrat, steht der Eintrag ausgegraut mit „hast du schon · 500 g im
  Vorrat“ da und zählt nicht mehr als offen; reicht er nicht, steht „noch 2 Stück“ statt der ganzen Menge.
  Vorrat ohne Menge zählt als vorhanden. Abgehakte Einkäufe mit Zutat wandern per „N Einkäufe in den Vorrat
  übernehmen“ in den Vorrat (gleiche Einheit wird addiert, Spirituosen/Liköre/Sirupe in die Bar) und verschwinden von
  der Liste.
- **Text-Export:** „Als Text kopieren“ (nur, was noch gekauft werden muss, nach Abteilung, mit Datum) und „Teilen“
  über das Teilen-Menü des Handys (Web Share API, nur wo der Browser es kann). Ohne Zwischenablage (http im WLAN)
  erscheint der Text zum Markieren.
- **„Was kann ich kochen?“** (`cookability` in `pantry.ts`): eigene Küchenrezepte nach Abdeckung durch den Vorrat,
  Grundzutaten zählen nicht. Abschnitte „Alles da“, „Fehlt 1 Zutat“ (mit Name), „Fehlen 2–3 Zutaten“, der Rest
  aufklappbar. Rezepte, die bald ablaufende Zutaten verbrauchen, stehen oben. „Fehlendes auf die Liste“ setzt die
  fehlenden Zutaten (Mengen für die Rezeptportionen) als eigene Einträge auf die Einkaufsliste, ohne Doppelte.
- **Kochmodus:** Nach „Gekocht!“ erscheint „Vorrat aktualisieren?“ mit den betroffenen Vorrats-Einträgen und
  „500 g → 300 g“ bzw. „aufgebraucht“; die Mengen rechnet der Server aus Rezept und gewählten Portionen
  (Gramm, ml über die Dichte, Stück über das Stückgewicht). Einträge ohne Menge sind nicht vorausgewählt.
- **Domänenlogik** `src/lib/domain/pantry.ts` mit Tests (Abdeckung, Übernehmen, Verbrauch, Umrechnung, „Was kochen?“,
  Text-Export), Server-Teil `src/lib/server/pantry.ts`, Actions `src/app/(app)/einkauf/pantry-actions.ts`,
  Zod-Schemas `src/lib/validation/pantry.ts`. 178 Tests, Typecheck, Lint und Build grün; Browser-Check bei 375 px
  über eine Vorschauseite mit Beispieldaten (ohne Hydration-Fehler, Vorschauseite wieder gelöscht).

## Wie der Nutzer Phase 10 testet

Über den LAN-Server (PC: <http://localhost:3000>, Handy: <http://192.168.178.47:3000>).

1. Einkauf → Tab **Vorrat**: „Zutat hinzufügen“ → z. B. Spaghetti, 500 g. Dann Eier, 4 Stück, „Haltbar bis“ übermorgen.
   Dann „Dosentomaten“ ohne Menge. Oben erscheint „Bald verbrauchen: Eier“. Auf **Bar** umschalten, Gin eintragen.
2. Einen Eintrag antippen, Menge ändern, speichern; einen anderen entfernen.
3. Tab **Liste** (vorher ggf. „Aus Wochenplan“ mit einem Rezept, das Spaghetti/Eier enthält): Spaghetti stehen
   ausgegraut mit „hast du schon“, bei Eiern steht z. B. „noch 2 Stück“. Oben zählt „… noch zu besorgen“ die
   ausgegrauten nicht mit.
4. „Als Text kopieren“ → in WhatsApp/Notizen einfügen (am Handy über http im WLAN erscheint stattdessen ein Feld zum
   Markieren; live über HTTPS geht Kopieren direkt). Am Handy zusätzlich „Teilen“.
5. Zwei Einträge abhaken → „2 Einkäufe in den Vorrat übernehmen“ → sie sind von der Liste weg und im Vorrat (gleiche
   Einheit addiert).
6. Tab **Was kochen?**: Rezepte unter „Alles da“, „Fehlt 1 Zutat“ usw. Bei einem Rezept „Fehlendes auf die Liste“ →
   die Zutaten stehen auf der Liste.
7. Ein Rezept, dessen Zutaten im Vorrat sind, im Kochmodus bis „Gekocht!“ durchgehen → unten „Vorrat aktualisieren?“
   → Häkchen prüfen → „Vorrat aktualisieren“ → im Vorrat sind die Mengen kleiner bzw. die Einträge weg.

## Was in Phase 9 entstanden ist

- **Migration** `…152106_seed_densities`: Dichten für geriebenen Käse, Nüsse, TK-Beeren, Blattgemüse, Dosenbohnen,
  Penne; neue Grundbestands-Zutaten Puderzucker, brauner Zucker, Vanillezucker, Kakao, Speisestärke, Backpulver,
  Dinkel- und Vollkornmehl, Naturjoghurt, Frischkäse, saure Sahne, Kokosmilch, Rosinen (83 Seed-Zutaten, 54 mit Dichte).
- **Einheiten-Umrechnung** `us-units.ts` (zentral, mit Tests): cup/tbsp/tsp/fl oz/pint/quart/oz/lb/stick; Volumen über
  die Dichte der Zutat in Gramm, Flüssigkeiten (Dichte 0,95–1,1) bleiben ml; °F → °C auf 5 °C gerundet, auch im Text.
  Der Import nutzt das: Zutatenzeilen merken die US-Angabe und werden nach der Zuordnung über die Dichte der gewählten
  Zutat umgerechnet (1 cup Mehl → 127 g), Schritte und Beschreibung bekommen °C.
- **Umrechner** `/umrechner` (Profilmenü → Einheiten-Umrechner): Menge + Einheit + Zutat → g/ml; °F ↔ °C.
- **Portionen skalieren** auf der Rezeptseite (`scaling.ts` mit Tests): ± ändert Zutaten und Gesamt-Nährwerte, nur
  Anzeige. Rundung: g/ml ganzzahlig (ab 250 auf 5, unter 10 auf 0,5), Löffel und Stück auf ½ (unter 1 auf ¼),
  Prise/Dash ganz; „ca.“, wenn die Rundung mehr als 5 % ausmacht („ca. ½ Ei“).
- **Kochmodus** `/kochen/[id]` (Knopf „Kochen starten“, übernimmt die gewählten Portionen): Vollbild ohne Navigation,
  Startseite mit Portionen und Mise-en-place-Liste zum Abhaken, ein Schritt pro Ansicht mit großer Schrift, Wischen,
  große Pfeile und Pfeiltasten, Zutaten des Schritts (`step_position`), Zeitangaben im Text als antippbare Timer
  (`timers.ts` mit Tests: „10 Minuten“, „1 Std. 30 Min.“, „ca. 20–25 Min.“, „eine halbe Stunde“, englisch), dazu
  `timer_seconds` des Schritts. Mehrere Timer parallel in einer Leiste (Pause, Löschen), laufen beim Blättern weiter,
  Ablauf mit Gong (Web Audio) und Vibration bis zur Bestätigung. Bildschirm bleibt an (Wake Lock, sonst Hinweis).
  Am Ende „Gekocht!“: Bewertung 1–5 und Notiz → `cook_logs` (mit Rezeptversion).
- **Editor:** pro Zutat „Gebraucht in Schritt …“ (bleibt beim Umsortieren richtig), pro Schritt ein Timer in Minuten
  und der Hinweis, welche Zeitangaben automatisch erkannt werden.

## Wie der Nutzer Phase 9 testet

Über den LAN-Server (PC: <http://localhost:3000>, Handy: <http://192.168.178.47:3000>). Hinweis: Im WLAN über
`http://192…` kann das Handy den Bildschirm nicht wach halten (geht nur über HTTPS); live klappt das.

1. Ein Rezept öffnen, bei „Zutaten“ die Portionen mit + und − ändern: Mengen und „für N Portionen … kcal“ ändern sich,
   „Original“ setzt zurück. Bei 1 Portion z. B. „ca. ½ Ei“ statt 0,37.
2. Rezept bearbeiten: in den Schritten einen Timer eintragen (z. B. 10 Min.) und bei zwei Zutaten „Gebraucht in
   Schritt 1/2“ wählen. Speichern.
3. „Kochen starten“: Portionen wählen, Zutaten abhaken, „Los geht's“. Wischen bzw. Weiter/Zurück. Zeitangaben im Text
   antippen → Timer oben; zwei Timer gleichzeitig laufen lassen, blättern, einen pausieren. Kurzen Timer (z. B.
   „1 Minute“ in einen Schritt schreiben) ablaufen lassen: Ton, Vibration, „Fertig!“ → OK.
4. Letzter Schritt → „Gekocht!“ → Sterne und Notiz → Speichern.
5. Profilmenü → „Einheiten-Umrechner“: 1 cup + „Weizenmehl“ → ca. 127 g; 350 °F → 175 °C.
6. Optional: ein englisches Rezept importieren (z. B. BBC Good Food oder Budget Bytes): cups von Mehl/Zucker landen
   in Gramm, Ofentemperaturen in °C.

## Was in Phase 8 entstanden ist

- **Einstellungen:** Anzeigename ändern, Passwort ändern (Supabase `updateUser`), Tagesziele, „Deine Daten“ und
  „Account löschen“. Zod auf Client und Server (`validation/account.ts`).
- **Meine Daten herunterladen** `/einstellungen/meine-daten` (`data-export.ts`): alle Tabellen des Nutzers als JSON,
  inkl. Liste der Fotos, mit dem Client des Nutzers (RLS).
- **Rezept-Sicherung** `/einstellungen/rezepte-sichern` + „Sicherung importieren“ (`recipe-backup.ts` mit Tests):
  Format `rezeptbuch-rezepte` v1, Zutaten mit ID und Nährwerten; beim Import erst ID, dann Name, sonst neue eigene
  Zutat; Gramm werden neu berechnet; Rezepte werden zusätzlich und privat angelegt (über `save_recipe`), ohne Fotos.
- **Account löschen:** Dialog, Anzeigename eintippen, `deleteUserCompletely` (Fotos, Auth-User, Cascade), lokale
  Abmeldung, Login-Seite mit Hinweis. Der letzte Admin kann sich nicht selbst löschen.
- **PWA:** `manifest.ts` (Start in /rezepte, standalone, Terrakotta), Icons per `ImageResponse` beim Build erzeugt
  (Favicon, Apple-Touch-Icon, 192/512, maskable; der Standard-Favicon von create-next-app ist ersetzt),
  `public/sw.js` (nur `/_next/static` und Offline-Seite im Cache, Seiten nie), `public/offline.html`, Anmeldung nur im
  Produktions-Build, Header für `sw.js`, Proxy lässt PWA-Dateien ohne Login durch, `appleWebApp`-Metadaten.
- **Deployment:** `vercel.json` (fra1), README-Anleitung (GitHub, Vercel-Import, Variablen, Supabase-URLs, Region,
  keine Analytics). Geheimnis-Scan vor dem ersten Push: keine Schlüssel in Dateien oder Historie.

## Wie der Nutzer Phase 8 testet

1. Live-Adresse <https://unser-rezeptbuch.vercel.app> am PC öffnen, anmelden, ein paar Seiten durchklicken.
2. Am Handy: Adresse öffnen, „Zum Home-Bildschirm“ (iPhone: Teilen-Symbol; Android: Menü → App installieren).
   Die App startet mit Topf-Icon ohne Browserleiste.
3. Einstellungen → Anzeigenamen ändern (z. B. kurz „Jonah K.“ und zurück), Passwort ändern und neu anmelden.
4. „Meine Daten herunterladen“ und „Rezepte sichern“: Dateien öffnen sich bzw. werden gespeichert.
5. „Sicherung importieren“ mit der eben gespeicherten Datei: Rezepte erscheinen doppelt (privat). Die Kopien danach
   wieder löschen.
6. Einen Test-Account einladen (Einladungsmail muss jetzt auf die Vercel-Adresse zeigen), mit ihm anmelden und unter
   Einstellungen „Account löschen“ ausprobieren. Beim eigenen Admin-Account kommt ein Hinweis statt der Löschung.
7. Flugmodus an, App öffnen bzw. neu laden: „Du bist offline“.

## Was in Phase 7 entstanden ist

- **Migration** `…131933_recipe_photos`: privater Bucket `recipe-photos` (max. 3 MB, nur WebP/JPEG), Pfad
  `<owner>/<rezept>/<foto>.webp` + `<foto>-klein.webp`. Policies: lesen = eigener Ordner oder Foto eines lesbaren
  Rezepts (eigen/öffentlich) im Ordner seines Owners; hochladen nur in den eigenen Ordner zu einem eigenen Rezept;
  löschen nur im eigenen Ordner; kein Überschreiben. Check-Constraint: `recipes.image_url` (enthält den Pfad, keine
  URL) muss in `<owner>/<rezept>/` liegen. `duplicate_recipe` kopiert den Fotopfad nicht mehr (siehe unten).
- **Fotos:** `photo-compress.ts` verkleinert im Browser (Canvas, 1600 px + Vorschaubild 800 px, WebP, in Safari JPEG),
  wendet die EXIF-Drehung an und wirft dabei alle Metadaten weg. Hochladen direkt aus dem Browser in den Storage
  (Server-Action vergibt vorher die Pfade und prüft den Owner), danach `setRecipePhotoAction` (prüft Pfad + Datei,
  löscht das alte Foto). Auf der Rezeptseite: „Foto hinzufügen“ bzw. Foto mit „Ändern“/Entfernen; Karten zeigen das
  Vorschaubild. Ausgeliefert über die Route `/foto/<pfad>` mit den Rechten des Nutzers (privat zwischengespeichert).
  Rezept löschen räumt den Foto-Ordner, Duplizieren/Übernehmen kopiert das Foto in den eigenen Ordner der Kopie
  (bleibt, wenn das Original verschwindet). Account löschen löscht den Ordner schon seit Phase 1.
- **Import per Link** `/rezepte/import` (Knopf „Aus Link“ in Rezepte): Server lädt die Seite (`fetch-page.ts`:
  nur http/https, Standard-Ports, DNS-Prüfung gegen private Adressen bei jeder Weiterleitung, 10 s, 3 MB, kein
  Cookie/Referer), liest schema.org/Recipe aus JSON-LD (`recipe-import.ts`: @graph, Typ-Listen, HowToSection,
  ISO-Dauer, Portionen, Entities, Kategorie raten, Chefkoch-„von <Benutzer>“ weg), zerlegt Zutatenzeilen
  (`ingredient-line.ts`: Brüche, Bereiche, kg/l/dl, EL/TL, Prise, Gebinde wie Dose/Bund/Pck. als Stück mit Notiz,
  US-Einheiten cup/oz/lb/fl oz/stick metrisch mit „aus 1 cup“ als Notiz) und sucht je Zeile einen Vorschlag in der
  Zutatentabelle. **Bestätigungsansicht:** Original, Menge, Zutat (✓ genau, ! Vorschlag prüfen, fehlt), „Ändern“
  öffnet die Zutatensuche mit dem Namen vorbelegt, „Weglassen“. Danach der normale Editor mit allem vorbefüllt,
  Quell-URL gesetzt, privat.
- **Tests:** photo, ingredient-line, recipe-import, url-safety, import-draft (zusammen 135 Tests im Projekt);
  `rls_check.sql` um Storage-Fälle erweitert.

## Wie der Nutzer Phase 7 testet

1. Eins deiner Rezepte öffnen → „Foto hinzufügen“ → Foto wählen (am Handy auch direkt mit der Kamera). Nach kurzem
   „wird verkleinert/hochgeladen“ erscheint es groß oben; in „Rezepte“ und „Entdecken“ als Vorschaubild auf der Karte.
2. „Ändern“ mit einem anderen Foto, dann das Mülleimer-Symbol: Foto ist weg.
3. Ein Rezept mit Foto duplizieren: Die Kopie hat ihr eigenes Foto. Kopie löschen.
4. Rezepte → „Aus Link“ → z. B. ein Chefkoch-Rezept einfügen → „Rezept laden“. Zuordnung prüfen: Vorschläge mit „!“
   ansehen, eine Zutat ohne Treffer über „Zutat wählen“ suchen (oder „Bei Open Food Facts suchen“), eine Zeile
   weglassen. „Weiter zum Bearbeiten“ → Mengen, Kategorie, Schritte prüfen → Speichern.
5. Optional eine englische Seite (z. B. BBC Good Food): cups/oz werden in ml/g umgerechnet, die Notiz zeigt das
   Original.
6. Am Handy: Foto direkt aufnehmen. Hinweis: Bei iPhones mit „High Efficiency“ (HEIC) kommt meist trotzdem JPEG an;
   falls nicht, erscheint ein Hinweis.

## Was in Phase 6 entstanden ist

- **Migration** `…125325_community_copy_plan_week`: `copy_plan_week` überspringt Einträge, deren Rezept der Nutzer
  nicht mehr lesen darf (fremdes Rezept wieder privat). Sonst hätte die RLS das Kopieren der ganzen Woche abgelehnt.
  Signatur unverändert, daher keine Änderung an `database.types.ts`. Sonst keine Schemaänderung nötig: `is_public`,
  `forked_from_id`, Indizes, RLS für öffentliche Rezepte und `duplicate_recipe` gab es schon seit Phase 1/2.
- **Domänenlogik** `community.ts` mit Tests: Autor („von dir“ / „von <Name>“ / „Unbekannt“), Entdecken-Liste aus
  Datenbankzeilen (ohne Owner-ID im Ergebnis, Markierung „schon übernommen“), Auswahl für den Wochenplan
  (eigene öffentliche Rezepte nur einmal). Die Rezeptsuche findet jetzt auch den Anzeigenamen.
- **Veröffentlichen-Schalter** auf der eigenen Rezeptseite (wirkt sofort, Hinweistext zu Anzeigename und Kopien),
  Globus auf der Karte im eigenen Buch. Zod auf Client und Server (`validation/community.ts`).
- **Entdecken** `/entdecken`: alle öffentlichen Rezepte inkl. eigener („von dir“), Autor nur mit Anzeigenamen,
  gleiche Suche/Filter/Sortierung wie im eigenen Buch, „In deinem Buch“ bei schon übernommenen, freundlicher
  Leer-Zustand.
- **Übernehmen:** `forkRecipeAction` (über `duplicate_recipe`) → private Kopie mit `forked_from_id`, Weiterleitung
  zur Kopie mit Bestätigung. Auf der Kopie „Übernommen von <Name>: <Original>“ (nur solange das Original lesbar ist),
  auf dem Original „Deine Kopie öffnen“ + „Noch einmal übernehmen“. Rezeptseite fremder Rezepte führt zurück zu
  „Entdecken“.
- **Wochenplan:** Einplanen-Dialog mit Umschalter „Mein Buch | Entdecken“ (Suche auch nach Namen, „von <Name>“).
  Einträge fremder Rezepte zeigen den Autor im Dialog. Wird ein eingeplantes fremdes Rezept wieder privat:
  „Rezept nicht mehr verfügbar“ (kursiv, zählt nicht mehr), Dialog bietet nur „Entfernen“.
- **Tests:** `rls_check.sql` um Community-Fälle erweitert und am 19.10. gegen die echte DB laufen lassen (alles wie
  erwartet, zurückgerollt). Prüfanleitung `docs/RLS-PRUEFUNG.md` ergänzt.

## Wie der Nutzer Phase 6 testet

1. Eins deiner Rezepte öffnen → Kasten „Privat“ → Schalter einschalten → „Öffentlich“, Meldung erscheint.
   In „Rezepte“ trägt die Karte jetzt einen Globus. Wieder ausschalten geht genauso.
2. **Entdecken** öffnen: alle öffentlichen Rezepte (deine als „von dir“). Suche „dal“, deinen Anzeigenamen,
   Filter „Vegan“, Sortierung ausprobieren.
3. Mit einem zweiten Account (Test-Account einladen, im privaten Fenster anmelden, siehe README):
   Entdecken → ein Rezept von dir öffnen → „von Jonah“, keine E-Mail. „In mein Rezeptbuch übernehmen“ → die Kopie
   öffnet sich mit „Übernommen von Jonah“, lässt sich bearbeiten. In Entdecken steht beim Original
   „In deinem Buch“, auf seiner Seite „Deine Kopie öffnen“.
4. Mit dem zweiten Account: Wochenplan → „planen“ → oben „Entdecken“ → Rezept von Jonah einplanen.
5. Mit deinem Account das Rezept wieder auf privat stellen → beim zweiten Account steht im Wochenplan
   „Rezept nicht mehr verfügbar“, der Eintrag lässt sich entfernen; die übernommene Kopie bleibt.
6. Alles einmal am Handy ansehen. Danach den Test-Account wieder löschen (seine Kopien verschwinden mit).

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

19.10.2026 (Umsetzung Phase 6):

28. **Phase 6 – Eigene öffentliche Rezepte erscheinen in Entdecken** (als „von dir“), damit man sieht, was andere
    sehen. Im Einplanen-Dialog stehen sie nur unter „Mein Buch“.
29. **Phase 6 – Einplanen ohne Kopie:** Plan-Einträge verweisen direkt auf das öffentliche Rezept (wie in SPEC).
    Wird es wieder privat, bleibt der Eintrag beim anderen stehen (als „nicht mehr verfügbar“) statt still gelöscht
    zu werden; beim Löschen des Rezepts verschwindet er per Cascade.
30. **Phase 6 – Veröffentlichen-Schalter auf der Rezeptseite**, nicht im Editor (wirkt sofort, ohne Speichern).
31. **Phase 6 – Nach dem Übernehmen** geht es zur Rezeptseite der Kopie (nicht direkt in den Editor wie bei
    „Duplizieren“).

19.10.2026 (Umsetzung Phase 7):

32. **Phase 7 – Privater Bucket + eigene Foto-Route** statt öffentlicher Bucket oder signierter URLs: Fotos privater
    Rezepte sind nie öffentlich abrufbar, die Adressen bleiben gleich (Browser kann zwischenspeichern). Für die
    Rezeptkarten ohne Login (Phase 14) muss die Route dann zusätzlich den Share-Token akzeptieren.
33. **Phase 7 – Foto auf der Rezeptseite** statt im Editor (ein neues Rezept hat vor dem ersten Speichern noch keine
    ID für den Ordner). Nach dem Import: speichern, dann Foto hinzufügen.
34. **Phase 7 – Fotos von Webseiten werden beim Import nicht übernommen** (Urheberrecht; das eigene Foto ist besser).
35. **Phase 7 – US-Einheiten schon beim Import umgerechnet** (cup pauschal 240 ml, oz, lb, fl oz, stick Butter
    113 g), weil SPEC das für den Import verlangt. Zutatenabhängige Cup-Dichten, °F im Schritttext und der Umrechner
    kommen mit Phase 9.

19.10.2026 (Umsetzung Phase 8):

36. **Phase 8 – Deployment über GitHub (privat) + Vercel-Git-Integration** (Wunsch des Nutzers): Push auf `master`
    veröffentlicht automatisch. Adresse `unser-rezeptbuch.vercel.app`. Die Umgebungsvariablen trägt der Nutzer selbst
    in Vercel ein (Claude gibt keine Schlüssel in fremde Dienste ein).
37. **Phase 8 – Rezept-Sicherung (JSON-Export/-Import)** mit in Phase 8 (Wunsch des Nutzers), ohne Fotos.
38. **Phase 8 – Service Worker ohne Seiten-Cache:** Offline gibt es nur einen Hinweis, keine gespeicherten Rezepte
    (Datenschutz, geteilte Geräte). Bei Bedarf später „Rezepte offline“ als bewusste Funktion.
39. **Phase 8 – Letzter Admin kann sich nicht selbst löschen**, sonst könnte niemand mehr einladen.

19.10.2026 (Umsetzung Phase 9):

40. **Phase 9 – Koch-Log schon jetzt speichern:** „Gekocht!“ legt einen Eintrag in `cook_logs` an (Tabelle gab es seit
    Phase 1). Anzeige auf der Rezeptseite („zuletzt gekocht“, Notizen, Durchschnitt) kommt mit Phase 12.
    „Verbrauchte Zutaten aus dem Vorrat abziehen“ kommt mit dem Vorrat in Phase 10.
41. **Phase 9 – Timer bei Bereichen zur unteren Zeit** („20–25 Min.“ → 20 Min.), der Bereich bleibt als Beschriftung.
42. **Phase 9 – cups über die Dichte nur bei festen Zutaten** (Dichte unter 0,95 oder über 1,1); Flüssigkeiten bleiben
    ml. Ohne Dichte: 1 cup = 240 ml. Öl (0,92) wird damit gewogen.
43. **Phase 9 – Kochmodus als eigene Seite** `/kochen/[id]` außerhalb der App-Navigation statt Overlay, damit Zurück
    und Neuladen funktionieren.
44. **Phase 9 – Neue Phasen erst nach OK live:** Ab jetzt wird erst nach dem OK des Nutzers auf `master` gepusht
    (Push = Veröffentlichung); getestet wird vorher über den LAN-Server.

19.10.2026 (Umsetzung Phase 10):

45. **Phase 10 – Vorrat abziehen heißt ausgrauen, nicht löschen:** Einträge, die der Vorrat deckt, bleiben auf der
    Liste („hast du schon“), damit man sieht, warum etwas fehlt; teilweise gedeckte zeigen nur den Rest. Vorrat ohne
    Menge gilt als ausreichend. Verglichen wird nur in derselben Einheit (g/ml/Stück), sonst nur „im Vorrat“.
46. **Phase 10 – Vorrat ist eine Liste von Zutaten, keine Lagerverwaltung:** Menge und Datum freiwillig, je Zutat und
    Bereich ein Eintrag (`unique (user_id, ingredient_id, location)`); Übernehmen addiert gleiche Einheiten, sonst gilt
    die neue Angabe.
47. **Phase 10 – Abgelaufenes zählt weiter als vorhanden** (man entscheidet selbst, ob es noch geht) und wird bei
    „Was kochen?“ wie „läuft bald ab“ nach vorne sortiert.
48. **Phase 10 – „Was kochen?“ nur mit eigenen Küchenrezepten**, ohne Favoriten aus Entdecken; Cocktails kommen mit
    „Was kann ich mixen?“ in Phase 15. Fehlende Zutaten landen als eigene Einträge („manual“) auf der Liste, damit sie
    ein Neu-Erstellen aus dem Wochenplan überstehen.
49. **Phase 10 – Verbrauch nach dem Kochen rechnet der Server** (Client schickt nur Rezept, Portionen und ausgewählte
    Einträge). Lässt sich die Menge nicht umrechnen oder ist keine bekannt, kann der Eintrag nur als aufgebraucht
    markiert werden.
50. **Phase 10 – Tabs ohne Icons unter 400 px Breite**, damit „Was kochen?“ auf schmalen Handys ganz zu lesen ist.

19.10.2026 (Umsetzung Phase 11):

51. **Phase 11 – Trainingsziel ergänzt das Standardziel feldweise:** Leere Felder im Trainingsziel übernehmen das
    normale Ziel (meist will man nur kcal und Protein ändern).
52. **Phase 11 – Umschalten im Plan speichert nur Abweichungen** (`plan_days`); stimmt der Tag wieder mit dem
    Standard überein, wird die Zeile gelöscht, damit spätere Änderungen an den Standard-Wochentagen greifen.
53. **Phase 11 – Lücken-Vorschläge ohne Überschießen:** Ein Vorschlag darf kcal/Kohlenhydrate/Fett nicht über 110 %
    bringen (gleiche Grenze wie „über dem Ziel“); Protein darf drüber. Bewertet wird der Abstand zum Ziel (Protein
    stärker gewichtet), ½ Portion nur, wenn sie deutlich besser passt.
54. **Phase 11 – Meal Prep als Batch mit gekochten Portionen:** Die Einkaufsliste zählt `servings_cooked` am Kochtag,
    Reste nie extra (auch nicht, wenn der Kochtag vor dem Zeitraum liegt). Mehr eingeplant als gekocht hebt
    `servings_cooked` an, weniger lässt es stehen (der Rest erscheint als „übrig“). Batches ohne Kochtag-Eintrag
    gelten als verworfen.
55. **Phase 11 – Reste-Basen per Zutatenname** (Reis, Nudeln/Pasta-Sorten, Kartoffeln; nicht Reisessig, Stärke,
    Süßkartoffel) statt einer neuen Spalte; reicht für die drei Basen aus der SPEC. Vorschläge nur aus dem eigenen Buch.
56. **Phase 11 – Reste eines Batches erst ab dem Folgetag** und bis 3 Tage nach dem Kochen vorschlagen.
57. **Phase 11 – Statistik „Trainingstage markiert“ mit umgesetzt** (stand in der SPEC bei den Statistiken):
    Ø-Ziel je Woche statt fester Ziellinie, Ring um Wochen mit Trainingstagen.

19.10.2026 (Umsetzung Phase 12):

58. **Phase 12 – Versionen in der Datenbank:** `save_recipe` vergleicht den neuen Inhalt mit der letzten Version
    (Portionen, Zutaten mit Menge/Einheit/Notiz/Schritt, Schritte mit Timer) und legt nur bei Unterschieden eine an,
    in derselben Transaktion. Titel/Beschreibung/Tags allein sind keine inhaltliche Änderung. Rezepte von vor
    Phase 12 und Kopien bekommen beim ersten Bearbeiten ihre alte Fassung als Ausgangsversion („Ursprüngliche
    Fassung“), damit es etwas zum Vergleichen gibt.
59. **Phase 12 – Wiederherstellen überschreibt nicht die Geschichte:** Es entsteht eine neue Version mit der Notiz
    „Version X wiederhergestellt“; inzwischen gelöschte Zutaten fallen weg (die App sagt, wie viele).
60. **Phase 12 – Makro-Differenz im Vergleich mit den heutigen Nährwerten** der Zutaten und den gespeicherten Gramm
    der Version (die Nährwerte selbst werden nicht versioniert).
61. **Phase 12 – Kosten pro Gramm:** Preise gelten pro Zutat und Nutzer (eine Packungsangabe je Zutat, neue ersetzt
    alte). ml über die Dichte, Stück über das Stückgewicht; ohne Stückgewicht lässt sich ein Stückpreis nicht
    umrechnen (Hinweis im Dialog). Fehlen Preise, heißt es „mindestens“ bzw. „ab“, nie ein falsches „ca.“.
62. **Phase 12 – Kosten in der View, Schätzungen in TypeScript:** Rezeptkosten rechnet `recipe_costs` (SPEC), die
    Einkaufslisten-Schätzung (g/ml/Stück der Liste) und die Wochenkosten rechnet `costs.ts`/`stats.ts` mit derselben
    Formel; Tests decken beide TypeScript-Teile ab.
63. **Phase 12 – Koch-Log von Hand mit Datum:** Vergangene Tage bekommen 12 Uhr UTC (gleicher Kalendertag in
    Deutschland). Gespeichert wird immer die aktuelle Rezeptversion.
64. **Phase 12 – „Gut bewertet“ = Ø ab 4 Sternen;** nie bewertete Rezepte erscheinen nicht unter „Lange nicht
    gekocht“. Im Wochenplan höchstens 5 Vorschläge, ohne Rezepte, die in der Woche schon geplant sind.

65. **Phase 15 – Alkoholgehalt:** Verdünnung als Anteil des Volumens (gerührt +20 %, geshaked +25 %, gebaut +10 %,
    geblendet +30 %, ohne Methode 0), zentral in `app_config.cocktail_dilution`. Volumen zählt nur bei Volumen-
    Einheiten und bei Getränkezutaten in Gramm; Stück (Limettenspalte) und Kräuter in Gramm nicht. kcal pro Drink
    kommen wie bei Gerichten aus den Zutaten (Spirituosen-kcal enthalten den Alkohol).
66. **Phase 15 – Cocktails sind eigene Rezepte (recipe_type):** nicht im Wochenplan, nicht in der Küchen-Liste und
    -Statistik, aber im Koch-Log („Gemixt“), in Preisen/Kosten, Sicherung, Markdown, Teilen und Entdecken (Bar).
67. **Phase 15 – „Die eine Flasche“** zählt Cocktails, denen genau diese eine Zutat fehlt, und nur Spirituosen,
    Liköre/Wein und Sirupe/Säfte (Minze oder Limetten sind keine Flasche, stehen aber unter „Fehlt 1 Zutat“).
    Abgeglichen wird der ganze Vorrat (Küche und Bar).
68. **Phase 15 – Bar im selben Design wie die Küche:** Eine eigene, dunklere Bar-Stimmung (grün/Bernstein) war
    gebaut, der Nutzer wollte aber das Küchen-Design (20.10.2026); wieder entfernt. Der seit Phase 1 vorbereitete
    CSS-Block `[data-mood="bar"]` in `globals.css` bleibt ungenutzt stehen.

69. **Zutaten bearbeiten:** Nur selbst angelegte Zutaten (wie die RLS seit Phase 1); Grundbestand und Open Food
    Facts bleiben für alle gleich (gleicher Barcode wird von mehreren genutzt). Änderungen gelten in allen Rezepten
    mit der Zutat, auch bei anderen Nutzern; die Gramm rechnet ein Trigger (Security Definer im privaten Schema, nicht
    über die API aufrufbar) neu.

## Wünsche vom 21.10.2026: Handy-Layout, Rezeptbild, optionale Zutaten, Beilagen, Keep-alive

**Live** seit 21.10.2026: Push `1cb6514` → Deployment `dpl_FKRWRMkianMXBTcK3cqb8XaiDeWM` (`production`, `fra1`, nach ca. 60 s
„READY“, per Vercel-Connector geprüft); `/api/keep-alive` live einmal aufgerufen: 200, `{"ok":true}`.

- **Seitliches Scrollen behoben** (Wochenplan, Rezept-Editor): Raster ohne feste Spaltenbreite (`grid` ohne
  `grid-cols-1`) wurden von nicht umbrechenden Texten breiter als der Bildschirm (Vorschläge unter „Bis zum Ziel
  fehlen …“, „Gebraucht in“-Auswahl, Zutaten-Chips). Jetzt `grid-cols-1`/`minmax(0,1fr)`, lange Titel brechen um
  (`wrap-anywhere`), im Editor Menge + Einheit in einer Zeile und die Notiz darunter. Zusätzlich hat der App-Rahmen
  `overflow-x-clip` (kein Scroll-Container, sticky Kopf/Speicherleiste gehen weiter). Tagesansicht mit
  `touch-pan-y`, damit das Wischen zwischen Tagen nicht vom Browser übernommen wird. Geprüft bei 375 px: keine
  Elemente mehr breiter als der Bildschirm.
- **Untere Navigation:** Abstand links/rechts (mind. 6 px bzw. Safe Area), etwas kleinere Schrift; „Entdecken“
  klebt nicht mehr am Rand.
- **Rezeptkarte als Bild** (`/r/[token]/bild`): jetzt mit allen Zutaten (vorher höchstens 12), der Zubereitung und
  den Beilagen. 1080 px breit, mindestens 1920 hoch (Story-Format); passt der Inhalt nicht, wird das Bild länger
  (höchstens 7200 px). Die Höhe schätzt `domain/story-layout.ts` aus den Textlängen (Tests). Beispiel „Penne Con
  Pollo“ (11 Zutaten, 9 Schritte): 1080×2460.
- **Optionale Zutaten:** Schalter „Optional“ je Zutat im Editor. Zählen nicht in Nährwerten, Kosten, Alkoholgehalt
  (Views und Live-Rechnung im Editor), kommen nicht auf die Einkaufsliste, fehlen bei „Was kann ich kochen/mixen?“
  nie und werden beim Kochen nicht vom Vorrat abgezogen. Rezeptseite und geteilte Karte zeigen sie als eigene Liste
  „Optional“, der Kochmodus mit Hinweis an der Notiz. Gehören zur Version (Änderung erzeugt eine neue Version).
  Import: „optional“/„(optional)“ in der Notiz wird zum Schalter; Markdown-Export schreibt „(optional)“.
- **Beilagen („Passt dazu“):** Liste von Texten am Rezept (höchstens 20), nicht Teil des Rezepts, keine Nährwerte,
  nicht versioniert (wie Tags). Heißt eine Beilage wie eines der eigenen Gerichte, verlinkt die Rezeptseite sie.
  Auch in geteilter Karte, Bild, Markdown („**Passt dazu:** …“, wird wieder eingelesen), Sicherung und Kopien.
- **Migration** `…20261021120000_optional_ingredients_side_dishes` (in der DB, additiv): Spalten
  `recipe_ingredients.is_optional`, `recipes.side_dishes`; `save_recipe` (ohne `side_dishes` bleiben die
  gespeicherten, so speichert die alte App-Version weiter richtig), `recipe_snapshot` (Schlüssel `is_optional` nur
  wenn true: alle 9 Rezepte vergleichen sich danach unverändert, keine Geister-Versionen), `duplicate_recipe`,
  `fork_shared_recipe`, `get_shared_recipe`, Views `recipe_nutrition`/`recipe_costs`/`recipe_alcohol`.
  Security-Advisor: keine neuen Hinweise.
- **Keep-alive:** `GET /api/keep-alive` liest eine Zeile aus `app_config` (ohne Login, keine Daten), Vercel Cron ruft
  es täglich um 05:17 UTC auf (`vercel.json`). Supabase pausiert kostenlose Projekte sonst nach 7 Tagen ohne
  Aktivität. Optional `CRON_SECRET` in Vercel setzen: dann nur noch mit `Authorization: Bearer …` (schickt Vercel
  selbst mit), sonst 401.

## Wünsche vom 22.10.2026: Rezeptliste im neuen Design, Vorrat zum Abhaken, fehlende Preise

**Live** seit 22.10.2026: Push `28a3dac` → Deployment `dpl_5TVU8pdhEdtMkGHbTVEeMvMUsxqa` (`production`, per
Vercel-Connector geprüft). Am Handy über den LAN-Server vom Nutzer getestet (Chip-Reihe, Ansicht, Herz).

- **Rezeptliste (Küche, Bar, Entdecken) nach dem Entwurf „Rezeptbuch Bar-Redesign“:** Umschalter Küche | Bar über
  die ganze Breite (aktiv in Orange, gilt überall, wo er vorkommt). Darunter in Küche und Bar ein Hinweis „Was kann
  ich kochen/mixen?“ mit der Zahl der Rezepte, die der Vorrat ganz abdeckt (`countReadyRecipes`, wie „Was kann ich
  kochen?“: Grundzutaten und optionale Zutaten fehlen nie). Suche als Pille mit Regler-Knopf daneben (Protein, Zeit,
  Kosten, Bewertung). Filter als Chips in einer Reihe, am Handy seitlich wischbar und innerhalb der Seitenränder (bündig mit der Suche; passt eine Reihe nicht, wird der letzte Chip am Rand abgeschnitten statt überzustehen), ab Tablet umbrechend: Favoriten,
  Kategorie bzw. Spirituose und Methode, Tag, „Lange nicht gekocht“, Zurücksetzen. Die Auswahl-Chips öffnen die
  eingebaute Auswahlliste des Handys (`chip-select.tsx`): Die native Auswahl liegt unsichtbar unter dem Chip, nimmt aber
  keine Berührungen an (`pointer-events: none`), der Chip ist ein Knopf und öffnet sie per `showPicker()` bzw.
  `focus()`. Zuerst lag die Auswahl berührbar über dem Chip und schluckte am Handy das Wischen (in der Bar ließ sich
  die Reihe nicht bewegen); ein eigener Auswahl-Dialog als Ersatz gefiel dem Nutzer nicht (wirkte weniger modern).
  Über der Liste Anzahl, Sortierung und der Umschalter
  „Nebeneinander | Untereinander“.
- **Ansicht je Nutzer:** Spalte `user_settings.recipe_view` (`grid`/`list`, Standard `grid`), gilt für Küche, Bar und
  Entdecken. Wechselt sofort, gespeichert per `setRecipeViewAction`. Migration `…20261022090000_recipe_view` (in der
  DB, additiv).
- **Karten:** Raster mit Foto bzw. Platzhalter (Kochmütze/Glas) oben, Titel, Glas · Methode bzw. Kategorie · Zeit,
  Chip „≈ 32 % vol“ bzw. kcal. Liste mit kleinem Bild links und allen Angaben wie bisher. Das Herz liegt auf der
  Karte und setzt Favoriten, ohne das Rezept zu öffnen (Titel-Link deckt die Karte ab, Herz darüber).
- **Neues Rezept/Neuer Cocktail** als schwebender Knopf unten rechts (am Handy über der Navigation).
- **Importieren** ist von der Rezeptliste nach Einstellungen → Deine Daten gewandert („Rezepte importieren“); die
  Importseite führt zurück zu den Einstellungen.
- **Zutaten:** Umschalter „A–Z | Nach Kategorie“ (Überschriften wie Fisch, Milchprodukte in Supermarkt-Reihenfolge)
  und Filter auf eine Kategorie.
- **Vorrat zum Abhaken:** Alle Zutaten aus den eigenen Rezepten (und selbst angelegte) stehen im passenden Bereich
  (Küche/Bar) bereit, Grundzutaten wie Salz nicht. Antippen markiert „vorhanden“ (Eintrag ohne Menge) bzw. „fehlt“
  (Eintrag gelöscht; hatte er Menge oder Ablaufdatum, bietet ein Hinweis „Rückgängig“). Ansicht Alle | Vorhanden |
  Fehlt, Suche, Stift für Menge und Ablaufdatum. „Andere Zutat“ für alles, was in keinem Rezept steckt.
- **Preise ergänzen** im Rezept öffnet jetzt einen Dialog mit genau den Zutaten, die nicht in die Kosten eingehen:
  ohne Preis, Preis pro Stück ohne Stückgewicht, oder Menge ohne Gramm (dort hilft kein Preis, nur ein Hinweis).
  Antippen öffnet das Preisformular direkt im Dialog (`unpricedIngredients`, Tests).
- Geprüft: 311 Tests, Typecheck, Lint, Build grün. Layout bei 375 px und 1280 px über eine temporäre Vorschauseite mit
  Beispieldaten (ohne Login, danach gelöscht): kein seitliches Scrollen, Chips wischbar, Herz trifft den Knopf statt
  des Links. Mit echten Daten nicht im Browser geprüft (Claude kann sich nicht anmelden).

### Nachtrag 22.10.2026: Sortierung merken, Kosten mit Portionen

**Live** seit 22.10.2026: Push `d3ad138` → Deployment `dpl_9D3Qks2ed4oxZ6vwiCEpW7hcbQeL` (`production`, „READY“, per
Vercel-Connector geprüft).

- **Sortierung je Nutzer:** Spalten `user_settings.recipe_sort` (Küche: neu, name, protein, kcal, zeit) und
  `cocktail_sort` (Bar: neu, name, stark, leicht, kcal), Standard `neu`, Migration `…20261022120000_recipe_sort`
  (in der DB, additiv). Ohne `?sortierung=` in der Adresse gilt die gespeicherte Sortierung (Küche, Bar, Entdecken);
  eine Änderung schreibt sie in die Adresse und speichert sie (`setRecipeSortAction`, prüft per `toListSort`).
  Vorher stand sie nur in der Adresse und war nach dem Neuladen der Startseite weg. Nicht mit echtem Login geprüft.
- **Kosten im Rezept folgen dem Portionen-Schalter:** Der Kostenblock sitzt jetzt in `ScaledRecipeContent`;
  „gesamt“ = Gesamtkosten × gewählte/Rezeptportionen, mit „für N Portionen“, pro Portion unverändert. Geprüft mit
  Beispieldaten: 2 → 4 Portionen, 4,70 € → 9,40 €.
- 312 Tests, Typecheck, Lint, Build grün.

## Wünsche vom 24.10.2026: Vorrat im neuen Design

**Live** seit 24.10.2026: Migration `…20261024090000_ingredient_display_name` vom Nutzer im SQL Editor eingespielt,
am Handy über den LAN-Server getestet; Push `9c3c9ac` → Deployment `dpl_6CAznDm3FKSF84xnL7CSC8shfZ2a` (`production`,
`fra1`, nach ca. 88 s „READY“, auf unser-rezeptbuch.vercel.app geschaltet; per Vercel-Connector geprüft).

Design-Überarbeitung des Tabs „Vorrat“ nach dem Entwurf „Einkauf – Vorrat (neu)“, mit den Bausteinen der Rezeptliste.
Funktionen und Daten wie bisher, außer:

- **Seitenkopf:** Titel „Einkauf“ und Untertitel sind im Vorrat weg. Die Tabs Liste | Vorrat | Was kochen? sind jetzt
  eine Tab-Leiste mit Unterstrich (aktiv hell mit 3 px Akzent-Linie, sonst grau), auf allen drei Einkauf-Seiten
  (`ShoppingTabs`, eine Komponente). In der Bar heißt der dritte Tab „Was mixen?“ (auch auf der Seite „Was mixen?“,
  vorher stand dort „Was kochen?“). Liste und „Was kochen?“ behalten ihren Seitenkopf.
- **Küche | Bar:** derselbe Umschalter wie auf der Rezepte-Startseite (`KitchenBarSwitch`, jetzt wahlweise als Knöpfe
  ohne Seitenwechsel und mit Zähler „vorhanden / gesamt“). Der Bereich steht in der Adresse (`?bereich=bar`).
- **Plus-Knopf** unten rechts („Zutat hinzufügen“, gleiche Klasse `fabClass` wie „Neues Rezept“) statt „Andere
  Zutat“; öffnet denselben Dialog, mit dem Suchbegriff vorbelegt. Hinweistext „Tipp eine Zutat an …“ entfernt.
- **Filter-Chips** Alle / Vorhanden / Fehlt im Stil der Startseite mit Zähler (zählen die Suchtreffer).
- **Gruppen** auf- und zuklappbar (Überschrift als Knopf mit „5 / 8“ und Pfeil); ohne Treffer ausgeblendet; beim
  Suchen immer offen.
- **Zeilen:** runder Haken (28 px, ganze linke Fläche, `role="checkbox"`, mind. 64 px hoch), ohne „vorhanden“/„fehlt“.
  Vorhanden: Menge + Stift. Fehlt: grauer Name und Knopf „Liste“ → setzt die Zutat auf die Einkaufsliste
  (`setOnShoppingListAction`, Eintrag ohne Menge, Quelle „manual“, nie doppelt), danach „Auf Liste“; erneut tippen
  nimmt offene Einträge dieser Zutat wieder herunter (abgehakte bleiben). Zweite Zeile: Zusatzinfo bzw. „Läuft heute/
  morgen/in X Tagen ab“ (bis 3 Tage vorher, Akzentfarbe; abgelaufen: „Abgelaufen“ in Rot, `expiryLabel`). Der Hinweis
  „Bald verbrauchen: …“ über der Liste ist dafür entfallen.
- **Grundzutaten** in der Küche standardmäßig aus, gestrichelter Knopf „Grundzutaten (Salz, Pfeffer, Öl …)
  einblenden/ausblenden“ am Ende (auch vorhandene; `pantryChecklist(…, { includeStaples })`). Die Bar zeigt alles.
- **Nichts gefunden:** gestrichelte Karte mit Hinweis auf den Plus-Knopf.
- **Kurznamen:** Neue Spalte `ingredients.display_name` (optional, 1–60 Zeichen). Leer = automatisch: Open-Food-Facts-
  Namen werden per Regeln gekürzt (`domain/ingredient-name.ts`, Tests: Bio/Demeter …, Handelsklasse, Mengen wie
  „500 g“, Teile nach Komma/Gedankenstrich, Klammern wie die Marke → graue Zusatzzeile „Bio · Klasse II · Edeka“);
  gilt sofort für alle schon importierten Zutaten. Von Hand änderbar unter Zutaten → Zutat → Angaben/Bearbeiten
  („Kurzname im Vorrat“), auch bei Open-Food-Facts-Zutaten, über die Funktion `set_ingredient_display_name`
  (Security Definer, ändert nur dieses Feld; erlaubt für selbst angelegte und selbst genutzte Zutaten; gilt für alle
  Nutzer gleich). Keine personenbezogenen Daten, daher keine Änderung an Export oder `DATENVERARBEITUNG.md`.
- Geprüft: 320 Tests, Typecheck, Lint, Build grün. Layout bei 375 px in Dark und Light über eine temporäre
  Vorschauseite mit Beispieldaten (ohne Login, danach gelöscht): kein seitliches Scrollen, alle Knöpfe ≥ 44 px, Zeilen
  64 px, der Plus-Knopf verdeckt die letzte Zeile nicht, Filter/Suche/Zuklappen/Grundzutaten/Bar funktionieren.
  Nicht mit echtem Login geprüft (Abhaken, „Liste“, Kurzname speichern).

## Wünsche vom 24.10.2026: Zutaten und Wochenplan im neuen Design

**Live** seit 24.10.2026: Push `77de69b` (mit `ce8f6b5`, `4666deb`) → Deployment `dpl_HetNyYBXnBw5gK2vM3Yjv9j2rMLY`
(`production`, `fra1`, `source: git`, nach ca. 43 s „READY“, auf unser-rezeptbuch.vercel.app geschaltet; per
Vercel-Connector geprüft). Vom Nutzer am Handy über den LAN-Server getestet und freigegeben.

Design-Überarbeitung nach den Entwürfen „Zutaten (neu)“ und „Wochenplan (neu)“, in zwei Schritten (erst Zutaten, nach
OK des Nutzers Wochenplan). Funktionen, Daten und Schema wie bisher, keine Migration.

### Teil 1: Zutaten (Commit `ce8f6b5`, live)

- **Gemeinsame Bausteine** in `components/layout/list-blocks.tsx`: `SearchField` (Pille), `ChipRow` (wischbar, ab
  Tablet umbrechend, `shrink-0` + Mindesthöhe), `CountChip` (Chip mit Zähler-Bubble), `SegmentToggle` (kleiner
  Umschalter, Icon mit oder ohne Text), `GroupHeading`/`groupHeadingClass`, `ListCard`; dazu `FabButton` neben
  `NewRecipeFab`. Rezeptliste, Rezept-Filter und Vorrat nutzen sie jetzt auch (vorher kopierter Code). `PageHeader`
  hat eine Zeile `meta` über die volle Breite. Chips sind jetzt 44 px hoch (vorher 40 px), auch auf der Startseite;
  die Knöpfe im Ansicht-Umschalter ebenso.
- **Kopf:** „Zutaten“, darunter eine Zeile: Schloss + „Preise siehst nur du“, rechts „Alle Preise ›“ (→ /preise).
- **Filter:** Chip-Reihe Alle / In Rezepten / Selbst angelegt / Ohne Preis mit Zählern, am Ende der Kategorie-Chip
  (native Auswahl im Chip-Look, aktiv wenn gewählt). Zähler berücksichtigen Suche und Kategorie
  (`filterMyIngredients` kann jetzt auch `group`).
- **Über der Liste:** Trefferzahl („13 Zutaten“) und Umschalter „A–Z“ | Icon „Nach Kategorie“.
- **Abschnitte:** A–Z je Anfangsbuchstabe (Ä/Ö/Ü unter A/O/U, Ziffern unter „#“; `groupByInitial`), Anzahl rechts.
  Nach Kategorie je Zutatengruppe in der Reihenfolge der Spec (`FOOD_GROUP_ORDER`; vorher Supermarkt-Reihenfolge),
  rechts „x / y mit Preis“. Jeder Abschnitt eine Karte, Zeilen ≥ 68 px.
- **Zeile:** Name einzeilig mit Ellipse, selbst angelegte mit Label „Eigene“ (statt Stift). Zweite Zeile: Gruppe (nur
  A–Z) · Quelle (nicht bei eigenen) · „1 Rezept“/„3 Rezepte“/„in keinem Rezept“. Rechts Preis groß („0,65 €“) mit
  „/ 100 ml“ bzw. „/ 100 g“ (Stück ohne Stückgewicht: Preis pro Stück, „/ Stück“) oder gestrichelter Knopf „+ Preis“;
  beides öffnet den Dialog im Bereich „Preis“. Die übrige Zeile öffnet den Dialog im Bereich „Angaben“ bzw.
  „Bearbeiten“ (vorher öffnete jeder Tipp den Bereich „Preis“; der hat jetzt eigene Knöpfe).
- **Plus-Knopf** „Zutat anlegen“ unten rechts: bestehendes Formular für eine eigene Zutat (Suchbegriff als Name
  vorbelegt, Knopf „Zutat anlegen“; `IngredientForm` hat dafür `submitLabel`). Auch bei leerer Liste da.
- **Nichts gefunden:** gestrichelte Karte „Keine Zutat gefunden“ mit Hinweis auf den Plus-Knopf.
- Geprüft: 322 Tests, Typecheck, Lint, Build grün. Layout bei 375 px in Dark und Light über eine temporäre
  Vorschauseite mit Beispieldaten (gegen den Produktions-Build, danach gelöscht): kein seitliches Scrollen, Chip-Reihe
  48 px hoch und wischbar, alle Knöpfe ≥ 44 px, Zeilen 68 px, Kategorie-Filter/Zähler/Umschalter/leerer Zustand/
  Plus-Dialog funktionieren. Nicht mit echtem Login geprüft (Preis speichern, Zutat anlegen).
- Hinweis: Der laufende Entwicklungsserver lieferte serverseitig die alten Module aus (Turbopack-Cache, siehe
  „Bekannte Probleme“); Abhilfe wie dort: stoppen, `.next/dev` löschen, neu starten (am 24.10. zweimal nötig).

### Teil 2: Wochenplan (Commits `4666deb`, `77de69b`, live)

- **Kopf:** „Wochenplan“, rechts runder Icon-Knopf „Woche kopieren“ (44 px, aria-label; derselbe Dialog wie bisher).
- **Wochenwechsel:** eine Leiste wie der Küche/Bar-Umschalter: Pfeile links/rechts, Mitte „KW 43 · 19.10.–25.10.“ und
  darunter „Diese Woche“ (Akzent) bzw. grau „Letzte Woche“, „Nächste Woche“, „In 2 Wochen“, „Vor 3 Wochen“
  (`weekRangeLabel`, `relativeWeekLabel`, Tests). Die Mitte führt zur aktuellen Woche und wählt heute. Die Leiste
  sitzt jetzt im `WeekPlanner` (Client), damit der Sprung zu heute auch in der aktuellen Woche wirkt.
  Nachtrag: Am Handy war die Leiste zuerst riesig (Pfeile übereinander), weil das Handy eine veraltete CSS-Datei
  ohne die neue Spalten-Regel hatte (vermutlich durch `next build` neben dem laufenden Dev-Server). Die Leiste nutzt
  jetzt Flex statt einer eigenen Grid-Regel. Regel für später: `next build` nicht neben dem LAN-Server laufen lassen
  bzw. danach am Handy neu laden.
- **Tagesleiste:** 7 gleich breite Kacheln im Grid (46 × 64 px bei 375 px, kein Scrollen): Wochentag, Tagesnummer,
  Balken 24 × 4 px mit kcal/Tagesziel (`kcalBar`: grün 90–110 %, Akzent darüber, grau darunter, leer ohne Einträge;
  ohne kcal-Ziel voll grau). Hantel oben rechts an Trainingstagen, gewählt = Akzent-Fläche, heute = Akzent-Rahmen.
  Die Pfeile „Vorheriger/Nächster Tag“ neben dem Datum sind entfallen (Kacheln und Wischen bleiben).
- **Tageskopf:** Datum in Fraunces, Label „Heute“; rechts der Trainings-Schalter als Pill (aria-pressed): an
  „Trainingstag“ mit Akzent-Rahmen und getönter Fläche (wie aktive Chips), aus grau „Kein Training“. Bei langen
  Wochentagen (Donnerstag) rutscht er rechtsbündig in die nächste Zeile.
- **Ziel-Karte** (`plan/goal-card.tsx`, ersetzt `goal-progress.tsx`): „Ziel Ruhetag/Trainingstag“, kcal groß mit
  „/ 2.400 kcal“, rechts „noch … kcal“ bzw. „… kcal drüber“ (Akzent), breiter Balken; darunter Protein,
  Kohlenhydrate („Kohlenh.“), Fett in drei Spalten mit Farbpunkt, „47 / 170 g“, schmalem Balken und „noch … g“
  (Protein über dem Ziel: „Ziel erreicht“, sonst „… g drüber“). Kosten des Tages unten in der Karte. Balken bleiben in
  den Makrofarben (vorher rot ab 110 %).
- **Lücken-Hinweis** (Phase 11 gibt es): ab 25 g fehlendem Protein getönte Karte „Noch 124 g Protein offen“ mit dem
  besten Vorschlag aus `gapSuggestions` (Titel, ggf. ½ Portion, +Protein, Ziel-Slot) und Knopf „Einplanen“: trägt
  direkt ein (`addPlanEntryAction`), in „Abend“ oder als „Snack“, wenn am Abend schon etwas steht. Passt nichts, steht
  dort ein Hinweis statt des Knopfs. **Ersetzt** die alte Lücken-Box (bis zu 3 Vorschläge, auch für kcal-Lücken, mit
  Einplanen-Dialog); Meal-Prep-Reste und Reste-Ideen bleiben darunter wie bisher.
- **Mahlzeiten:** Überschrift im Stil der Gruppen-Überschriften mit kcal-Summe rechts. Mit Einträgen eine Karte:
  48-px-Vorschaubild (Rezeptfoto, sonst Topf-Symbol; `PlanEntry.imagePath` aus `recipes.image_url`, nur Abfrage
  erweitert), Name, „1 Portion · 47 g Protein“, rechts kcal; Labels „Rest“ (grün, Kreis-Pfeil) und „Meal Prep“ am
  Kochtag; unten „+ Hinzufügen“. Leerer Slot: gestrichelter Knopf „Rezept einplanen“. Antippen öffnet die
  Bearbeitung wie bisher. Gemeinsames Label `TagLabel` (auch „Eigene“, „Heute“).
- **Wochenübersicht** (Titel relativ, z. B. „Diese Woche“): Ø kcal/Tag, Ø Protein/Tag (nur Tage mit Einträgen) und
  „Tage im Ziel“ (kcal 90–110 % des jeweiligen Tagesziels, `inKcalTarget`, Tests), Kosten der Woche wie bisher, Knopf
  „Einkaufsliste aus dieser Woche“: öffnet den bestehenden Dialog mit Mo–So dieser Woche vorbelegt, danach geht es zur
  Einkaufsliste (`GenerateDialog` mit `triggerLabel`/`openListAfter`; Hinweis „werden ersetzt“ per
  `hasPlanShoppingItems`). Die vier Summen-Kacheln und der Durchschnitts-Fortschritt sind dafür entfallen.
- **Desktop** (ab 1024 px): Raster Mo–So bleibt, mit Slot-Überschriften im neuen Stil, Labels „Rest“/„Meal Prep“ und
  darunter Ziel-Karte und Lücken-Karte des gewählten Tags.
- Geprüft: 326 Tests, Typecheck, Lint, Build grün. Layout über eine temporäre Vorschauseite mit Beispieldaten (danach
  gelöscht) bei 375 px in Dark und Light und bei 1280 px: kein seitliches Scrollen, alle Knöpfe ≥ 44 px, Balkenfarben
  je Tag richtig, „600 kcal drüber“, „In 2 Wochen“, leere Slots, Einkaufs-Dialog mit 19.10.–25.10. Nicht mit echtem
  Login geprüft (Einplanen aus der Lücken-Karte, Trainings-Schalter speichern, Liste erstellen).

## Wünsche vom 24.10.2026 (Nachtrag): Rezeptseite im neuen Design, eigene Kategorien

**Live** seit 24.10.2026: vom Nutzer am Handy getestet; Push `e14c0d0` (mit `596e656`, `fb366a4`) → Deployment
`dpl_4d91oRcimEwCK7DKPsqSneL5CpKE` (`production`, `fra1`, `source: git`, nach ca. 43 s „READY“, auf
unser-rezeptbuch.vercel.app geschaltet; per Vercel-Connector geprüft).

**Datenbank:** Migration `custom_categories` am 24.10.2026 von Claude über die
Supabase-Verbindung eingespielt (mit Freigabe des Nutzers). Geprüft per SQL: 12 Kategorien (11 Standard + „Getränk“,
weil ein Gericht es nutzt), alle 19 Gerichte zugeordnet, keine Abweichung Enum/Name, kein `updated_at` verändert;
Test als Nutzer (zurückgerollt): Umbenennen, Löschen mit Verschieben, Sync alte/neue App, doppelte Namen abgelehnt.
Security-Advisor: nichts Neues. **Nachtrag:** Die Kurznamen-Migration `…20261024090000_ingredient_display_name` war
entgegen dem Eintrag unten nie in der Datenbank (die App fing das ab); ebenfalls am 24.10. von Claude eingespielt.

### Rezeptseite (Entwurf „Rezept-Detail“)

- Neuer Kopf `components/recipes/recipe-hero.tsx`: oben Pille „← Rezepte/Cocktails/Entdecken“, runde Knöpfe Herz und
  ⋮ (Duplizieren, Als Markdown, Löschen; `RecipeMenu`). Foto mit rundem Kamera-Knopf (und Entfernen), ohne Foto ein
  Platzhalter mit Topf bzw. Glas und „Foto hinzufügen“. Darunter Kategorie-Zeile in Akzent (Kategorie · Auto-Tags bzw.
  Spirituose · Methode), Titel.
- **Privat | Öffentlich** jetzt direkt unter dem Titel als Segment-Umschalter (aria-pressed) mit einer Zeile Hinweis;
  der Kasten unten auf der Seite ist weg.
- Drei Kacheln: Küche Zeit („10 Vorb. · 15 Kochen“) / Portionen / Kosten pro Portion; Bar Glas / Eis (Garnitur) /
  Stärke („≈ 18 % vol“, nach Verdünnung).
- „Kochen starten“ bzw. „Mixen starten“ und daneben „Bearbeiten“ (fremde Rezepte: „Übernehmen“ bzw. „Deine Kopie
  öffnen“), beide 48 px hoch und rund. Nährwert-Karte heißt „Pro Portion“ mit kcal rechts (ohne doppelte kcal-Kachel).
- Eigene Tags stehen unter den Kacheln, Auto-Tags in der Kategorie-Zeile.

### Eigene Kategorien (Einstellungen → Kategorien)

Entscheidungen des Nutzers: jeder hat seine eigene Liste; beim Löschen wählt man, wohin die Rezepte wandern (oder
„ohne Kategorie“); auch die 12 bisherigen Kategorien sind löschbar und umbenennbar.

- **Migration** (additiv, die Live-Version läuft weiter): Tabelle `recipe_categories` (RLS nur eigene, Cascade,
  eindeutig je Nutzer ohne Groß-/Kleinschreibung), Spalte `recipes.category_name` (Text). Die alte Enum-Spalte bleibt;
  ein Trigger hält beide synchron (alte App schreibt den Schlüssel → Name; neue App schreibt den Namen → Schlüssel, wenn
  es eine Standard-Kategorie ist). Startliste (11 Küchen-Kategorien, „Getränk“ nur, wo ein Gericht es nutzt) für alle
  Nutzer und neue Nutzer (`handle_new_user`). `save_recipe`, `duplicate_recipe`, `fork_shared_recipe`,
  `get_shared_recipe` kennen `category_name`. Funktionen `rename_recipe_category` und `delete_recipe_category`
  (verschiebt die eigenen Küchen-Rezepte mit). Sammel-Updates lassen „zuletzt geändert“ stehen. Cocktails haben keine
  Kategorie mehr (vorher intern „Getränk“). Später, wenn die alte App nicht mehr läuft: Enum-Spalte per Migration
  entfernen.
- **App:** Kategorie ist überall Text (`domain/categories.ts`: Startliste, alte Schlüssel → Namen, Auswahl, Tests).
  Abfragen laden `category:category_name`. Editor und Filter zeigen die eigene Liste (plus eine Kategorie, die nicht
  in der Liste steht, z. B. bei übernommenen Rezepten); Entdecken zeigt die Kategorien der öffentlichen Rezepte.
  Import (Link, Markdown) übernimmt eine erkannte Kategorie nur, wenn sie in der eigenen Liste steht. Alte Links
  (`?kategorie=pasta`), alte Sicherungen und geteilte Karten werden umgerechnet. Datenexport enthält die Liste.
- **Einstellungen → Kategorien:** Liste mit Anzahl Rezepte, Stift (umbenennen, Enter/Escape), Papierkorb (Dialog mit
  „Rezepte verschieben nach …“), Feld „Neue Kategorie“ + „Hinzufügen“. Doppelte Namen meldet die App.
- Geprüft: 330 Tests, Typecheck, Lint, Build grün; Layout von Rezeptkopf (Küche, Bar, hell/dunkel) und Kategorien-Liste bei
  375 px über temporäre Vorschauseiten (gelöscht). **Nicht geprüft:** die Migration selbst (Claude hat keinen
  Datenbankzugang) und alles mit echtem Login (Speichern, Umbenennen, Löschen mit Verschieben).

## Wünsche vom 25.10.2026: Rezept-Editor im neuen Design

**Live** seit 25.10.2026: vom Nutzer am Handy über den LAN-Server getestet; Push `4f775cc` (mit `9b5e23b`, `c91ae8c`,
`ac8ef1c`, `81d346b`) → Deployment `dpl_2QPc4ZYuu8PqYQun3wNBfpHoWnpQ` (`production`, `fra1`, `source: git`, nach ca. 66 s
„READY“, auf unser-rezeptbuch.vercel.app geschaltet; per Vercel-Connector geprüft). Migration `…20261025100000_step_timer_from_text` am
25.10.2026 von Claude über die Supabase-Verbindung eingespielt (mit Freigabe des Nutzers). Feinschliff, keine neue Phase.

Entscheidungen des Nutzers: Drag & Drop mit **dnd-kit** (`@dnd-kit/core`, `/sortable`, `/utilities`, einzige neue
Abhängigkeiten); Bottom-Sheet auf dem **Drawer von Base UI** (schon installiert, statt shadcn/vaul); Timer „Keiner“ als
neue Spalte; App-Kopf im Editor am Handy ausblenden.

- **Seitenrahmen** (`/rezepte/neu`, `/rezepte/[id]/bearbeiten`, erkannt per `isEditorPath`): ohne untere Navigation, am
  Handy ohne App-Kopf (`AppHeader`). Eigener Kopf (`editor-header.tsx`, am Handy angeheftet): X „Abbrechen“ (bei
  ungespeicherten Änderungen Dialog „Änderungen verwerfen?“), klein „Rezept bearbeiten“/„Neues Rezept“, darunter der
  Titel (live). Speicherleiste unten fest (Safe Area), links „521 kcal · 27 g P / pro Portion“ (Bar: % vol · kcal),
  rechts „Speichern“; am Desktop mitlaufend unten im Inhalt. In Link- und Markdown-Import bleibt alles wie bisher
  (Leiste über der Navigation, „Überspringen“).
- **Grunddaten** (`basics-section.tsx`): Karte Titel (groß, Fraunces, ohne Rahmen) / Beschreibung; „Eckdaten“ mit
  Portionen-Stepper, Vorbereitung und Kochen als große Zahl („= 3 Std.“ ab 60 Min.), Gesamtzeit; „Einordnung“ mit
  Kategorie als wischbare Chip-Leiste (Radiogruppe, Pfeiltasten; erneut tippen hebt auf), Meal-Prep, Tags (Auto-Tags
  grün mit Funkeln, nicht entfernbar). „Quelle“ (Link-Symbol) steht ganz unten im Editor, nach „Was hast du geändert?“
  (Wunsch des Nutzers). Cocktails: Drinks, Zubereitung, Glas und Methode als
  Chip-Leisten, Eis, Garnitur.
- **Zutaten** (`ingredients-section.tsx`): Kopf mit Anzahl und „Liste | Nach Schritt“, Nährwert-Karte (kcal pro
  Portion, Balken der kcal-Anteile P/KH/F, Legende in g; Cocktails mit Alkoholgehalt). Kompakte Zeilen: Griff, Name,
  Meta „S3 · Notiz · kcal“, Menge rechts. Optional gedimmt mit gestricheltem „optional“ und „nicht eingerechnet“.
  „Nach Schritt“: eine Karte je Schritt (auch leere als Ablageziel) und „Ohne Schritt“; Ziehen in eine andere Gruppe
  ändert die Zuordnung, Escape stellt den Stand wieder her.
- **Zutat-Sheet** (`ingredient-sheet.tsx`): Name, Gruppe, kcal je 100 g, „Austauschen“; Menge mit −/+ (Schrittweite je
  Einheit, `stepAmount`), Einheit als Segmente (g, ml, Stück, EL, TL, „Mehr“: cl, Prise, Dash, Barlöffel, „Ohne
  Menge“), live kcal und P/KH/F; ggf. „Wie viel wiegt das zusammen?“; „Gebraucht in Schritt“ als wischbare Karten
  (die gewählte beim Öffnen im Bild); Notiz; Optional; „Entfernen“ (mit Rückgängig) und „Fertig“. Neue Zutat: nach der
  Suche öffnet sich direkt das Sheet.
- **Zubereitung** (`steps-section.tsx`, `step-sheet.tsx`): Gesamtzeit-Chip, kompakte Schritte (bis 10 Zeilen) mit
  Timer-Chip und Zutaten-Chip („Zwiebeln, Knoblauch +2“). Sheet: Anleitung, Timer „Aus dem Text | Eigener | Keiner“
  (erkannte Zeiten bzw. Minutenfeld), „Zutaten in diesem Schritt“ (antippen ordnet zu bzw. löst; „S3“ an Zutaten anderer
  Schritte), Entfernen (mit Rückgängig). Ein neuer Schritt, der leer bleibt, verschwindet beim Schließen.
- **Drag & Drop** (`sortable.tsx`): nur am Griff (Scrollen bleibt frei), Tastatur (Leertaste, Pfeile, Escape), Ansagen
  auf Deutsch. ↑/↓/Papierkorb-Leisten und die Timer-Felder je Schritt sind weg. Die Zuordnung Zutat → Schritt hängt am
  Schlüssel des Schritts und wandert beim Verschieben mit; gelöschte Schritte → „Ohne Schritt“.
- **Sheets** (`components/ui/drawer.tsx`, `EditorSheet`): Handy Drawer von unten (Wischen schließt), ab 768 px Dialog
  (max. 640 px). Alle Änderungen wirken nur aufs Formular, gespeichert wird mit „Speichern“.
- **Timer „Keiner“** – Migration (additiv, alte App speichert weiter): Spalte `recipe_steps.timer_from_text` (Standard
  true); `save_recipe`, `recipe_snapshot` (Schlüssel nur bei false: Inhalts-Prüfsumme aller Rezepte vor/nach gleich),
  `duplicate_recipe`, `fork_shared_recipe`. Kochmodus: Zeiten im Text sind nur antippbar, wenn „Aus dem Text“; bei
  eigenem Timer nur dessen Knopf (vorher beides). Sicherung (nur bei false), Versionsvergleich, Validierung angepasst.
  Geprüft per SQL als Rezept-Besitzer (zurückgerollt): unverändert speichern → keine neue Version; „Keiner“ → neue
  Version, Flag gespeichert; Duplizieren übernimmt es. Security-Advisor: nichts Neues.
- Behoben: Hydration-Abweichung bei den Editor-Schlüsseln (offener Punkt seit Phase 9): Schlüssel fortlaufend ab 1,
  `DndContext` mit fester `id`.
- Reine Logik in `domain/recipe-editor.ts` mit Tests (Chip-Text, Mitwandern beim Verschieben/Löschen, Gruppen, Ablegen
  zwischen Gruppen, Mengen-Schritte, kcal-Anteile, Zeiten, Timer-Chips); `isEditorPath` getestet.
- Geprüft: 351 Tests, Typecheck, Lint, Build grün. Über eine temporäre Vorschauseite mit einer Bolognese (danach
  gelöscht) bei 375 px in Dark und Light und bei 1280 px: kein seitliches Scrollen, Sheets, Einheiten, Schrittkarten,
  Timer „Keiner“, Zuordnen per Chip, Schritt löschen + Rückgängig (Zuordnungen wandern mit), Ziehen per Maus (Schritte,
  Zutaten zwischen Gruppen) und per Tastatur, Fehler beim Speichern ohne Titel. **Nicht geprüft:** echtes Speichern,
  Zutatensuche und neue Zutat mit Login, Wischen am echten Handy.

## Prüfung 25.10.2026: Rezeptfotos im Storage aufräumen

**Befund:** Entfernen, Ersetzen und Rezept löschen haben die Dateien schon vorher serverseitig gelöscht. Live-Abgleich
(nur lesend): 68 Dateien im Bucket = 34 Rezeptfotos mit Vorschaubild, keine verwaisten Dateien, keine fehlenden.

**Live** seit 25.10.2026: vom Nutzer am LAN-Server getestet (Foto ersetzen, Rezept löschen); danach Bucket per SQL
geprüft: 68 Dateien = 34 Fotos mit Vorschaubild, nichts verwaist, nichts fehlt. Push `b667ec7` → Deployment
`dpl_Bb8GApMoKi6HrxJptCTPMpN6Kc32` (`production`, `fra1`, `source: git`, nach ca. 39 s „READY“, auf
unser-rezeptbuch.vercel.app geschaltet; per Vercel-Connector geprüft).

**Absicherung** (ohne Migration):
- **Rezept löschen:** erst das Rezept, dann den Foto-Ordner leeren (vorher umgekehrt: Schlug das Löschen fehl, blieb ein
  Rezept mit totem Foto). Live per SQL als Besitzer geprüft (zurückgerollt): Die Dateien bleiben nach dem Löschen des
  Rezepts für ihn sichtbar und damit löschbar (Policies: eigener Ordner).
- **Ersetzen:** löscht alles im Ordner `<owner>/<rezept>/` außer dem neuen Foto und seinem Vorschaubild, also auch Reste
  abgebrochener Uploads (`staleFilesInFolder` in `domain/photo.ts`, Tests; `cleanRecipePhotoFolder`). **Entfernen**
  leert den Ordner ebenso.
- **Fehler** beim Löschen im Storage landen im Server-Log (`console.error`, Vercel → Logs) statt still ignoriert zu
  werden; die Aktion selbst gilt weiter als erfolgreich.
- 353 Tests, Typecheck, Lint grün. Nicht im Browser geprüft (Foto hochladen braucht Login).

## Sport & Gesundheit (ab 26.10.2026)

Plan vom 26.10.2026 (vom Nutzer bestätigt), je Phase ein Durchgang mit Test und OK:

- **S1 – Gerüst, Übungen, Pläne** (dieser Stand)
- **S2 – Training im Gym:** „Training starten“ (nächster Tag der Reihe), Trainingsdauer, Werte vom letzten Mal hell im
  Satz (antippen übernimmt), Aufwärmsätze aus dem Arbeitsgewicht (auf Scheiben gerundet), Pausentimer mit Vibration,
  Bildschirm an, Übungen tauschen/hinzufügen/entfernen und verschieben, am Ende „Änderungen in den Plan übernehmen?“,
  **Speichern auch ohne Netz** (jeder Satz zuerst auf dem Handy, Hochladen sobald Netz da ist), Verlauf, Widgets
- **S3 – Statistik:** je Übung Gewicht/geschätztes 1RM (Epley), Volumen, Bestwerte; Trainings pro Woche, Dauer,
  Volumen, Sätze pro Muskelgruppe und Woche, Serie, Kalender; Zeiträume als Chips; später Getränke/Gewicht/Körpermaße
- **S4 – Entdecken und Daten:** Pläne veröffentlichen, fremde Pläne starten oder übernehmen
  (`copy_training_plan` ist schon da), Sport-Sicherung exportieren/importieren (nur eigenes Format), Prüfung
  Datenexport/Account-Löschung, `DATENVERARBEITUNG.md`
- Später als eigene Phasen: Getränketracker, Lexikon, Körpermaße, Energiebedarfsrechner (bis dahin „Kommt bald“-Seiten)
- Idee (nur auf Wunsch): erledigtes Training markiert den Tag im Wochenplan als Trainingstag

Entscheidungen des Nutzers (26.10.2026): Pläne mit Trainingstagen; Training auch ohne Netz; Import nur der eigenen
Sicherung; „Kommt bald“-Punkte als Platzhalterseiten.

### Phase S3: Statistik

Keine Migration (alles aus `workouts`, `workout_exercises`, `workout_sets`).

- **Seite** `/sport/statistik` (vorher „Kommt bald“): Zeitraum als Chips (4 Wochen, 3 Monate, 1 Jahr, Alles; Start
  3 Monate), alles im Browser gerechnet aus den beendeten Trainings (`getWorkoutStatsData`).
- **Kennzahlen:** Trainings (und pro Woche), Ø Dauer (und gesamt), Volumen (kg bzw. t, Arbeitssätze), Serie (Wochen am
  Stück mit Training, die laufende Woche darf noch leer sein).
- **Diagramme** (Recharts, Farben aus der geprüften Diagramm-Palette, je Diagramm Tooltip und Tabellenansicht):
  Trainings pro Woche, Volumen pro Woche, Dauer pro Woche; **Übung im Verlauf** (Auswahl nach Häufigkeit): geschätztes
  1RM (Epley, nur bis 12 Wdh.) und schwerster Satz als zwei Linien in kg mit Legende, bei Zeit/Strecke/Körpergewicht
  eine Linie (längster Satz, Strecke, meiste Wdh.); Tipp auf einen Punkt öffnet das Training; Bestwerte-Kacheln
  (schwerster Satz mit Wdh., 1RM, bestes Volumen, meiste Wdh.). **Sätze pro Muskelgruppe** pro Woche (Nebenmuskeln
  halb) als Balken mit Band 10–20. **Trainingstage** der letzten 12 Wochen als Kalender. **Neue Bestwerte** (Steigerung
  gegenüber allen früheren Trainings, das erste zählt nicht) mit Link zum Training. Hinweis, dass Körpergewicht,
  Körpermaße und Getränke später dazukommen.
- Logik in `domain/workout-stats.ts` (Tests).
- Geprüft: 412 Tests, Typecheck, Lint, Build grün. Über eine temporäre Vorschauseite mit 12 Wochen Beispieldaten (danach
  gelöscht) bei 375 px: kein seitliches Scrollen, Tooltips, Kennzahlen ohne Umbruch. **Nicht geprüft:** mit echten
  Daten und Login.

### Phase S2: Training im Gym

**Live** seit 26.10.2026: Push `b8a4bc9` (mit `2ad403b`) → Deployment `dpl_CPtPEeRbAhhrzPxe4aLioMk78pyr` (`production`,
`fra1`, `source: git`, nach ca. 100 s „READY“, auf unser-rezeptbuch.vercel.app geschaltet; per Vercel-Connector
geprüft). Migration `sport_workouts` war vorher eingespielt. Der Offline-Teil (Service Worker v2) ist erst live
testbar; vom Nutzer noch zu prüfen: Training im Gym mit Funkloch, Neuladen ohne Netz, Ton/Vibration.
**Nächster Schritt:** Phase S3 (Statistik) nach OK des Nutzers.

- **Migration** `…20261026150000_sport_workouts` (additiv): Typ `workout_set_kind` (warmup/normal); Tabellen `workouts`
  (Plan/Tag `on delete set null`, Titel, Start, Ende = null solange es läuft, Notiz, `version` = Stand-Zähler des Handys;
  höchstens ein laufendes Training je Nutzer per Teil-Index), `workout_exercises` (Vorgaben aus dem Plan, Übung
  `restrict`), `workout_sets` (Art, kg, Wdh., Sekunden, Meter, erledigt). IDs erzeugt das Handy. RLS: nur der Nutzer
  (`private.owns_workout`). `sync_workout(jsonb)` speichert das ganze Training atomar und ignoriert ältere Stände;
  `last_exercise_sets` liefert je Übung die erledigten Arbeitssätze des letzten beendeten Trainings.
- **Training starten** (Planseite, Dialog mit den Tagen, vorausgewählt der nächste nach dem zuletzt trainierten;
  „Freies Training ohne Plan“ auf der Pläne-Seite). Läuft schon eins: Fortsetzen oder Verwerfen und neu starten.
- **Training im Gym** (`/training/[id]`, Vollbild ohne Navigation wie der Kochmodus, Bildschirm bleibt an):
  Dauer oben, je Übung Sätze mit „Zuletzt“ und den Werten vom letzten Mal hell in den Feldern (Abhaken übernimmt
  sie; ab dem Satz, den es letztes Mal nicht gab, gilt der letzte bekannte), Felder je Erfassung (kg/Wdh., +kg/Wdh.,
  Zeit, km/Zeit; Zeiten als 45 oder 1:30), Abhaken (grün), Satz +/−, Aufwärmsätze berechnen (leere Stange × 10,
  50/70/85 % × 8/5/3, auf 2,5 kg bzw. Gerätschritt gerundet; Knopf direkt unter Übungen mit „Aufwärmsätze“ im Plan, sonst
  im Menü), Pausentimer nach jedem Arbeitssatz (−15/+15, Überspringen, Ton und Vibration), Übungen tauschen,
  hinzufügen (mit Werten vom letzten Mal, wenn Netz da ist), entfernen (mit Rückgängig), per Drag & Drop verschieben,
  Notiz je Übung und zum Training, Training verwerfen.
- **Ohne Netz:** Jede Änderung landet sofort im `localStorage` (`training:<id>`) und wird entprellt hochgeladen
  (`syncWorkoutAction`, ganzes Training mit Versionszähler); ohne Netz neuer Versuch beim Ereignis „online“ bzw. alle
  15 s. Anzeige oben: Wolke = gespeichert, „offline gesichert“. Beim Laden gilt der neuere Stand (Handy oder Server).
  Der Service Worker (Version v2) speichert die Seite `/training/<id>` beim Laden, damit Neuladen im Funkloch geht;
  Beenden/Verwerfen/Abmelden löschen sie und den lokalen Stand. Abgelaufene Anmeldung leitet beim Hochladen nicht zum
  Login um (der Stand bleibt auf dem Handy). **Offline nur im fertigen Build prüfbar** (Service Worker läuft nicht beim
  Entwickeln); das Speichern im `localStorage` und Neuladen ist im Entwicklungsserver geprüft.
- **Beenden:** Zusammenfassung (Dauer, Sätze, Volumen); nicht erledigte Sätze und Übungen ohne erledigten Satz fallen
  weg, leere erledigte Sätze bekommen die Werte vom letzten Mal. Danach Verlaufsseite mit „Training gespeichert“ und,
  wenn Übungen, Reihenfolge oder Satzzahl vom Plan-Tag abweichen, **„Änderungen in den Plan übernehmen?“**
  (Vorgaben wie Wdh./Pause/Notiz bleiben). Ohne Netz: Hinweis „auf dem Handy gesichert“, Hochladen sobald möglich.
- **Verlauf** (`/sport/verlauf`, Tabs „Pläne | Verlauf“, nach Monat): Trainings mit Dauer, Sätzen, Volumen; Detail mit
  allen Sätzen, Fortsetzen (wenn es läuft), Löschen. Banner „Training läuft“ auf Pläne, Verlauf und Planseite.
- **Startseite:** Sport-Karte „Als Nächstes: Tag B · Rücken“ bzw. „Training läuft seit …“; neues Widget **„Training
  diese Woche“** (Anzahl, Dauer, Mo–So, zuletzt). Für bestehende Anordnungen wird es hinten angehängt.
- **Sicherung Version 2** (Trainingsdaten exportieren/importieren): auch beendete Trainings (Plan/Tag über Namen,
  nur erledigte Sätze); Import überspringt Trainings mit gleicher Startzeit. Version 1 geht weiter. Datenexport:
  `trainings`.
- Reine Logik in `domain/workout.ts` (Aufwärmsätze, Anzeige/Eingabe, Abschluss, Zusammenfassung, Rotation,
  Training → Plan) mit Tests; `domain/sport-backup.ts` erweitert.
- Geprüft: 402 Tests, Typecheck, Lint, Build grün. Live-Ansicht über eine temporäre Vorschauseite (gelöscht) bei 375 px
  hell/dunkel: Aufwärmsätze (60 kg → 20×10, 30×8, 42,5×5, 50×3), Abhaken übernimmt die hellen Werte, Pausentimer,
  Neuladen stellt den Stand vom Handy wieder her, Beenden-Dialog. **Nicht geprüft:** echtes Speichern mit Login,
  Offline im fertigen Build, Ton/Vibration am Handy.
- **Migration eingespielt** am 26.10.2026 von Claude über die Supabase-Verbindung (mit Freigabe des Nutzers; in
  Supabase unter `sport_workouts`). RLS auf allen drei Tabellen, keine Rechte für `anon`, Security-Advisor ohne neue
  Hinweise. Per SQL als Admin geprüft (zurückgerollt): Training anlegen (Version 1), älterer Stand (Version 0) wird
  ignoriert, zweites laufendes Training wird abgelehnt (23505), Abschluss mit Version 3 speichert beide Sätze,
  `last_exercise_sets` liefert den erledigten Arbeitssatz (62,5 kg × 8, Aufwärmsatz nicht); ein anderes Konto sieht das
  Training nicht und kann es nicht überschreiben. Danach 0 Trainings in der Datenbank.

### Phase S1: Gerüst, Übungsdatenbank, Trainingspläne

**Live** seit 26.10.2026: vom Nutzer am LAN-Server getestet (Pläne, Einstellungen je Bereich, Trainingsdaten);
Push `328a111` (mit `3345c5d`, `110e75f`, `236bd4b`, `c3c42ea`) → Deployment `dpl_8osHw7M2azqMqieyhkDKcFKAbVyF`
(`production`, `fra1`, `source: git`, nach ca. 77 s „READY“, auf unser-rezeptbuch.vercel.app geschaltet; per
Vercel-Connector geprüft). Migration `sport_plans` war vorher eingespielt. **Nächster Schritt:** Phase S2 (Training im
Gym) nach OK des Nutzers.

**Nachtrag 26.10.2026 (Rückmeldung des Nutzers nach dem ersten Test):**
- **Einstellungen im Sport-Bereich** sprangen auf Essen & Trinken. Einstellungen und Nutzerverwaltung sind jetzt
  gemeinsame Seiten: Das Profilmenü verlinkt im Sport-Bereich auf `/einstellungen?bereich=sport` (`sharedHref`),
  Kopf, Umschalter, Seiten- und untere Leiste lesen den Bereich über `useArea()` (Pfad + `?bereich=`). Die
  Einstellungen zeigen je Bereich die passenden Abschnitte: Sport = Profil, Passwort, **Trainingsdaten**, Account
  löschen; Essen & Trinken wie bisher.
- **Trainingsdaten exportieren/importieren** (eigentlich für S4 geplant, vorgezogen): `/einstellungen/sport-sichern`
  lädt eine Sport-Sicherung (`rezeptbuch-sport`, Version 1: Pläne mit Tagen und Übungen, auch ausgeblendete, und
  eigene Übungen; Übungen mit Namen und Eckdaten). Import (`importSportBackupAction`): Übungen über den Namen
  zuordnen (eigene vor Grundbestand, Umlaute/Groß-Klein egal), fehlende als eigene anlegen, Pläne als neue eigene
  speichern; Pläne mit schon vorhandenem Namen werden übersprungen. Logik in `domain/sport-backup.ts` (Tests).
  Trainings kommen mit S2 als Version 2 dazu.
- 386 Tests, Typecheck, Lint, Build grün. **Nicht im Browser geprüft** (Einstellungen brauchen Login).
- **Einstellungen von der Startseite** (Wunsch des Nutzers, nachdem Sport funktionierte): Das Profilmenü verlinkt dort
  auf `/einstellungen?bereich=start`; die Seite gehört dann zu „Start“ (Umschalter zeigt Start, keine Seiten- oder
  untere Leiste) und führt beide Bereiche zusammen: Profil, Passwort, Zwischenüberschrift „Essen & Trinken“ mit allen
  Küchen-Einstellungen, „Sport & Gesundheit“ mit Trainingsdaten (ohne den doppelten Knopf „Meine Daten“), Account
  löschen. Nicht im Browser geprüft (Login).

- **Migration** `…20261026120000_sport_plans` (additiv): Enums `muscle_group`, `exercise_equipment`,
  `exercise_tracking`; Tabellen `exercises` (Grundbestand 120 Übungen auf Deutsch, eigene mit `created_by`, alle
  lesen wie Zutaten), `training_plans` (privat/öffentlich, `is_archived` = ausgeblendet, `forked_from_id`),
  `training_plan_days` (Name, Fokus, Reihenfolge), `training_plan_exercises` (Sätze, Wdh. von–bis oder Sekunden,
  Pause, Aufwärmen, Notiz; Übung `on delete restrict`). RLS wie Rezepte (Kindtabellen über
  `private.owns_training_plan`/`can_read_training_plan`). `save_training_plan` speichert atomar und behält die IDs
  der Tage (spätere Trainings verweisen darauf), `copy_training_plan` kopiert (Duplizieren, später Übernehmen).
  Hinweis: `plan_days` gibt es schon (Wochenplan), daher die Präfixe `training_`.
- **Navigation:** Bereich Sport ist aktiv (Umschalter, Startseite). Untere Leiste bzw. Seitenleiste je Bereich
  (`navItemsFor`): Pläne · Getränke · Statistik · Lexikon · Entdecken. Getränke, Lexikon, Statistik, Entdecken sowie
  Körpermaße und Energiebedarfsrechner (Profilmenü, nur im Sport-Bereich) sind „Kommt bald“-Seiten mit Vorschau
  (`components/sport/coming-soon.tsx`). Im Profilmenü stehen Zutaten/Preise/Umrechner nur noch in Essen & Trinken.
- **Pläne** (`/sport/plaene`): Karten mit Tagen als Chips, Menü (Bearbeiten, Duplizieren, Ausblenden, Löschen mit
  Rückfrage), ausgeblendete Pläne zugeklappt unten, „+“ unten rechts. Planseite mit allen Tagen und Übungen;
  „Training starten“ ist ausgegraut (kommt mit S2).
- **Plan-Editor** (`/sport/plaene/neu`, `…/bearbeiten`, wie der Rezept-Editor ohne Navigation, Speicherleiste unten):
  Name, Beschreibung, Tage als aufklappbare Karten (Griff zum Verschieben, Stift für Name/Fokus mit Vorschlag aus den
  Muskelgruppen, Löschen mit Rückgängig), Übungen per Drag & Drop, Sheet je Übung (Sätze −/+, Wdh. von–bis bzw.
  Sekunden, Pause als Segmente, Aufwärmsätze an/aus, Notiz, anderer Tag, Austauschen, Entfernen mit Rückgängig).
  Übungsauswahl: Suche (Umlaute egal), Muskelgruppen als wischbare Chips mit Zahl, ohne Filter aufklappbare Gruppen,
  Mehrfachauswahl, „Eigene Übung“ (Name, Muskelgruppe, Gerät, Erfassung). Formular-Logik in `plan-model.ts` (Tests).
- **Startseite:** Sport-Karte mit dem zuletzt geänderten aktiven Plan und Kacheln Training, Körper, Energie,
  Lexikon. Fehler beim Laden der Pläne kosten nicht mehr die ganze Startseite.
- **Datenexport:** `trainingsplaene`, `eigene_uebungen`. Account löschen: Cascade (Pläne), eigene Übungen bleiben
  ohne Bezug (wie Zutaten).
- Geprüft: 380 Tests, Typecheck, Lint, Build grün. Editor über eine temporäre Vorschauseite mit Beispieldaten
  (danach gelöscht) bei 375 px hell und 1280 px dunkel: kein seitliches Scrollen, Sheet, Prüfung beim Speichern
  (rote Markierung), Auswahl mit aufklappbaren Gruppen und Mehrfachauswahl, Verschieben per Tastatur.
- **Migration eingespielt** am 26.10.2026 von Claude über die Supabase-Verbindung (mit Freigabe des Nutzers; in
  Supabase unter dem Namen `sport_plans`). Geprüft: 120 Übungen im Grundbestand, RLS auf allen vier Tabellen, keine
  Rechte für `anon`, Security-Advisor ohne neue Hinweise. Per SQL als Admin getestet (zurückgerollt):
  Plan mit zwei Tagen anlegen, erneut speichern (Tag A behält seine ID, Tag B fällt weg, neue Reihenfolge der
  Übungen), Kopieren (gleiche Übungen, ohne `forked_from_id` bei eigenem Plan), leerer Plan wird abgelehnt.
  **Nicht geprüft:** die Seiten mit Login (vom Nutzer am LAN-Server zu testen).

## Wünsche vom 26.10.2026: Startseite mit Bereichen und Widgets

**Live** seit 26.10.2026: vom Nutzer am LAN-Server getestet (Speichern schlug vor der Migration fehl; danach nicht ausdrücklich bestätigt);
Push `bd0d8b5` (mit `4b2bf48`, `2fb4568`) → Deployment `dpl_HPxvjaLevydvpWv6wmvUxsGZ3YaS` (`production`, `fra1`,
`source: git`, nach ca. 54 s „READY“, auf unser-rezeptbuch.vercel.app geschaltet; per Vercel-Connector geprüft).

Entscheidungen des Nutzers: Anordnung **im Konto** gespeichert (gleich auf PC und Handy); **Sport & Gesundheit** bis
zum Ausbau sichtbar, ausgegraut mit „Kommt bald“. Vorlage: Design-Entwurf „Start“ des Nutzers.

- **Bereiche** (`AREAS`, `areaForPath` in `nav-items.ts`, Tests): Start (`/`), Essen & Trinken (alles Bisherige, Einstieg
  `/rezepte`), Sport & Gesundheit (`/sport`, noch nicht gebaut). Umschalter oben links (`area-switcher.tsx`): Kachel,
  Name des Bereichs, Pfeil; klappt die Bereiche auf (Sport ausgegraut). Am Handy im Kopf statt des Logos, am Desktop
  oben in der Seitenleiste; auf der Startseite gibt es weder Seitenleiste noch untere Navigation (Umschalter im Kopf).
- **Startseite** `src/app/(app)/page.tsx` (vorher Weiterleitung auf `/rezepte`): „Guten Morgen/Hallo/Guten Abend,
  <Vorname>“, Wochentag und Datum, dann die Widgets (`components/home/widgets.tsx`): Heute (kcal laut Plan gegen
  Tagesziel, Trainingstag, Protein mit Balken), Essen & Trinken (nächste Mahlzeit von heute, Kacheln Rezepte,
  Wochenplan, Einkauf · offene Einträge, Bar), Sport & Gesundheit (Kommt bald), Heute geplant, Einkaufsliste,
  Was kann ich kochen? (Gerichte/Cocktails, die der Vorrat ganz abdeckt), Läuft bald ab, Lange nicht gekocht. Die
  letzten beiden sind anfangs ausgeblendet. Geladen werden nur Daten sichtbarer Widgets (`lib/server/home.ts`).
- **Anpassen** (`home-widgets.tsx`): „Startseite anpassen“ zeigt eine Liste mit Griff (Ziehen per dnd-kit, auch
  Tastatur) und Auge zum Ein-/Ausblenden, „Standard“, „Abbrechen“, „Fertig“ (speichert per `saveHomeLayoutAction`).
  Gespeichert in `user_settings.home_widgets` (jsonb `[{id, visible}]`); `normalizeHomeLayout` verwirft Unbekanntes und
  hängt neue Widgets hinten an (später z. B. aus Sport). Fehlt die Spalte noch, gilt der Standard.
- **Neue Farben** (`globals.css`): `--sport`, `--sport-soft` (hell/dunkel). Die Bar-Kachel hatte zuerst ein eigenes
  Flaschengrün; auf Wunsch des Nutzers jetzt wie die anderen Kacheln unter Essen & Trinken.
- **Weiterleitungen auf die Startseite:** nach dem Login (ohne `?weiter=`), eingeloggt auf `/login`, nach
  Passwort setzen, nach E-Mail-Links, PWA-`start_url`.
- **Migration** `…20261026090000_home_widgets` (additiv, nullable) am 26.10.2026 von Claude über die
  Supabase-Verbindung eingespielt (mit Freigabe des Nutzers; in Supabase Version `20261026093836`). Vorher schlug das
  Speichern der Anordnung fehl (vom Nutzer bemerkt). Ohne Spalte zeigt die Startseite den Standard.
- Geprüft: Tests, Typecheck, Lint, Build grün. Layout über eine temporäre Vorschauseite mit Beispieldaten (danach
  gelöscht) bei 375 px hell/dunkel und 1280 px: kein seitliches Scrollen, Umschalter, Anpassen (Ausblenden, Sortieren
  per Tastatur). **Nicht geprüft:** mit echten Daten/Login, Speichern, Seitenleiste in Essen & Trinken.

## Offene Punkte

- Vorrat: Zugeklappte Gruppen merkt sich die Seite nur bis zum Neuladen.
- Meal Prep: „Woche kopieren“ übernimmt Kochtag und Reste als normale Einträge (ohne Batch), d. h. in der Zielwoche
  zählt die Einkaufsliste jeden Eintrag einzeln. „Ersetzen“ beim Kopieren löscht Einträge, lässt aber den Batch der
  Zielwoche stehen (er wird ignoriert, weil sein Kochtag fehlt). Bei Gelegenheit `copy_plan_week` per Migration
  batch-fähig machen und verwaiste Batches aufräumen.

- Markdown-Import: Fotos aus dem Notion-ZIP werden nicht übernommen (wären im Archiv dabei; Ergänzung für später).
- Markdown-Import: Die Warteschlange zur Prüfung lebt nur in der offenen Seite; wer sie verlässt, fängt mit der
  Datei neu an (bereits gespeicherte Rezepte sind dann „Gibt es schon im Buch“ und abgewählt).
- Preise: Es gibt eine Packungsangabe je Zutat (keine Preise je Laden nebeneinander). Reicht für den Anfang.
- Statistik „Meistgekocht“: Gekochte öffentliche Rezepte anderer erscheinen mit Titel „Rezept“, ein Tipp darauf
  filtert die eigene Liste auf „nichts“ (wie bei „Meistgeplant“).
- Kochmodus: Timer überleben kein Neuladen der Seite (nur im Arbeitsspeicher). Läuft das Handy in den Ruhezustand,
  klingelt der Timer erst beim Aufwecken (Browser-Grenze; Push-Benachrichtigungen wären ein eigenes Thema).
- Die Konsole meldet in der Entwicklung „Encountered a script tag while rendering React component“ (kommt von
  next-themes, harmlos).
- Datenexport enthält die Fotos nur als Liste. Ein ZIP mit allen Fotos wäre eine Ergänzung für später.
- Editor, Ansicht „Nach Schritt“: Beim Ziehen per Tastatur braucht der Wechsel in eine andere Gruppe manchmal einen
  zweiten Pfeil-Druck. Alternative ohne Ziehen: Zutat antippen → „Gebraucht in Schritt“.
- Bar: Die geteilte Karte nennt keine Basisspirituose (die Funktion liefert keine Zutatengruppen). Reicht so.
- Service-Worker-Version (`VERSION` in `public/sw.js`) bei Änderungen am Caching hochzählen.
- GitHub-Zweig `main` (nur die automatische README) kann jetzt gelöscht werden (Vercel nutzt `master`).
- Import: Seiten, die Bots sperren (z. B. Allrecipes, Simply Recipes: Antwort 402), lassen sich nicht laden; die App
  sagt das und verweist auf „von Hand anlegen“.
- Statistik „Meistgeplant“: Ein Tipp auf ein fremdes (öffentliches) Rezept filtert die eigene Liste darunter auf
  „nichts“, weil es nicht im eigenen Buch ist. Kleinigkeit, bei Gelegenheit verbessern.
- Advisor-Hinweis „Leaked Password Protection“ (Prüfung neuer Passwörter gegen HaveIBeenPwned, per
  k-Anonymität) ist aus. Optional im Dashboard (Authentication → Policies/Passwords), evtl. nur in bezahlten Plänen.

## Bekannte Probleme

- **Alte Homescreen-Icons starten bei den Rezepten (26.10.2026):** Die Startadresse war bis zur Startseite
  `/rezepte`. iPhones speichern sie beim Hinzufügen fest im Icon (Android aktualisiert erst nach Tagen). Abhilfe: Icon
  löschen und die App neu zum Homescreen hinzufügen (Nutzer macht das so). Eine Umleitung im Code war angeboten, ist
  aber nicht gebaut.

- **Alte Einladungsmails (19.10., Test Phase 8):** Jede Einladung trägt ihr Ziel fest im Link (lokal versendet →
  localhost:3000, live versendet → Vercel). Nach Löschen und erneutem Einladen derselben Adresse sind alle älteren
  Links ungültig; ein Klick darauf zeigt „Link abgelaufen“ und landet beim alten Ziel. Immer die neueste Mail nehmen.
  Im Supabase-Auth-Log steht bei `/invite` und `/verify` im Feld `referer` das jeweilige Ziel.

- **Turbopack-Cache:** Am 19.10. lieferte der Entwicklungsserver nach einer Änderung an `globals.css` selbst nach
  Neustart die alte CSS aus. Abhilfe: Server stoppen, Ordner `.next/dev` löschen, neu starten. In Phase 6 nochmal
  passiert (alte `recipe-card.tsx` trotz Änderung); gleiche Abhilfe, danach lief es. In Phase 15 wieder (erst
  `recipe-card.tsx`/`recipe-filters.tsx`, dann `globals.css`); zweimal neu gestartet, danach aktuell.

- Security-Advisor meldet `public.rls_auto_enable()` als für `anon` ausführbar. Das ist eine von Supabase
  selbst angelegte Event-Trigger-Funktion (Einstellung „RLS automatisch aktivieren“), nicht aus unseren
  Migrationen, und lässt sich per API nicht sinnvoll aufrufen. Bewusst nicht angefasst.
- Standard-Mails von Supabase sind englisch. Ihr Einmal-Link kann von Link-Scannern mancher Mailprogramme
  (z. B. Outlook mit „Safe Links“) vorab verbraucht werden; dann erscheint „Link abgelaufen“ und eine neue
  Einladung hilft. Abhilfe dauerhaft: eigener SMTP-Dienst + eigene Vorlagen (README Schritt 4).
- Performance-Advisor meldet „unused index“ für alle Indizes – normal bei leerer Datenbank.
- `SIGNUP_MODE` wird teilweise beim Build ausgewertet (statische Seiten). Nach einer Änderung neu bauen/deployen.
