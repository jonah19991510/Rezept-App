# Datenverarbeitung

Übersicht, welche personenbezogenen Daten die App wo speichert, wofür und welche Dienstleister beteiligt
sind. Grundlage für eine spätere Datenschutzerklärung. **Kein Rechtstext.** Wird mit jeder Phase
aktualisiert.

Letzte Aktualisierung: Phase 9 (19.10.2026)

## Grundsätze

- Pro Nutzer nur **E-Mail-Adresse** (Supabase Auth) und frei wählbarer **Anzeigename** (`profiles`).
  Keine weiteren persönlichen Angaben (kein Geburtsdatum, keine Adresse, keine Telefonnummer).
- Andere Nutzer sehen **nie die E-Mail-Adresse**, nur den Anzeigenamen. Die E-Mail-Adressen sieht nur
  der Admin auf der Nutzerverwaltung (serverseitig mit dem Secret Key geladen).
- Passwörter verwaltet ausschließlich Supabase Auth (bcrypt-Hash). Keine eigene Passwort-Tabelle, keine
  Passwörter in Logs oder im Frontend-State.
- Keine Analytics, keine Tracking-Pixel, keine eingebetteten Fremdinhalte, Schriften selbst gehostet.
- Nur technisch notwendige Cookies, kein Cookie-Banner nötig.
- Alle Tabellen mit Row Level Security; nutzerbezogene Daten sind nur für den Nutzer selbst lesbar
  (Ausnahme: bewusst veröffentlichte Rezepte, siehe unten).

## Gespeicherte Daten

### Konto und Anmeldung

| Daten | Ort | Zweck | Sichtbar für |
|---|---|---|---|
| E-Mail-Adresse, Passwort-Hash, Zeitpunkte (angelegt, eingeladen, letzte Anmeldung) | Supabase Auth (`auth.users`) | Login, Einladung, Passwort zurücksetzen | Nutzer selbst, Admin (Nutzerliste) |
| Anzeigename, Rolle (`user`/`admin`), Avatar-URL (noch ungenutzt) | `public.profiles` | Anzeige bei eigenen/öffentlichen Rezepten, Rechte | alle eingeloggten Nutzer (Name), Rolle nur technisch |
| Session-Cookies `sb-<projekt>-auth-token` | Browser (Cookie) | Angemeldet bleiben | – (technisch notwendig) |
| Auth-Protokolle (u. a. IP-Adresse, Zeitpunkt, User-Agent) | Supabase (Logs) | Betrieb, Missbrauchsschutz | Projekt-Admin im Supabase-Dashboard |
| Darstellung Hell/Dunkel | Browser (`localStorage`, Schlüssel `theme`) | Nutzerwunsch merken | nur das Gerät |
| Programmdateien der App (JavaScript/CSS), Offline-Seite, App-Icon | Browser (Cache Storage des Service Workers, `rezeptbuch-static-*`, `rezeptbuch-shell-*`) | schnellerer Start, Hinweis „Du bist offline“ | nur das Gerät; **keine** persönlichen Daten, Seiten werden nicht gespeichert |
| Rezeptfotos | Browser-Cache (HTTP, `private`) | Fotos nicht jedes Mal neu laden | nur das Gerät |

### Inhalte der Nutzer (angelegt in Phase 1, genutzt ab den genannten Phasen)

Alle Zeilen hängen über `user_id` bzw. `owner_id` am Nutzer und werden beim Löschen des Accounts per
`ON DELETE CASCADE` mitgelöscht.

| Tabelle | Inhalt | Ab Phase | Sichtbar für |
|---|---|---|---|
| `recipes` (+ `recipe_ingredients`, `recipe_steps`, `cocktail_details`) | Rezepte und Cocktails (ab Phase 15: `recipe_type`, Glas, Methode, Eis, Garnitur), optional Quell-URL; `forked_from_id` = Verweis auf das Original bei übernommenen Rezepten | 2 / 6 | nur Owner; bei `is_public` (Schalter, ab Phase 6) alle eingeloggten Nutzer mit Anzeigename des Owners |
| `recipe_versions` | frühere Fassungen eines Rezepts | 12 | nur Owner |
| `meal_plan_entries`, `meal_prep_batches`, `plan_days` | Wochenplan, Meal Prep, Trainingstage; ab 27.10.2026 auch eigene Einträge ohne Rezept mit freiem Titel (z. B. „Essen bei den Eltern“) | 3 / 11 | nur Nutzer selbst |
| `user_goals` | Tagesziele kcal/Protein/KH/Fett | 3 / 11 | nur Nutzer selbst |
| `recipe_categories` | Eigene Kategorien für Rezepte (Name, Reihenfolge), ab 24.10.2026; am Rezept steht der Name in `recipes.category_name` | Einstellungen → Kategorien | nur Nutzer selbst |
| `user_settings` | Standard-Trainingstage, Einkaufs-Sortierung, Präferenzen | 1 (leer angelegt) | nur Nutzer selbst |
| `shopping_list_items` | Einkaufsliste | 4 | nur Nutzer selbst |
| `pantry_items` | Vorrat (Küche/Bar), Ablaufdatum; Bereich „Bar“ = Bar-Bestand (Spirituosen, Liköre, Sirupe, Säfte) | 10 / 15 | nur Nutzer selbst |
| `ingredient_prices` | Preise, optional Laden | 12 | nur Nutzer selbst |
| `cook_logs` | Kochdatum, Bewertung, Notiz, Portionen, Rezeptversion | 9 (Eintrag über den Kochmodus) / 12 (Anzeige) | nur Nutzer selbst |
| `favorites` | Lieblingsrezepte | 2 | nur Nutzer selbst |
| `ingredients` (Spalte `created_by`) | selbst angelegte Zutaten | 2 | Zutaten sind global für alle lesbar; `created_by` wird beim Löschen auf leer gesetzt |
| `training_plans` (+ `training_plan_days`, `training_plan_exercises`) | Trainingspläne mit Tagen und Übungen (Sätze, Wiederholungen, Pause, Notiz), „ausgeblendet“; `forked_from_id` für spätere Übernahmen | S1 (26.10.2026) | nur Owner; öffentlich erst mit Phase S4 (Schalter, alle Eingeloggten mit Anzeigename) |
| `workouts` (+ `workout_exercises`, `workout_sets`) | Trainings: Start/Ende, Plan und Tag, Übungen, Sätze (Gewicht, Wiederholungen, Zeit, Strecke, ab 27.10.2026 Geschwindigkeit), Notizen | S2 (26.10.2026) | nur Nutzer selbst |
| Browser (`localStorage`, Schlüssel `training:<id>`) und Cache Storage des Service Workers (`rezeptbuch-training`, Seite `/training/<id>`) | laufendes Training, damit es ohne Netz weitergeht | S2 (26.10.2026) | nur das Gerät; gelöscht beim Beenden, Verwerfen und Abmelden |
| `drinks` | eigene Getränke (Name, Farbe, Koffein und Zucker pro 100 ml, Wasseranteil, Zutaten bei Mischgetränken) | Getränketracker (27.10.2026) | nur Nutzer selbst |
| `drink_entries` | was wann getrunken wurde: Zeitpunkt, Menge, Getränkename, Koffein, Zucker, Wasser | Getränketracker (27.10.2026) | nur Nutzer selbst |
| `user_settings.drink_goal_ml` | Tagesziel für die Trinkmenge | Getränketracker (27.10.2026) | nur Nutzer selbst |
| `body_measurements` | Körpermaße: Datum, Gewicht, Umfänge (Schulter, Brust, Taille, Bauch, Hüfte, Oberarm, Oberschenkel, Wade), Notiz | Körpermaße (27.10.2026) | nur Nutzer selbst |
| `user_settings.body_settings` | Körpergröße für den BMI, ausgeblendete Maße | Körpermaße (27.10.2026) | nur Nutzer selbst |
| `user_settings.energy_profile` | Eingaben des Energiebedarfsrechners: Geschlecht, Alter, Größe, Gewicht, Körperfett, Aktivität, Sport, Ziel, Wunschgewicht, Protein/Fett | Energiebedarfsrechner (27.10.2026) | nur Nutzer selbst |
| Browser (`localStorage`, Schlüssel `getraenke:zuletzt`) | zuletzt gewähltes Getränk auf „Heute“ | Getränketracker (27.10.2026) | nur das Gerät |
| `exercises` (Spalte `created_by`) | selbst angelegte Übungen (Name, Muskelgruppe, Gerät) | S1 (26.10.2026) | Übungen sind wie Zutaten für alle lesbar; ändern nur, wer sie angelegt hat; `created_by` wird beim Löschen auf leer gesetzt |
| Storage-Bucket `recipe-photos/<user-id>/<rezept-id>/…` (privat) | Rezeptfotos (groß + Vorschaubild), vor dem Upload im Browser verkleinert und neu kodiert, dadurch **ohne EXIF/GPS** | 7 | wie das Rezept (Owner; bei öffentlichen Rezepten alle Eingeloggten), ausgeliefert nur über die App-Route `/foto/…` |

**Veröffentlichte Rezepte (ab Phase 6):** Rezepte sind standardmäßig privat. Erst der Schalter „Öffentlich“ auf
der Rezeptseite macht ein Rezept für alle eingeloggten Nutzer sichtbar (Seite „Entdecken“, Auswahl im Wochenplan),
zusammen mit dem Anzeigenamen des Owners, nie mit der E-Mail-Adresse. Andere können es einplanen (ihr Plan-Eintrag
verweist auf das Rezept) und eine eigene Kopie übernehmen. Diese Kopie gehört dann der anderen Person: Sie bleibt
bestehen, wenn das Original wieder privat gemacht oder gelöscht wird oder der Account des Owners gelöscht wird
(`forked_from_id` wird dann leer). Fremde Plan-Einträge auf ein wieder privates Rezept bleiben stehen, zeigen aber
nur noch „Rezept nicht mehr verfügbar“; beim Löschen des Rezepts verschwinden sie per Cascade. Wer ein Rezept wann
übernommen oder eingeplant hat, sieht der Owner nicht.

**Teilen per Link (ab Phase 14):** Der Owner kann zu einem Rezept einen Link erzeugen (`recipes.share_token`,
22 zufällige Zeichen). Wer den Link hat, sieht ohne Account eine Rezeptkarte: Titel, Beschreibung, Foto, Zutaten,
Schritte, Nährwerte und den **Anzeigenamen** des Owners – auch bei privaten Rezepten. Nicht enthalten sind E-Mail,
Nutzer- und Rezept-IDs und der Speicherpfad des Fotos (das Foto liefert die App über `/r/<token>/foto` aus). Gelesen
wird nur über die Datenbankfunktion `get_shared_recipe` (genau ein Rezept pro Token); an den Tabellenrechten ändert
sich nichts. Messenger holen beim Teilen ein Vorschaubild (`/r/<token>/opengraph-image`) und die Seitenvorschau
direkt beim Server ab; dafür dürfen deren Vorschau-Bots laut `robots.txt` nur `/r/` lesen, indexiert wird nichts
(noindex). Eingeloggte können eine private Kopie übernehmen (`fork_shared_recipe`, mit Foto-Kopie in den eigenen
Ordner). „Widerrufen“ löscht den Token sofort: Seite, Foto und Bilder antworten danach mit 404 (Browser dürfen das
Foto bis zu 10 Minuten zwischenspeichern). Der Token verschwindet mit dem Rezept bzw. Account.

**Bar (ab Phase 15):** Cocktails sind Rezepte mit `recipe_type = cocktail` und Zeile in `cocktail_details`; es gibt
keine neue Tabelle mit Nutzerdaten. Der Alkoholgehalt pro Drink wird bei jedem Abruf aus den Zutaten berechnet
(View `recipe_alcohol`, Verdünnung je Methode aus `app_config`) und nicht gespeichert. Für Cocktails gelten dieselben
Regeln wie für Rezepte (privat, öffentlich, Teilen per Link, Datenexport, Löschen per Cascade). Die geteilte Karte
zeigt bei Cocktails zusätzlich Glas, Methode, Eis, Garnitur und den Alkoholgehalt.

**Hinweis:** Tagesziele, Trainingstage und Essenspläne können Rückschlüsse auf Gesundheit und
Lebensgewohnheiten zulassen. Das gilt auch für Cocktails, Bar-Bestand und „Gemixt“-Einträge im Koch-Log (Konsum von
Alkohol). Das sollte die spätere Datenschutzerklärung ausdrücklich erwähnen.

### Nicht personenbezogen

- `ingredients` aus dem Grundbestand (`source = seed`) und `app_config` (Schwellenwerte).

## Dienstleister

| Dienst | Rolle | Ort | Was dort landet |
|---|---|---|---|
| **Supabase** (Supabase Inc.) | Datenbank, Auth, Storage, Standard-Mailversand | Projekt in Frankfurt (AWS `eu-central-1`) | alle oben genannten Daten, Auth-Logs, Einladungs-/Passwort-Mails |
| **Vercel** (Vercel Inc.) | Hosting der App ab Phase 8 | Functions in Frankfurt (`fra1`), statische Dateien über weltweites CDN | Request-Logs (u. a. IP-Adresse, URL), keine Analytics |
| **Open Food Facts** (gemeinnützige Organisation) | Nährwert-Datenbank (aktiv seit Phase 2) | Server `search.openfoodfacts.org` | nur der Suchbegriff, nur auf Knopfdruck, abgefragt vom Server der App (also mit dessen IP, nicht der des Nutzers), User-Agent nur „Rezeptbuch/0.1“. **Keine** Nutzerdaten |
| Webseiten beim Link-Import (aktiv seit Phase 7) | Rezept-Quellen | – | nur die eingegebene Adresse, abgerufen vom Server der App (dessen IP, nicht die des Nutzers), ohne Cookies und Referer, User-Agent „Rezeptbuch/0.1“. **Keine** Nutzerdaten. Gespeichert wird nur die Quell-URL am Rezept |

## Rechte der Nutzer

- **Löschen:** „Account löschen“ in den Einstellungen (Bestätigung durch Eintippen des Anzeigenamens) bzw. der Admin
  über die Nutzerverwaltung. Zuerst werden alle Fotos im Storage gelöscht, dann der Auth-User; alle Tabellen folgen
  per Cascade, auch veröffentlichte Rezepte. Kopien, die andere von veröffentlichten Rezepten übernommen haben,
  gehören diesen Personen und bleiben. Supabase-Auth-Protokolle und Backups von Supabase verfallen nach deren Fristen.
- **Auskunft/Export:** „Meine Daten herunterladen“ in den Einstellungen liefert alle gespeicherten Daten als JSON
  (Profil inkl. E-Mail, Rezepte mit Zutaten, Schritten und Versionen, Wochenpläne, Meal Prep, Ziele, Einstellungen,
  Einkaufsliste, Vorrat, Preise, Koch-Log, Favoriten, selbst angelegte Zutaten, Liste der Fotos). Die Fotos selbst
  sieht man in der App; ein Download aller Fotos als Datei fehlt noch.
- **Berichtigung:** Anzeigename und Passwort in den Einstellungen, Inhalte direkt in der App.
- Zusätzlich gibt es die **Rezept-Sicherung** (eigene Rezepte als wieder importierbare JSON-Datei).

## Checkliste „Vor dem Öffnen der Registrierung“

- [ ] Impressum fertig (`/impressum`, aktuell Platzhalter)
- [ ] Datenschutzerklärung fertig (`/datenschutz`, aktuell Platzhalter), auf Basis dieser Datei
- [ ] Auftragsverarbeitungsvertrag (DPA) mit **Supabase** abgeschlossen
- [ ] Auftragsverarbeitungsvertrag (DPA) mit **Vercel** abgeschlossen
- [ ] Eigener SMTP-Dienst für E-Mails in Supabase eingerichtet (Authentication → Emails → SMTP Settings),
      der Standardversand ist stark limitiert
- [ ] `SIGNUP_MODE=open` in Vercel gesetzt und neu deployt
- [ ] Freie Registrierung in Supabase wieder aktiviert (Authentication → Sign In / Providers → „Allow new users to sign up“)
- [ ] Mail-Vorlagen auf Deutsch umgestellt (geht erst mit eigenem SMTP, README Schritt 4)
- [ ] noindex-Regeln bewusst überprüft (robots.txt, Meta-Tag, `X-Robots-Tag`): sollen sie bleiben?

## Änderungsverlauf

- **27.10.2026, Körpermaße:** Neue Tabelle `body_measurements` (RLS nur der Nutzer, Cascade am Profil) und Spalte
  `user_settings.body_settings`. BMI und Taille-Hüft-Verhältnis rechnet die App, sie werden nicht gespeichert. Im
  Datenexport als `koerpermasse` (Einstellungen unter `einstellungen`). Gewicht und Körpermaße sind Gesundheitsdaten.
  Keine neuen Dienstleister.
- **27.10.2026, Energiebedarfsrechner:** Spalte `user_settings.energy_profile` (jsonb) mit den Eingaben des Rechners,
  damit PC und Handy dasselbe zeigen; im Datenexport unter `einstellungen`, beim Löschen per Cascade weg. Gerechnet wird
  nur im Browser. „Als Tagesziel übernehmen“ schreibt in die bestehenden `user_goals`. Körperdaten wie Gewicht und
  Körperfett sind Gesundheitsdaten (Hinweis für die Datenschutzerklärung). Keine neuen Dienstleister.
- **27.10.2026, Getränketracker:** Neue Tabellen `drinks` und `drink_entries` (RLS nur der Nutzer, Cascade am Profil),
  Spalte `user_settings.drink_goal_ml`. Einträge halten Name, Koffein, Zucker und Wasser zum Zeitpunkt des Trinkens fest;
  gelöschte Getränke lassen ihre Einträge stehen (`drink_id` wird leer). Im Datenexport als `getraenke` und
  `getraenke_eintraege`. Trinkmenge und Koffein lassen Rückschlüsse auf Gesundheit und Gewohnheiten zu. Keine neuen
  Dienstleister.
- **26.10.2026, Sport & Gesundheit Phase S4:** Trainingspläne lassen sich veröffentlichen (`training_plans.is_public`,
  Schalter auf der Planseite). Öffentliche Pläne sehen alle eingeloggten Mitglieder unter „Entdecken“ mit dem
  Anzeigenamen des Besitzers (nie die E-Mail); Trainings, Sätze und Statistik bleiben privat. Andere können einen
  öffentlichen Plan trainieren (ihr Training verweist auf ihn) oder als eigene Kopie übernehmen (`forked_from_id`);
  Kopien bleiben bestehen, wenn das Original privat oder gelöscht wird. Keine neuen Tabellen, keine neuen Dienstleister.
- **26.10.2026, Sport & Gesundheit Phase S2:** Neue Tabellen `workouts`, `workout_exercises`, `workout_sets` (RLS nur
  der Nutzer, Cascade am Profil), im Datenexport als `trainings` und in der Sport-Sicherung (Version 2). Während eines
  Trainings liegt sein Stand zusätzlich im Browser (`localStorage`) und die Trainingsseite im Cache des Service Workers
  (Ausnahme von „keine Seiten im Cache“), damit es ohne Netz weitergeht; beides wird beim Beenden, Verwerfen und
  Abmelden gelöscht. Trainingsdaten lassen Rückschlüsse auf Sport und Gesundheit zu. Keine neuen Dienstleister.
- **26.10.2026, Sport & Gesundheit Phase S1:** Neue Tabellen `exercises` (Grundbestand ohne Personenbezug, eigene
  Übungen mit `created_by`), `training_plans`, `training_plan_days`, `training_plan_exercises` (RLS: nur Owner bzw.
  öffentliche Pläne lesbar, Kindtabellen über Security-Definer-Prüfungen; Cascade am Profil). Im Datenexport als
  `trainingsplaene` und `eigene_uebungen`. Trainingspläne lassen Rückschlüsse auf Sport und Gesundheit zu (wie
  Wochenplan und Ziele). Keine neuen Dienstleister. Dazu die Sport-Sicherung (Datei mit eigenen Plänen und Übungen,
  wird beim Abruf erzeugt und nicht gespeichert) und ihr Import (legt Pläne und ggf. eigene Übungen an).
- **26.10.2026, Startseite:** Neue Spalte `user_settings.home_widgets` (Reihenfolge und Sichtbarkeit der Widgets,
  keine personenbezogenen Inhalte; RLS wie `user_settings`, im Datenexport enthalten). Die Widgets zeigen nur vorhandene
  eigene Daten (Wochenplan, Ziele, Einkaufsliste, Vorrat, Koch-Log). Keine neuen Dienstleister.
- **24.10.2026, eigene Kategorien:** Neue Tabelle `recipe_categories` (Name, Reihenfolge je Nutzer; RLS nur eigene,
  Cascade über `profiles`), Spalte `recipes.category_name`. Startliste: die bisherigen festen Kategorien. Keine
  personenbezogenen Daten im engeren Sinn. Datenexport enthält die Liste (`kategorien`), die Rezept-Sicherung den
  Kategorienamen; Account-Löschung entfernt die Liste per Cascade. Keine neuen Dienstleister.

- **Nach Phase 15:** Seite „Zutaten“ zeigt Zutaten aus eigenen Rezepten und selbst angelegte, mit eigenem Preis;
  selbst angelegte Zutaten lassen sich ändern und löschen, selbst aus Open Food Facts übernommene löschen. Neu nur zwei Trigger: einer
  rechnet bei Änderung von Dichte oder Stückgewicht die gespeicherten Gramm in Rezeptzeilen neu, einer verhindert das
  Löschen, solange andere die Zutat im Vorrat oder mit Preis haben. Beim Löschen gehen der eigene Preis und Vorrat zur
  Zutat mit. Keine neuen Tabellen, keine neuen
  Daten, keine neuen Dienstleister.

- **Phase 15:** Cocktail-Bereich (siehe „Bar“ oben). Genutzt werden die seit Phase 1 vorhandenen Felder
  `recipes.recipe_type`, `cocktail_details` und `pantry_items.location = bar`, dazu die Spalte `ingredients.abv`.
  Neu: View `recipe_alcohol` (Security Invoker, nur eingeloggt, RLS des Aufrufers), Eintrag `cocktail_dilution` in
  `app_config`, 25 Bar-Zutaten im Grundbestand. `get_shared_recipe` liefert zusätzlich Cocktail-Felder und
  Alkoholgehalt, `save_recipe` speichert Typ und Cocktail-Felder (Versionen enthalten sie). Datenexport: Cocktails
  stehen bei den Rezepten (mit `cocktail_details`), der Bar-Bestand beim Vorrat; Rezept-Sicherung (Format-Version 2)
  und Markdown-Export enthalten jetzt auch Cocktails. Account-Löschung per Cascade geprüft (SQL-Test
  `supabase/tests/bar_check.sql`). Keine neuen Tabellen mit Nutzerdaten, keine neuen Dienstleister.

- **Phase 14:** Teilen per Link (siehe „Teilen per Link“ oben): Spalte `recipes.share_token` wird jetzt genutzt,
  neue Datenbankfunktionen `set_recipe_share`, `get_shared_recipe` (auch ohne Login, Security Definer, nur ein
  Rezept pro Token) und `fork_shared_recipe`. Öffentliche Seite `/r/<token>` mit Druckansicht, Vorschaubild für
  Messenger und Bild-Export (Story-Format) – alles wird beim Abruf erzeugt und nicht gespeichert. `robots.txt`
  erlaubt bekannten Vorschau-Bots (WhatsApp/Facebook, Telegram, X, Slack, Discord, LinkedIn) nur `/r/`. Im
  Datenexport enthalten (Spalte `share_token`), beim Löschen von Rezept oder Account entfernt. Keine neuen
  Tabellen, keine neuen Dienstleister.

- **Phase 13:** Markdown-Export (einzelnes Rezept, ganzes Buch) wird beim Abruf erzeugt und nicht gespeichert.
  Markdown-Import: Die Datei liest nur der Browser; an den Server gehen nur die Zutatenzeilen der ausgewählten
  Rezepte (für die Zuordnung) und danach die gespeicherten Rezepte. Keine neuen Tabellen, keine neuen Dienstleister.

- **Phase 12:** Jetzt genutzt: `ingredient_prices` (eigene Zutatenpreise, optional Laden), `recipe_versions`
  (frühere Fassungen eigener Rezepte mit optionaler Änderungsnotiz, nur für den Owner), `cook_logs` mit Anzeige,
  Einträgen von Hand und Löschen, `user_settings.long_not_cooked_weeks`. Neue View `recipe_costs` rechnet Kosten nur
  aus den Preisen des angemeldeten Nutzers (andere sehen fremde Preise nie, auch nicht bei öffentlichen Rezepten).
  Preise und Koch-Log sind nur für den Nutzer selbst sichtbar; Versionen nur für den Owner des Rezepts. Alles im
  Datenexport enthalten und beim Löschen von Rezept bzw. Account per Cascade entfernt. Keine neuen Tabellen,
  keine neuen Dienstleister.

- **Phase 11:** Jetzt genutzt: `user_settings.training_weekdays` (Standard-Trainingstage), `user_goals` mit Typ
  „training“ (Ziel an Trainingstagen), `plan_days` (im Plan umgeschaltete Trainingstage) und `meal_prep_batches`
  (Kochtag, gekochte Portionen) mit `meal_plan_entries.batch_id/is_leftover`. Alles nur für den Nutzer selbst
  sichtbar, im Datenexport enthalten und beim Löschen des Accounts per Cascade entfernt. Trainingstage und Ziele
  lassen Rückschlüsse auf Sport und Ernährung zu (siehe Hinweis oben). Lücken- und Reste-Vorschläge werden nur aus
  vorhandenen Daten berechnet, nichts davon wird gespeichert. Keine neuen Tabellen, keine neuen Dienstleister.

- **Phase 10:** Vorratsschrank (`pantry_items`: Zutat, freiwillig Menge und Ablaufdatum, Bereich Küche/Bar) wird
  jetzt genutzt, nur für den Nutzer selbst sichtbar, im Datenexport enthalten, beim Löschen des Accounts per Cascade
  entfernt. „Was kann ich kochen?“ gleicht nur eigene Rezepte mit dem eigenen Vorrat ab. Text-Export der
  Einkaufsliste: „Als Text kopieren“ legt den Text in die Zwischenablage des Geräts, „Teilen“ öffnet das Teilen-Menü
  des Betriebssystems (Web Share API); wohin der Text geht, entscheidet der Nutzer, die App überträgt dabei selbst
  nichts. Keine neuen Tabellen, keine neuen Dienstleister.

- **Phase 9:** Kochmodus speichert am Ende („Gekocht!“) freiwillig einen Eintrag in `cook_logs` (Datum, Bewertung,
  Notiz, Portionen), nur für den Nutzer selbst sichtbar und im Datenexport enthalten. Timer, abgehakte Zutaten und
  gewählte Portionen bleiben nur im Browser (Arbeitsspeicher) und werden nicht gespeichert. Die Bildschirmsperre
  (Wake Lock) ist eine reine Browser-Funktion ohne Datenübertragung. Neue Grundbestands-Zutaten (keine
  personenbezogenen Daten). Keine neuen Dienstleister.

- **Phase 8:** App ist installierbar (Web-App-Manifest, Service Worker). Der Service Worker speichert nur
  Programmdateien und die Offline-Seite, keine Seiten mit persönlichen Daten. Einstellungen: Anzeigename/Passwort
  ändern, „Meine Daten herunterladen“, Rezept-Sicherung (Export/Import), „Account löschen“. Hosting auf **Vercel**
  (Functions in Frankfurt `fra1`, keine Analytics, keine Speed Insights); Code in einem privaten GitHub-Repository
  (enthält keine Nutzerdaten und keine Schlüssel). Keine neuen Tabellen.

- **Phase 7:** Rezeptfotos im privaten Storage-Bucket (Ordner pro Nutzer und Rezept), vor dem Upload im Browser ohne
  Metadaten neu kodiert; beim Löschen eines Rezepts wird der Ordner geleert, beim Löschen des Accounts der ganze
  Nutzerordner. Kopien (Duplizieren/Übernehmen) bekommen eine eigene Kopie des Fotos, die der neuen Person gehört.
  Import per Link: Abruf fremder Webseiten durch den Server, ohne Nutzerdaten; Fotos der Seite werden nicht
  übernommen. Keine neuen Tabellen, keine neuen Dienstleister (Storage gehört zu Supabase).

- **Phase 6:** Community. Schalter „Öffentlich“ (`recipes.is_public`), Seite „Entdecken“ mit Anzeigename des Autors
  (nie E-Mail), „In mein Rezeptbuch übernehmen“ (private Kopie mit `forked_from_id`), öffentliche Rezepte anderer im
  Wochenplan. Keine neuen Tabellen, keine neuen Dienstleister. Für die Datenschutzerklärung wichtig: veröffentlichte
  Inhalte und der Anzeigename sind für alle Mitglieder sichtbar, übernommene Kopien bleiben bei den anderen.

- **Phase 5:** Statistiken werten nur vorhandene eigene Daten aus (Rezepte, Wochenplan, Ziele), im Browser des
  Nutzers dargestellt. Nichts Neues gespeichert, keine neuen Dienstleister; Recharts läuft lokal ohne externe Anfragen.
- **Phase 4:** Einkaufsliste (`shopping_list_items`) und die Einstellung „Grundzutaten ausblenden“
  (`user_settings.hide_staples`) werden genutzt, nur für den Nutzer selbst sichtbar. Keine neuen Tabellen,
  keine neuen Dienstleister.
- **Phase 3:** Wochenplan (`meal_plan_entries`) und Tagesziele (`user_goals`, Typ „default“) werden jetzt
  genutzt, nur für den Nutzer selbst sichtbar. Beides kann Rückschlüsse auf Ernährung/Gesundheit zulassen
  (siehe Hinweis oben). Keine neuen Tabellen, keine neuen Dienstleister.
- **Phase 2:** Rezepte, Zutaten, Favoriten werden jetzt genutzt. Neue Zutaten speichern `created_by`
  (für Admin/Nutzer nicht sichtbar, nur technisch für „eigene Zutat korrigieren“). Open-Food-Facts-Suche
  serverseitig, nur mit Suchbegriff. Keine neuen Tabellen, keine neuen Dienstleister.

- **Phase 1:** Schema für alle Tabellen mit RLS und Cascade, Supabase Auth mit Einladung, Admin-Nutzerliste
  (E-Mail nur für Admin), Theme-Wahl im `localStorage`, noindex.
