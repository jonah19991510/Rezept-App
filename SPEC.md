# Projekt: Rezeptbuch-App mit Makros, Wochenplan & Community

Du baust mit mir eine eigenständige Web-App für Rezepte, Makronährstoffe und Essensplanung. Sie soll auf Handy und Desktop funktionieren, Daten geräteübergreifend speichern und mehrere Nutzer mit eigenem Account unterstützen. Ich bin kein Profi-Entwickler: Erkläre Setup-Schritte außerhalb des Codes (Supabase-Projekt anlegen, Umgebungsvariablen, Deployment) kurz und konkret.

## Arbeitsweise

- Starte mit einem Plan: Datenmodell, Ordnerstruktur, Phasen. Warte auf mein OK, bevor du Code schreibst.
- Arbeite die Phasen unten der Reihe nach ab. Nach jeder Phase muss die App lauffähig sein. Fasse am Ende jeder Phase zusammen, was fertig ist und wie ich es teste.
- **Immer nur eine Phase pro Durchgang:** Nach jeder Phase stoppst du, committest und wartest auf mein OK, bevor du mit der nächsten Phase beginnst. Fang nie von dir aus eine neue Phase an.
- Führe eine Datei `PROGRESS.md`: welche Phasen fertig sind, was als Nächstes kommt, offene Punkte und bekannte Probleme. Aktualisiere sie am Ende jeder Phase. Wenn du in einer neuen Sitzung startest, lies zuerst `SPEC.md` und `PROGRESS.md`.
- Committe nach jedem sinnvollen Schritt mit aussagekräftiger Commit-Message.
- Wenn eine Anforderung unklar ist oder es mehrere sinnvolle Wege gibt, frag nach, statt zu raten.
- Schemaänderungen immer als neue Migration, bestehende Migrationen nie nachträglich ändern.
- **Falls das Projekt schon existiert:** Lies zuerst den aktuellen Stand, gleiche ihn mit dieser Spec ab, sag mir, welche Phasen fertig sind, und plane nur die fehlenden Teile. Das gilt besonders für den Abschnitt „Datenschutz & Zugang“: Wenn bereits abgeschlossene Phasen davon betroffen sind (z. B. Auth in Phase 1), rüste die fehlenden Punkte nach, bevor du mit der nächsten Phase weitermachst, und sag mir vorher, was du ändern willst.

## Tech-Stack

- **Next.js** (App Router, TypeScript strict)
- **Supabase**: Auth, Postgres, Storage, Row Level Security
- **Tailwind CSS** + **shadcn/ui**, Icons mit **lucide-react**
- **Recharts** für interaktive Diagramme
- **Zod** für Validierung
- **PWA**: installierbar auf dem Homescreen (Manifest, Icons, Service Worker)
- Deployment auf **Vercel**
- Datenbankschema als SQL-Migrationen im Repo (`supabase/migrations`), dazu `.env.example` und eine README mit Setup-Anleitung

## Sprache & Einheiten

UI komplett auf Deutsch, metrische Einheiten, deutsches Zahlen- und Datumsformat (1.234,5 g; Mo, 19.10.; 3,49 €).

## Datenmodell (Vorschlag, gern verbessern)

- `profiles`: id (= auth user), display_name, avatar_url, `role` (`user` | `admin`, Standard `user`; nur per Migration oder Dashboard änderbar, nie vom Nutzer selbst)
- `ingredients`: globale Zutatentabelle. name, kcal/protein/carbs/fat/fiber/sugar pro 100 g, `food_group` (Gemüse, Obst, Fleisch, Fisch, Milchprodukte, Ei, Getreide/Pasta/Reis, Hülsenfrüchte, Nüsse/Samen, Öle/Fette, Gewürze/Saucen, Spirituosen, Liköre/Wein, Sirup/Säfte, Sonstiges), Gewicht pro Stück (optional), `density_g_per_ml` (optional, für Cup-Umrechnung), `abv` (Alkoholgehalt in %, optional), `is_staple` (Grundzutat wie Salz/Öl/Pfeffer, die man meist zu Hause hat), source (`openfoodfacts` | `user`), external_id
- `recipes`: owner_id, `recipe_type` (`dish` | `cocktail`), title, description, servings, prep_minutes, cook_minutes, category, tags[], is_public, image_url, source_url, forked_from_id, `share_token` (nullable, für Teilen per Link), `current_version` (int), created_at, updated_at
- `cocktail_details`: recipe_id, glass (Tumbler, Coupette, Highball, Martini, Tiki, Sonstiges), method (geshaked, gerührt, gebaut, geblendet), ice, garnish
- `recipe_ingredients`: recipe_id, ingredient_id, amount, unit (g, ml, cl, Stück, EL, TL, Prise, Dash), grams (normalisiert), note, `step_position` (optional, in welchem Schritt die Zutat gebraucht wird)
- `recipe_steps`: recipe_id, position, text, `timer_seconds` (optional)
- `recipe_versions`: recipe_id, version, snapshot (jsonb mit Titel, Zutaten, Schritten, Portionen), change_note, created_at
- `meal_plan_entries`: user_id, date, slot (Frühstück, Mittag, Abend, Snack), recipe_id, servings, `batch_id` (nullable), `is_leftover` (bool)
- `meal_prep_batches`: id, user_id, recipe_id, cook_date, servings_cooked
- `plan_days`: user_id, date, `is_training_day`
- `user_goals`: user_id, `goal_type` (`default` | `training`), kcal, protein, carbs, fat
- `user_settings`: user_id, training_weekdays (int[], Standard-Trainingstage), shopping_sort, weitere Präferenzen
- `shopping_list_items`: user_id, ingredient_id (optional), name, amount, unit, checked, source (`plan` | `manual`)
- `pantry_items`: user_id, ingredient_id, amount (optional), unit (optional), `location` (`kitchen` | `bar`), updated_at
- `ingredient_prices`: user_id, ingredient_id, price, package_amount, package_unit, store (optional), updated_at → daraus Preis pro 100 g/ml
- `cook_logs`: user_id, recipe_id, cooked_at, rating (1–5), note, servings
- `favorites`: user_id, recipe_id

Makros pro Rezept werden aus den Zutaten berechnet (gesamt und pro Portion). Lege dafür eine View oder Funktion in Postgres an, damit Liste, Wochenplan und Statistiken dieselbe Berechnung nutzen. Dasselbe gilt für Kosten pro Rezept/Portion und den Alkoholgehalt von Cocktails.

Alle nutzerbezogenen Fremdschlüssel (owner_id, user_id und alles, was an Rezepten hängt) mit `ON DELETE CASCADE` anlegen, damit beim Löschen eines Accounts alle zugehörigen Daten mitgelöscht werden (siehe „Datenschutz & Zugang“). Bei `forked_from_id` dagegen `ON DELETE SET NULL`, damit Kopien anderer Nutzer erhalten bleiben.

## Sicherheit (RLS)

- RLS ist auf **jeder** Tabelle aktiv, ohne Ausnahme.
- Private Rezepte: nur der Owner kann lesen und schreiben.
- Öffentliche Rezepte: alle eingeloggten Nutzer können lesen, nur der Owner bearbeitet.
- Rezepte mit `share_token`: Lesen ohne Login nur über eine Security-Definer-Funktion, die genau ein Rezept per Token zurückgibt. Keine allgemeine anonyme Leseberechtigung auf `recipes`.
- Wochenplan, Ziele, Einkaufsliste, Vorrat, Preise, Koch-Log, Versionen, Favoriten: nur der eigene Nutzer.
- Zutaten: alle lesen, eingeloggte Nutzer können neue anlegen.
- `profiles`: Nutzer dürfen ihr eigenes Profil bearbeiten, aber nicht das Feld `role`.
- Storage (Rezeptfotos): ein Ordner pro Nutzer-ID, Hochladen und Löschen nur im eigenen Ordner.
- Der Service-Role-Key darf niemals im Client landen, nur serverseitig (Server Actions / Route Handlers) und nie in einer `NEXT_PUBLIC_`-Variable.

## Datenschutz & Zugang

Die App läuft vorerst nur privat im Freundes- und Familienkreis. Fremde dürfen sich **nicht** selbst registrieren können. Alles soll aber so vorbereitet sein, dass ich die App später mit wenig Aufwand öffentlich machen kann.

### Datensparsamkeit
- Passwörter und Logins laufen ausschließlich über Supabase Auth. Keine eigene Passwort-Tabelle, keine Passwörter in Logs oder im Frontend-State.
- Pro Nutzer speichern wir nur E-Mail (in Supabase Auth) und einen frei wählbaren Anzeigenamen (in `profiles`). Keine weiteren persönlichen Daten wie Geburtsdatum, Adresse oder Telefonnummer.
- Anderen Nutzern wird nie die E-Mail-Adresse angezeigt, nur der Anzeigename. Das gilt auch für „Entdecken“ und geteilte Rezeptkarten.

### Registrierung nur auf Einladung
- Umgebungsvariable `SIGNUP_MODE=invite|open` (Standard: `invite`).
- Bei `invite`: Die Login-Seite zeigt keinen „Registrieren“-Button. Erkläre mir, wie ich in Supabase unter Authentication die freie Registrierung (neue Sign-ups) abschalte.
- **Admin-Seite** (nur für `role = 'admin'`, das bin ich; erklär mir, wie ich mich per SQL einmalig zum Admin mache): E-Mail-Adresse eingeben → serverseitig `auth.admin.inviteUserByEmail`. Die eingeladene Person setzt über den Link aus der Mail ihr Passwort und ihren Anzeigenamen. Dafür braucht es eine Seite zum Passwort-Setzen.
- Auf der Admin-Seite sehe ich eine Liste der Nutzer (Anzeigename, E-Mail, Registrierungsdatum) und kann Nutzer löschen.
- Bei `open`: normale Registrierung per E-Mail und Passwort mit Bestätigungsmail, Links zu Impressum und Datenschutz im Footer und im Registrierungsformular.

### Nicht auffindbar für Suchmaschinen
- `robots.txt` mit `Disallow: /` für alle Bots.
- Auf allen Seiten `<meta name="robots" content="noindex, nofollow">`, zusätzlich den Header `X-Robots-Tag: noindex` über die Next.js-Config.
- Das gilt auch für geteilte Rezeptkarten `/r/[token]`. Die Link-Vorschau (Open Graph) für Messenger funktioniert trotzdem weiter.

### Keine Datenweitergabe an Dritte
- Kein Google Analytics, kein Vercel Analytics, keine Tracking-Pixel, keine eingebetteten Fremd-Inhalte.
- Schriften (Fraunces, Inter) über `next/font` einbinden, damit sie selbst gehostet werden, nicht per Google-Fonts-Link.
- Open Food Facts und der Link-Import werden nur serverseitig oder ohne Nutzerdaten abgefragt. Es werden keine personenbezogenen Daten an diese Dienste geschickt.
- Es werden nur technisch notwendige Cookies gesetzt (Supabase-Session). Damit brauchen wir keinen Cookie-Banner. Falls ein Feature das ändern würde, frag mich vorher.
- Server-Region: Das Supabase-Projekt liegt in Frankfurt. Setz die Vercel-Functions-Region auf `fra1` und erklär mir, wo ich das in Vercel prüfe.

### Rechte der Nutzer
- **Account löschen:** In den Einstellungen gibt es „Account löschen“ mit Bestätigungsdialog (Anzeigename eintippen). Das löscht serverseitig den Auth-User und per Cascade alle zugehörigen Daten, auch veröffentlichte Rezepte und Share-Links. Die Fotos im Storage löschen wir vorher explizit, da Storage-Objekte nicht automatisch per Cascade verschwinden.
- **Meine Daten herunterladen:** In den Einstellungen gibt es einen Export aller eigenen Daten als JSON (Profil, Rezepte inkl. Versionen, Wochenpläne, Ziele, Einkaufsliste, Vorrat, Preise, Koch-Log, Favoriten). Der Rezept-Backup-Export und der Markdown-Export bleiben zusätzlich bestehen.

### Vorbereitung für später (öffentlicher Betrieb)
- Leg die Seiten `/impressum` und `/datenschutz` als Platzhalter an, mit deutlich markierten TODO-Stellen. Schreib **keine** Rechtstexte, die nach fertigen Texten aussehen. Verlinke die Seiten im Footer, sobald `SIGNUP_MODE=open` ist.
- Leg eine Datei `DATENVERARBEITUNG.md` an und halte sie bei jeder Phase aktuell. Sie listet auf, welche personenbezogenen Daten wo gespeichert werden (Tabelle bzw. Dienst), wofür, und welche Dienstleister beteiligt sind (Supabase, Vercel, Open Food Facts). Das ist später die Grundlage für die Datenschutzerklärung.
- Ergänze in `DATENVERARBEITUNG.md` eine Checkliste „Vor dem Öffnen der Registrierung“: Impressum und Datenschutzerklärung fertig, Auftragsverarbeitungsverträge (DPA) mit Supabase und Vercel abgeschlossen, eigener SMTP-Dienst für E-Mails eingerichtet (der Supabase-Standardversand ist stark limitiert), `SIGNUP_MODE=open` gesetzt, freie Registrierung in Supabase wieder aktiviert, noindex-Regeln bewusst überprüft.

## Features

### 1. Accounts
Login per E-Mail + Passwort, Passwort zurücksetzen, Profil mit Anzeigename. Jeder Nutzer hat sein eigenes Rezeptbuch. Neue Accounts entstehen vorerst nur per Einladung über die Admin-Seite (siehe „Datenschutz & Zugang“). In den Einstellungen: Anzeigename ändern, Passwort ändern, „Meine Daten herunterladen“, „Account löschen“.

### 2. Rezepte
- Anlegen, bearbeiten, löschen, duplizieren. Felder wie im Datenmodell, Zubereitungsschritte sortierbar.
- Zutaten mit Autocomplete: zuerst in der eigenen `ingredients`-Tabelle suchen, sonst über die **Open Food Facts API** (deutsche Produkte bevorzugen). Treffer werden in `ingredients` gespeichert, damit sie beim nächsten Mal schnell da sind. Findet sich nichts, kann ich eine Zutat mit Nährwerten manuell anlegen.
- Mengen in g, ml, cl, Stück, EL, TL werden in Gramm umgerechnet (ml über `density_g_per_ml`, sonst ≈ g; Stück über Stückgewicht; EL/TL über sinnvolle Standardwerte).
- Makros (kcal, Protein, Kohlenhydrate, Fett, Ballaststoffe) werden live beim Bearbeiten berechnet und pro Portion sowie gesamt angezeigt.
- Kategorien: Pasta, Reis, Bowl, Suppe/Eintopf, Salat, Auflauf, Fleischgericht, Fisch, Frühstück, Snack, Dessert, Getränk.
- Automatische Tags, berechnet aus den Daten: **High Protein** (mindestens 30 g Protein pro Portion oder mindestens 30 % der kcal aus Protein; Schwellenwerte zentral konfigurierbar), **Vegetarisch**, **Vegan**, **Low Carb**, **Meal-Prep-geeignet** (manuell setzbar). Eigene Tags zusätzlich frei vergebbar.
- **Fotos**: Upload in Supabase Storage, vorher clientseitig komprimieren und dabei Metadaten (EXIF, z. B. GPS-Standort) entfernen.
- **Import per Link**: URL eingeben, serverseitig die Seite laden und schema.org/Recipe (JSON-LD) auslesen. Zutatenzeilen in Menge, Einheit und Name zerlegen und mir vor dem Speichern eine Bestätigungsansicht zeigen, in der ich die Zuordnung zu Zutaten korrigieren kann. Quell-URL speichern. Importierte Rezepte sind standardmäßig privat. Einheiten werden dabei automatisch metrisch umgerechnet (Abschnitt 8).
- **Portionen skalieren** in der Detailansicht: Plus/Minus ändert alle Mengen und Makros temporär, ohne das Rezept zu speichern. Mengen sinnvoll runden (keine 0,37 Eier, sondern „ca. ½ Ei" bzw. ganze Gramm).
- Suche und Filter: Text, Kategorie, Tags, Makro-Bereiche (z. B. Protein > 30 g), Zubereitungszeit, Kosten pro Portion, Bewertung, „lange nicht gekocht".
- JSON-Export und -Import aller eigenen Rezepte als Backup.

### 3. Wochenplan
- Wochenansicht Mo bis So mit Slots Frühstück, Mittag, Abend, Snack. Auf dem Handy eine Tagesansicht mit Wischen zwischen den Tagen.
- Rezept per Suche einem Slot zuweisen, Portionen pro Eintrag anpassbar.
- Makros pro Tag und für die ganze Woche summiert, dazu Kosten pro Tag und Woche (sofern Preise hinterlegt sind).
- **Tagesziele**: In den Einstellungen kcal, Protein, Kohlenhydrate und Fett festlegen. Der Wochenplan zeigt Soll gegen Ist pro Tag mit Fortschrittsbalken.
- **Trainingstage**: Zweites Zielset „Trainingstag" (z. B. mehr Protein und kcal). In den Einstellungen Standard-Trainingstage pro Wochentag festlegen, im Plan pro Tag per Hantel-Symbol umschaltbar. Der Tag nutzt dann automatisch das passende Ziel.
- **Lücken-Hinweis**: Zeigt pro Tag, was zum Ziel fehlt (z. B. „noch 35 g Protein"), und schlägt passende Rezepte/Snacks aus dem eigenen Buch vor, die die Lücke am besten schließen.
- **Meal Prep**: Beim Einplanen „Für mehrere Tage kochen" wählen. Es entsteht ein Batch: einmal kochen, Portionen auf mehrere Slots/Tage verteilen. Folge-Einträge sind als Reste markiert (eigenes Symbol). Die Einkaufsliste zählt den Batch nur einmal.
- **Reste-Vorschläge**: Wenn ein Batch übrig bleibt oder ein Rezept eine typische Basis-Zutat erzeugt (z. B. gekochter Reis, Nudeln, Kartoffeln), schlage für die Folgetage Rezepte vor, die diese Basis verwenden (z. B. Bratreis aus Reis vom Vortag).
- Woche kopieren und zwischen Wochen navigieren.

### 4. Einkaufsliste
- Aus dem Wochenplan (wählbarer Zeitraum) generieren. Mengen gleicher Zutaten zusammenfassen, nach Zutatengruppe (Supermarkt-Abteilung) sortieren.
- **Vorrat abziehen**: Was im Vorratsschrank steht, wird automatisch abgezogen oder als „hast du schon" ausgegraut. Grundzutaten (`is_staple`) standardmäßig ausblenden, per Schalter einblendbar.
- Einträge abhaken, manuelle Einträge hinzufügen, erledigte ausblenden. Abgehakte Einkäufe können per Knopf „In Vorrat übernehmen" in den Vorratsschrank wandern.
- Geschätzte Gesamtkosten der Liste anzeigen, falls Preise hinterlegt sind.
- **Export**: „Als Text kopieren" und Teilen über die Web Share API.
- Auf dem Handy gut im Supermarkt nutzbar: große Checkboxen, wenig Ablenkung.

### 5. Statistiken (interaktiv mit Recharts)
Tooltips bei Hover/Tap, Klick auf ein Diagramm-Segment filtert die passende Rezeptliste darunter.
- Rezepte nach Kategorie (Donut), z. B. wie viele Pasta-Gerichte
- Anteil High-Protein-Rezepte und weitere Auto-Tags
- Protein gegen kcal pro Portion (Scatter, jeder Punkt ein Rezept)
- Zusammensetzung pro Rezept nach Zutatengruppe in Gramm, z. B. Gemüse gegen Fleisch (gestapelte Balken, sortierbar)
- Durchschnittliche Makroverteilung über alle Rezepte
- Makros aus dem Wochenplan über die letzten Wochen im Vergleich zum Ziel (Linie), Trainingstage markiert
- Meistgeplante und meistgekochte Rezepte, Durchschnittsbewertung
- Kosten: Kosten pro Portion je Rezept, Protein pro Euro (Scatter), Essenskosten pro Woche (Linie)
- Kochaktivität: gekochte Gerichte pro Woche, Rezepte, die lange nicht gekocht wurden

### 6. Community-Datenbank
- Jedes Rezept ist zunächst privat und lässt sich per Schalter veröffentlichen.
- Seite „Entdecken" mit allen öffentlichen Rezepten, gleiche Suche und Filter wie im eigenen Buch, Autor wird mit Anzeigenamen angezeigt (nie mit E-Mail).
- „In mein Rezeptbuch übernehmen" erstellt eine eigene, bearbeitbare Kopie mit Verweis auf das Original (`forked_from_id`).
- Öffentliche Rezepte direkt im Wochenplan verwenden.

### 7. Kochmodus
- Startknopf auf jeder Rezeptseite. Vollbild, sehr große Schrift, ein Schritt pro Ansicht, Wischen oder große Pfeile zum Weiterblättern.
- Bildschirm bleibt an (Screen Wake Lock API, mit Fallback-Hinweis, falls nicht unterstützt).
- Vor dem Start Portionen wählen. Alle Mengen im Modus sind skaliert.
- Pro Schritt die Zutaten anzeigen, die in diesem Schritt gebraucht werden (`step_position`). Dazu eine aufklappbare Gesamtzutatenliste zum Abhaken (Mise en place).
- **Timer direkt im Schritt**: Zeitangaben im Schritttext („10 Minuten", „1 Std.", „ca. 20–25 Min.") automatisch erkennen und als antippbaren Timer anzeigen, alternativ `timer_seconds`. Mehrere Timer parallel, laufen weiter beim Blättern, sichtbar in einer Leiste. Ablauf mit Ton und Vibration.
- Am Ende „Gekocht!": öffnet den Koch-Log-Eintrag (Bewertung, Notiz) und bietet an, verbrauchte Zutaten aus dem Vorrat abzuziehen.

### 8. Einheiten-Umrechnung
- Zentrale Umrechnungslogik für amerikanische Einheiten: cup, tbsp, tsp, oz, lb, fl oz, stick (Butter), pint, quart. °F in °C, auch im Schritttext.
- Cups zutatenabhängig über `density_g_per_ml` (Mehl, Zucker, Reis, Butter etc. mit sinnvollen Standardwerten im Seed), sonst 1 cup = 240 ml.
- Wird automatisch beim Import angewendet. Zusätzlich ein kleiner Umrechner als Werkzeug in der App.

### 9. Vorratsschrank
- Zwei Bereiche: **Küche** und **Bar**. Zutaten hinzufügen mit Autocomplete, Menge optional („vorhanden" reicht).
- **„Was kann ich kochen?"**: Rezepte nach Abdeckung durch den Vorrat sortieren (Grundzutaten ignorieren). Anzeigen: „Alles da", „Fehlt 1 Zutat" (mit Name), „Fehlen 2–3". Fehlende Zutaten mit einem Tipp auf die Einkaufsliste setzen.
- Optional „Läuft bald ab"-Datum für Zutaten, bevorzugt in den Vorschlägen.

### 10. Kosten pro Portion
- Pro Zutat Preis und Packungsgröße eintragen (z. B. 3,49 € für 500 g), optional Laden. Preise pro Nutzer.
- Rezept zeigt Kosten gesamt und pro Portion. Fehlen Preise für einzelne Zutaten, wird das transparent angezeigt („3 von 9 Zutaten ohne Preis").
- Schnelleingabe: In der Einkaufsliste kann ich beim Abhaken den bezahlten Preis eintragen.

### 11. Koch-Log & Bewertungen
- Jedes Mal, wenn ich ein Gericht koche: Datum, Bewertung (1–5), Notiz (z. B. „nächstes Mal mehr Chili"). Eintrag über den Kochmodus oder direkt auf der Rezeptseite.
- Rezeptseite zeigt „Zuletzt gekocht vor X Tagen", Anzahl, Durchschnittsbewertung und die Notizen chronologisch. Die letzte Notiz erscheint prominent beim nächsten Kochen.
- Bereich **„Lange nicht gekocht"**: gut bewertete Rezepte, die seit mindestens X Wochen nicht gekocht wurden (konfigurierbar), als Vorschlag im Wochenplan.

### 12. Rezept-Versionen
- Beim Speichern einer inhaltlichen Änderung (Zutaten, Mengen, Schritte, Portionen) wird automatisch eine neue Version mit optionaler Änderungsnotiz angelegt (z. B. „Lasagne v3: weniger Béchamel").
- Versionsverlauf auf der Rezeptseite, Vergleichsansicht zwischen zwei Versionen (geänderte Zutaten/Mengen farbig markiert, Makro-Differenz), alte Version wiederherstellen.
- Koch-Log-Einträge merken sich, welche Version gekocht wurde.

### 13. Markdown-Import & -Export
- **Markdown-Import**: Ich habe eine bestehende Rezeptsammlung als Markdown-Datei. Frag mich nach einer Beispieldatei, baue einen passenden Parser (ein Rezept pro Überschrift) mit Vorschau aller erkannten Rezepte. Ich wähle aus, welche importiert werden. Was der Parser nicht sicher erkennt, landet in derselben Bestätigungsansicht wie beim Link-Import, damit ich es korrigieren kann.
- **Markdown-Export**: Einzelnes Rezept oder ganzes Buch als `.md`, mit Inhaltsverzeichnis oben.

### 14. Teilen per Link
- Auf jedem Rezept „Link teilen": erzeugt einen `share_token` und eine öffentliche Seite `/r/[token]`, lesbar ohne Account, auch für private Rezepte. Link jederzeit widerrufbar.
- Die Seite ist eine schön gestaltete Rezeptkarte (Foto, Makros, Zutaten mit Portionsskalierung, Schritte), mit Open-Graph-Vorschaubild für WhatsApp/Instagram und einem Knopf „In mein Rezeptbuch übernehmen" für eingeloggte Nutzer. Als Autor erscheint nur der Anzeigename. Die Seite ist `noindex`.
- Druckansicht und Export der Rezeptkarte als Bild (für Instagram-Stories).

### 15. Cocktail-Bereich (Bar)
- Umschalter **Küche | Bar** oben in der Rezepte-Ansicht. Cocktails sind Rezepte mit `recipe_type = cocktail` und eigenen Feldern (Glas, Methode, Eis, Garnitur). Mengen in ml/cl, Dash, Barlöffel.
- **Alkoholgehalt** pro Drink automatisch berechnen: Alkohol aus Zutaten (`abv`) plus Verdünnung je Methode (Standardwerte, zentral konfigurierbar: z. B. gerührt ≈ +20 %, geshaked ≈ +25 %, gebaut ≈ +10 %). Anzeige in % vol und Gramm Alkohol pro Drink, dazu kcal.
- **Bar-Bestand**: Spirituosen, Liköre, Sirups und Säfte im Vorratsbereich „Bar".
- **„Was kann ich mixen?"**: wie „Was kann ich kochen?", nur für Cocktails. Zusätzlich anzeigen, welche **eine** zusätzliche Flasche die meisten neuen Cocktails freischalten würde.
- Kochmodus funktioniert auch als Mix-Modus.
- Eigene Statistiken: Cocktails nach Basisspirituose, Methode, Alkoholgehalt.

## Navigation

Bottom-Navigation bleibt bei maximal 5 Punkten: **Rezepte** (mit Küche/Bar-Umschalter), **Wochenplan**, **Einkauf** (Tabs: Liste, Vorrat), **Statistik**, **Entdecken**. Einstellungen, Profil, Preise, Import/Export und (nur für Admins) die Admin-Seite über das Profilbild oben. Der Kochmodus öffnet sich als Vollbild über allem.

## Design

Modern und minimalistisch, mit warmem Küchen-Charakter:
- Warmer, cremefarbener Hintergrund statt reinem Weiß, dunkle, gut lesbare Schrift
- Eine Akzentfarbe aus der Küche (z. B. Terrakotta/Tomatenrot), dazu ein ruhiges Salbeigrün für positive Werte. Farben für Makros einheitlich in der ganzen App (Protein, Carbs, Fett)
- Der Bar-Bereich darf eine eigene, etwas dunklere Stimmung haben (z. B. tiefes Grün oder Bernstein als Akzent), bleibt aber im selben Designsystem
- Überschriften in einer eleganten Serifenschrift (z. B. Fraunces), Fließtext in einer klaren Sans (z. B. Inter), beide über `next/font` selbst gehostet
- Viel Weißraum, abgerundete Karten, große Rezeptfotos, dezente Schatten
- Dark Mode
- Mobile first: Touch-Ziele mindestens 44 px, im Kochmodus deutlich größer. Am Desktop eine Seitenleiste
- Leere Zustände mit freundlichem Hinweis, Ladezustände mit Skeletons, verständliche Fehlermeldungen

## Phasen

1. Projekt-Setup, Supabase-Anbindung, Auth mit Einladungs-Flow (`SIGNUP_MODE`, Admin-Seite, Passwort-Setzen-Seite), komplettes Schema mit RLS und Cascade-Regeln, `robots.txt` und noindex, `DATENVERARBEITUNG.md` anlegen, Seed mit ca. 50 gängigen Zutaten und 5 Beispielrezepten
2. Rezepte CRUD, Zutatensuche mit Open Food Facts, Makroberechnung, Kategorien und Auto-Tags
3. Wochenplan mit Tagesziele
4. Einkaufsliste
5. Statistiken
6. Community: veröffentlichen, Entdecken, übernehmen
7. Fotos (mit Storage-Policies und EXIF-Entfernung) und Import per Link
8. PWA, Feinschliff, Einstellungen mit „Meine Daten herunterladen“ und „Account löschen“, Platzhalter für Impressum und Datenschutz, Test bei 375 px Breite, Deployment auf Vercel (Region `fra1`, keine Analytics), README fertigstellen
9. Kochmodus mit Timern, Portionen skalieren, Einheiten-Umrechnung (inkl. Dichtewerte im Seed)
10. Vorratsschrank, „Was kann ich kochen?", Vorrat in der Einkaufsliste, Text-Export
11. Trainingstage-Ziele, Lücken-Hinweis, Meal Prep und Reste-Vorschläge
12. Preise und Kosten pro Portion, Koch-Log mit Bewertungen, „Lange nicht gekocht", Rezept-Versionen, zugehörige Statistiken
13. Markdown-Import und -Export
14. Teilen per Link mit Rezeptkarte, Open-Graph-Bild, Druck- und Bildexport
15. Cocktail-Bereich: Cocktail-Felder, Bar-Bestand, Alkoholberechnung, „Was kann ich mixen?", Bar-Statistiken; danach Gesamttest auf dem Handy, Prüfung von Datenexport und Account-Löschung mit allen neuen Tabellen, und Deployment

Neue Tabellen aus späteren Phasen müssen immer RLS, Cascade-Regeln, den Datenexport und `DATENVERARBEITUNG.md` mitberücksichtigen.

## Qualität

- TypeScript strict, kein `any`
- Eingaben mit Zod validieren, auf Client und Server
- Unit-Tests für: Makroberechnung (inkl. Einheiten und Portionen), Einheiten-Umrechnung (US → metrisch, °F → °C), Skalierung und Rundung, Kostenberechnung, Alkoholgehalt, Timer-Erkennung im Schritttext, Vorrat-Abgleich („Was kann ich kochen?"), Markdown-Parser
- RLS-Tests oder eine Prüfanleitung: Nutzer B darf private Daten von Nutzer A weder lesen noch ändern, normale Nutzer kommen nicht auf die Admin-Seite und können ihre `role` nicht ändern, nach „Account löschen“ sind keine Daten des Nutzers mehr in der Datenbank oder im Storage
- Keine Secrets im Repo, alle Keys in `.env.example` dokumentiert

Beginne jetzt mit dem Plan für Phase 1 und dem vollständigen Datenmodell (oder, falls das Projekt schon existiert, mit dem Abgleich des aktuellen Stands).
