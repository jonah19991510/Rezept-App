# Topform – Funktionsübersicht

Stand: 09.11.2026 (abgeleitet aus Code, `SPEC.md` und `PROGRESS.md`, letzter Commit `d6fff0c`).
Live: <https://unser-rezeptbuch.vercel.app> · Next.js 16 · Supabase (Frankfurt) · Vercel (`fra1`)

Die App hat **drei Bereiche** (Umschalter oben links): **Start**, **Essen & Trinken**, **Sport & Gesundheit**.
Dazu kommen gemeinsame Seiten (Einstellungen, Nutzerverwaltung), öffentliche Seiten (geteilte Rezepte, Login) und
die Plattform darunter (Datenschutz, PWA, Datenbank).

```
Topform
├── 0  Plattform & Zugang          (Login, Einladung, Navigation, PWA, Datenschutz)
├── 1  Start                        (Begrüßung + anpassbare Widgets)
├── 2  Essen & Trinken
│   ├── 2.1 Rezepte (Küche)         ├── 2.6 Wochenplan
│   ├── 2.2 Rezept-Editor           ├── 2.7 Einkauf (Liste · Vorrat · Was kochen/mixen?)
│   ├── 2.3 Rezeptseite             ├── 2.8 Statistik (Küche · Bar)
│   ├── 2.4 Kochmodus               ├── 2.9 Entdecken (Community)
│   ├── 2.5 Bar / Cocktails         ├── 2.10 Teilen per Link
│   └── 2.11 Werkzeuge (Zutaten · Preise · Umrechner · Import/Export)
├── 3  Sport & Gesundheit
│   ├── 3.1 Trainingspläne          ├── 3.7 Statistik (Gym)
│   ├── 3.2 Training im Gym         ├── 3.8 Entdecken (Feed · Challenges · Rangliste · Pläne)
│   ├── 3.3 Intervall-Timer         ├── 3.9 Challenges
│   ├── 3.4 Verlauf                 ├── 3.10 Übungsdatenbank
│   ├── 3.5 Getränke                ├── 3.11 Körpermaße
│   └── 3.6 Habits                  ├── 3.12 Energiebedarfsrechner
│                                   └── 3.13 Lexikon
├── 4  Einstellungen & eigene Daten
└── 5  Admin
```

---

## 0 Plattform & Zugang

**Navigation**
- Bereichs-Umschalter (Start · Essen & Trinken · Sport & Gesundheit); Sport-Bereich mit Petrol-Akzent, Essen mit Terrakotta
- Handy: schwebende untere Leiste (max. 5 Punkte, Tabs vorgeladen); Desktop: Seitenleiste
- Profilmenü (Avatar): Einstellungen, bereichsabhängige Werkzeuge, Hell/Dunkel/System, Abmelden, Nutzerverwaltung (nur Admin)
- Editoren (Rezept, Plan, Challenge) und Vollbild-Modi (Kochen, Training, Intervall) ohne Navigation

**Accounts & Auth** (`(auth)`, `auth/confirm`)
- Login mit E-Mail + Passwort, Passwort vergessen, Passwort setzen (+ Anzeigename bei Einladung)
- Registrierung nur per Einladung (`SIGNUP_MODE=invite`); bei `open` normale Registrierung mit Bestätigungsmail
- Mail-Links werden erst per Knopfdruck eingelöst (Schutz vor Link-Scannern); sichere Weiterleitung `?weiter=`
- Login-Pflicht und Session-Erneuerung im Proxy (`src/proxy.ts`)

**Datenschutz & Betrieb**
- Kein Tracking, keine Analytics, selbst gehostete Schriften, nur technisch notwendige Cookies
- `robots.txt` Disallow, `noindex`-Meta + `X-Robots-Tag` (auch für geteilte Karten)
- RLS auf jeder Tabelle, Service-Key nur serverseitig; Fotos nur über `/foto/…` mit Rechteprüfung
- Impressum/Datenschutz als Platzhalter (`(legal)`), `DATENVERARBEITUNG.md` mit Checkliste für öffentlichen Betrieb
- Keep-alive-Cron (`/api/keep-alive`, täglich), damit Supabase nicht pausiert

**PWA**
- Installierbar (Manifest, Icons „Topf mit Puls“), Service Worker mit Offline-Seite
- Training läuft auch offline (Seite gecacht, Stand im `localStorage`, späteres Hochladen)

---

## 1 Start (`/`)

- Begrüßung nach Tageszeit, Datum
- **Startseite anpassen:** Widgets per Drag & Drop sortieren, ein-/ausblenden, „Standard“; im Konto gespeichert (PC = Handy)
- Widgets (Standard sichtbar ✔ / wählbar ○):
  - ✔ **Heute** – Ringe für kcal und Protein (laut Wochenplan vs. Tagesziel) und Trinken
  - ✔ **Als Nächstes** – nächste Mahlzeit und laufendes/nächstes Training
  - ✔ **Essen & Trinken** – Bereichskarte („noch X kcal“), Schnellzugriffe, offene Einkäufe als Zahl
  - ✔ **Sport & Gesundheit** – Bereichskarte, Schnellzugriffe Training, Körper, Energie, Habits
  - ✔ **Habits heute** (direkt abhaken) · ✔ **Habits diese Woche** · ✔ **Challenges** (heute abhaken) · ✔ **Training geplant**
  - ○ Heute geplant · ○ Einkaufsliste · ○ Was kann ich kochen? · ○ Training diese Woche · ○ Läuft bald ab · ○ Lange nicht gekocht

---

## 2 Essen & Trinken

### 2.1 Rezepte – Liste (`/rezepte`, Umschalter **Küche | Bar**)
- Suche (Pille) + Filter-Chips: Favoriten, Kategorie, Tag, „Lange nicht gekocht“, Regler für Protein ab, Zeit bis, Kosten/Portion, Bewertung
- Filter und Sortierung in der URL (Zurück funktioniert), Sortierung wird gemerkt
- Ansicht „Nebeneinander | Untereinander“ (pro Nutzer gespeichert)
- Karten mit Foto, Kategorie, Zeit, kcal bzw. % vol, Herz für Favoriten, Globus bei öffentlichen
- Hinweis „Was kann ich kochen?“ mit Anzahl vollständig abgedeckter Rezepte
- Schwebender Knopf „Neues Rezept“

### 2.2 Rezept-Editor (`/rezepte/neu`, `…/[id]/bearbeiten`)
- Felder: Titel, Beschreibung, Portionen, Vorbereitungs-/Kochzeit, Kategorie (eigene Liste), eigene Tags, Meal-Prep-Schalter, Quelle, Beilagen („Passt dazu“)
- **Zutaten:** Autocomplete eigene Datenbank → Open Food Facts (deutsche zuerst) → selbst anlegen; Mengen in g, ml, cl, Stück, EL, TL, Prise, Dash, Barlöffel → Gramm; Notiz, optional-Schalter, „Gebraucht in Schritt X“
- **Schritte:** sortierbar (Drag & Drop), Timer pro Schritt (oder aus dem Text erkannt)
- Live-Makros (kcal, Protein, KH, Fett, Ballaststoffe) gesamt und pro Portion
- Bottom-Sheets für Zutat/Schritt, Speicherleiste unten, Änderungsnotiz für die Version

### 2.3 Rezeptseite (`/rezepte/[id]`)
- Kopf mit Foto (hinzufügen/ändern/entfernen; clientseitig komprimiert, EXIF/GPS entfernt), Herz, Menü (Duplizieren, Als Markdown, Löschen)
- **Privat | Öffentlich**-Umschalter
- Kacheln: Zeit, Portionen, Kosten/Portion (Bar: Glas, Eis, Stärke)
- **Portionen skalieren** (nur Ansicht, sinnvoll gerundet: „ca. ½ Ei“)
- Nährwerte pro Portion, Auto-Tags (High Protein, Vegetarisch, Vegan, Low Carb, Meal-Prep)
- Kosten mit „X von Y Zutaten ohne Preis“ + Dialog „Preise ergänzen“
- **Koch-Log:** „Gekocht eintragen“ (Datum, 1–5 Sterne, Notiz), zuletzt gekocht vor …, Anzahl, Ø-Bewertung, Notizen
- **Versionen:** Verlauf, Vergleich zweier Versionen (farbig, Makro-Differenz), Wiederherstellen
- Teilen per Link, Beilagen mit Links auf eigene Rezepte, „Kochen starten“ / „Bearbeiten“ bzw. „Übernehmen“

### 2.4 Kochmodus (`/kochen/[id]`)
- Vollbild, große Schrift, ein Schritt pro Ansicht, Wischen/Pfeile, Bildschirm bleibt an (Wake Lock)
- Portionen vor dem Start wählen; letzte Koch-Notiz wird angezeigt
- Zutaten je Schritt + Mise-en-place-Liste zum Abhaken
- Timer aus dem Text erkannt („ca. 20–25 Min.“), mehrere parallel, Ton + Vibration
- „Gekocht!“ → Koch-Log-Eintrag und verbrauchte Mengen vom Vorrat abziehen
- Funktioniert als Mix-Modus für Cocktails

### 2.5 Bar / Cocktails (`/rezepte/bar`)
- Cocktails als Rezepttyp mit Glas, Methode, Eis, Garnitur
- Automatischer **Alkoholgehalt** (% vol, g Alkohol) inkl. Verdünnung je Methode, dazu kcal
- Filter nach Spirituose und Methode; Bar-Bestand im Vorrat
- „Was kann ich mixen?“ inkl. „Diese **eine** Flasche schaltet die meisten neuen Cocktails frei“
- Eigene Bar-Statistik und Bar-Entdecken

### 2.6 Wochenplan (`/wochenplan`)
- Woche Mo–So mit Frühstück, Mittag, Abend, Snack; Handy: Tagesansicht mit Wischen
- Einplanen: **Mein Buch | Entdecken | Eigenes** (z. B. „Restaurant“, ohne Nährwerte); Portionen in halben Schritten
- Makros und Kosten pro Tag und Woche, **Soll/Ist mit Fortschrittsbalken** gegen Tagesziel
- **Trainingstage** (Hantel) mit eigenem Zielset, Standard-Wochentage aus den Einstellungen
- **Lücken-Hinweis** („noch 35 g Protein“) mit passenden eigenen Rezepten
- **Meal Prep** („Für mehrere Tage kochen“, Reste markiert, Einkauf zählt einmal), **Reste-Vorschläge** (Reis, Nudeln, Kartoffeln)
- „Lange nicht gekocht“-Vorschläge, Woche kopieren (ergänzen/ersetzen), Wochen blättern

### 2.7 Einkauf (`/einkauf`, Tabs Liste · Vorrat · Was kochen? · Was mixen?)
- **Liste:** aus dem Wochenplan für wählbaren Zeitraum erzeugen, gleiche Zutaten zusammengefasst, nach Supermarkt-Abteilung sortiert; eigene Einträge bleiben
- Grundzutaten ausgeblendet (einblendbar), Vorrat abgezogen („hast du schon“ / „noch 2 Stück“)
- Abhaken, erledigte ausblenden, beim Abhaken **bezahlten Preis eintragen**, Gesamtkosten-Schätzung
- „In Vorrat übernehmen“, „Als Text kopieren“, Teilen (Web Share API)
- **Vorrat** (`/einkauf/vorrat`): Küche und Bar, Zutaten aus eigenen Rezepten zum Abhaken (vorhanden/fehlt), Menge und „Haltbar bis“ optional, „Bald verbrauchen“ oben
- **Was kann ich kochen?** (`/einkauf/was-kochen`): „Alles da“, „Fehlt 1“, „Fehlen 2–3“, bald Ablaufendes zuerst, „Fehlendes auf die Liste“
- **Was kann ich mixen?** (`/einkauf/was-mixen`): dasselbe für Cocktails + Flaschen-Empfehlung

### 2.8 Statistik (`/statistik`, `/statistik/bar`)
- Interaktiv (Recharts): Tipp auf Segment filtert die Rezeptliste darunter; jedes Diagramm auch als Tabelle; farbsehschwäche-geprüfte Palette
- Küche: Rezepte nach Kategorie (Donut), Auto-Tags, Protein vs. kcal (Scatter), Zusammensetzung nach Zutatengruppe, Ø-Makroverteilung, Plan-Makros vs. Ziel über Wochen (Trainingstage markiert), meistgeplant, meistgekocht + Bewertung, Kochaktivität, lange nicht gekocht, Kosten/Portion, Protein pro Euro, Essenskosten pro Woche
- Bar: Cocktails nach Basisspirituose, Methode, Alkoholgehalt

### 2.9 Entdecken (`/entdecken`, `/entdecken/bar`)
- Alle öffentlichen Rezepte der Runde (Autor nur mit Anzeigenamen), gleiche Suche/Filter/Sortierung
- „In mein Rezeptbuch übernehmen“ (Kopie mit Verweis aufs Original), Hinweis „In deinem Buch“
- Öffentliche Rezepte direkt im Wochenplan nutzbar

### 2.10 Teilen per Link (`/r/[token]`, öffentlich)
- Share-Token erzeugen/widerrufen, auch für private Rezepte
- Gestaltete Rezeptkarte ohne Login (Foto, Makros, skalierbare Zutaten, Schritte, Beilagen)
- Open-Graph-Vorschaubild (WhatsApp), Druckansicht, **Bild-Export im Story-Format** (`/r/[token]/bild`)
- „In mein Rezeptbuch übernehmen“ für Eingeloggte

### 2.11 Werkzeuge (Profilmenü im Bereich Essen & Trinken)
- **Zutaten** (`/zutaten`): alle eigenen/genutzten Zutaten, Ansichten Alle / In Rezepten / Selbst angelegt / Ohne Preis, A–Z oder nach Kategorie; Preis, bearbeiten (eigene; Gramm werden in allen Rezepten neu berechnet), Angaben, löschen (wenn ungenutzt)
- **Preise** (`/preise`): Preis pro Packung (+ optional Laden) → Preis pro 100 g/ml, fehlende Preise
- **Einheiten-Umrechner** (`/umrechner`): cup, tbsp, tsp, fl oz, pint, quart, oz, lb, stick → g/ml (zutatenabhängig über Dichte), °F ↔ °C
- **Import** (`/rezepte/import`): per Link (schema.org/Recipe, US-Einheiten umgerechnet, Bestätigungsansicht) und per Markdown-Datei (Vorschau, Auswahl, Prüf-Warteschlange)
- **Export:** einzelnes Rezept als Markdown, ganzes Buch als Markdown mit Inhaltsverzeichnis, JSON-Sicherung (wieder importierbar)

---

## 3 Sport & Gesundheit

### 3.1 Trainingspläne (`/sport/plaene`)
- Plankarten mit Tagen als Chips; hervorgehoben der zuletzt trainierte Plan mit „Als Nächstes“ (Play-Knopf)
- Menü: Bearbeiten, Duplizieren, Ausblenden, Löschen; ausgeblendete Pläne unten
- **Plan-Editor:** Name, Beschreibung, Tage (Name, Fokus-Vorschlag aus Muskelgruppen, sortierbar), Übungen per Drag & Drop, je Übung Sätze, Wdh. von–bis bzw. Min./Sek., Pause, Aufwärmsätze, Notiz, Tauschen; Übungsauswahl mit Suche, Muskelgruppen-Chips, Art (Training/Dehnen/Reha), Mehrfachauswahl, eigene Übung
- Planseite: alle Tage/Übungen mit aufklappbarer Anleitung, „Training starten“, Intervall-Timer, **Privat | Öffentlich**
- Fremde Pläne: direkt trainieren oder „In meine Pläne übernehmen“

### 3.2 Training im Gym (`/training/[id]`, Vollbild)
- Start mit Vorauswahl des nächsten Tags der Reihe oder „Freies Training ohne Plan“; laufendes Training fortsetzen/verwerfen
- Dauer, Werte vom letzten Mal hell vorbelegt (Abhaken übernimmt sie), Erfassungsarten kg/Wdh., +kg/Wdh., Zeit, Strecke/Zeit (km/h · km · Zeit – zwei ergeben den dritten), Ø Herzfrequenz bei Ausdauer
- Aufwärmsätze automatisch (auf Scheiben gerundet), Pausentimer mit Ton/Vibration, Bildschirm bleibt an
- Übungen tauschen/hinzufügen/entfernen/verschieben, Notizen
- **Offline-fähig** (lokal gespeichert, Sync mit Versionszähler)
- Beenden: Zusammenfassung, „Änderungen in den Plan übernehmen?“, „Training teilen“
- Nachtragen vergangener Trainings, Bearbeiten beendeter Trainings (`?bearbeiten=1`)
- Banner „Training läuft“ auf Pläne/Verlauf

### 3.3 Intervall-Timer (`/training/intervall/[Plan-ID]`)
- Mit Übungen eines Trainingstags oder frei; Vorlagen, Belastung, Pause, Runden, Vorbereitung
- Vollbild mit Pause, Zurück, Überspringen, Ton, Vibration, Wake Lock; Einstellungen je Plan im Gerät gemerkt

### 3.4 Verlauf (`/sport/verlauf`)
- Trainings nach Monat mit Dauer, Sätzen, Volumen; Detailseite mit allen Sätzen
- Fortsetzen, Bearbeiten, Löschen, Teilen in den Feed; reine Ausdauer zeigt Dauer, Tempo, Strecke, Herzfrequenz

### 3.5 Getränke (`/sport/getraenke`, Tabs Heute · Statistik · Tipps · Verlauf · Getränke)
- **Heute:** Menge vs. Tagesziel, Tempo-Balken (Soll jetzt), Schnellmengen (Espresso: 30/60 ml), „Andere Menge/Zeit“, Rückgängig, Liste mit Koffein
- **Statistik:** Woche/Monat, Ø pro Tag, Ziel erreicht, Serie, gestapelte Tagesbalken je Getränk, Tagesdetail, Tageszeit, Koffein mit 400-mg-Linie
- **Tipps:** persönliche Hinweise aus 14 Tagen + allgemeine Richtwerte
- **Verlauf:** Tage nach Monat, Tagesseite mit Nachtragen/Bearbeiten
- **Getränke:** Tagesziel, eigene Getränke (Farbe, Koffein, Zucker, Wasseranteil), **Mischgetränke** aus Zutaten, Drag & Drop-Reihenfolge

### 3.6 Habits (`/sport/habits`, Tabs Heute · Wochenplan · Statistik · Habits)
- Gewohnheiten **und Supplemente**, täglich/wöchentlich/monatlich, Ziel je Zeitraum, Wochentage, Tageszeit/Uhrzeit, Dosis, Notizen, Farbe, Pausieren
- **Heute:** Fortschritt, „Training heute“, Gruppen nach Tageszeit, abhaken/hochzählen, nachtragen, aktive Challenges abhaken
- **Wochenplan:** Trainings-Wochenplan mit Tageszeit/Uhrzeit, Art (Kraft, Ausdauer, Mobility, Sport, Erholung), Dauer
- **Statistik:** Woche/Monat, Quote, Serien, perfekte Tage, Kästchen-Übersicht je Habit, Wochentage der letzten 12 Wochen
- **Habits:** Liste mit Drag & Drop, pausierte unten

### 3.7 Statistik Gym (`/sport/statistik`)
- Zeitraum KW (blätterbar) · 4 Wochen · 3 Monate · 1 Jahr · Alles
- Kennzahlen: Trainings (pro Woche), Ø Dauer, Volumen, Serie
- Trainings/Volumen/Dauer pro Woche; **Übung im Verlauf** (1RM nach Epley, schwerster Satz, bei Ausdauer Strecke/Zeit/Tempo/Herzfrequenz), Bestwerte-Kacheln
- Sätze pro Muskelgruppe pro Woche (Band 10–20), Trainingstage-Kalender (Kraft/Ausdauer gefärbt), neue Bestwerte

### 3.8 Entdecken Sport (`/sport/entdecken`, Tabs Feed · Challenges · Rangliste · Pläne)
- **Feed:** geteilte Trainings (letzte 50) mit automatischer Zusammenfassung, Bestwerten, **Kudos**, **Kommentaren**, **Nachmachen** (eigener Plan daraus)
- **Challenges:** eigene und offene Challenges, neue anlegen
- **Rangliste:** Punkte aller öffentlichen Challenges, Monat/Gesamt, Treppchen, ausblendbar
- **Pläne:** öffentliche Trainingspläne mit Suche, Tage- und Muskelgruppen-Filter, Schwerpunkten

### 3.9 Challenges (`/sport/challenges/…`)
- Arten: Abhaken · Menge pro Tag · Gesamtmenge · Trainings (automatisch) · **Wer schafft mehr?** (Wettkampf)
- Rhythmus täglich oder x Tage/Woche; Dauer Tage / Monatsende / Jahresende; **automatisch wiederholen** (Runden)
- Start gemeinsam (mit Einstiegsfrist) oder ab Beitritt; verpasste Tage: Streng (Joker) · Serie zählt · Locker
- Punkte (Tage, Wochenserien, Schaffen, Platzbonus), Rangliste je Challenge, Statistik, frühere Runden
- Öffentlich/privat, **eigene Regeln** (Freitext), Vorlagen, Regel-Karte als Vorschau
- Regeln gesperrt, sobald andere mitmachen; Nachtragen bis 7 Tage

### 3.10 Übungsdatenbank (`/sport/uebungen`, Profilmenü)
- ca. 210 Übungen (Training, 55 Dehnen, 34 Reha) mit Anleitung, Muskel-/Nebenmuskelgruppen, Gerät, Erfassungsart
- Suche (auch in Anleitungen), Filter Alle/Eigene/In meinen Plänen/Trainiert, Art, Muskelgruppe, nach Gruppe oder A–Z
- Eigene Übungen anlegen/bearbeiten/löschen; Admin bearbeitet den Grundbestand
- Import aus der früheren Gym-App

### 3.11 Körpermaße (`/sport/koerper`, Profilmenü)
- Messungen: Gewicht + 9 Umfänge (inkl. Hals), Notiz; eine Messung pro Tag
- Übersicht (seit Start, Trend kg/Woche, BMI, Taille-Hüft-Verhältnis, **Körperfett nach Navy-Methode**), Diagramme mit Zeiträumen, Verlauf
- Messanleitung mit Figuren, Einstellungen (Größe, Geschlecht, Maße ausblenden)

### 3.12 Energiebedarfsrechner (`/sport/energie`, Profilmenü)
- Eingaben: Geschlecht, Alter, Größe, Gewicht, KFA, PAL (Schieber), Sport-Zuschlag, Ziel (Defizit/Überschuss), Wunschgewicht, Protein g/kg, Fett-%, Formel
- Ergebnis: Grundumsatz (Mifflin, Henry, Katch-McArdle, Mittelwert), Gesamtumsatz, Tagesziel, kg/Woche, Makros, Warnhinweise
- **Als Tagesziel übernehmen** (normal oder Trainingstag) → Wochenplan; Eingaben werden automatisch gespeichert

### 3.13 Lexikon (`/sport/lexikon`, Profilmenü)
- Nachschlagewerk zu Gesundheitsthemen (Training, Ernährung, Supplements, Blutwerte …), Hinweis „ersetzt keine ärztliche Beratung“
- Suche, Kategorien mit Unterkategorien, Ansicht A–Z oder nach Kategorie
- Einträge mit Fakten-Tabelle, Textblöcken, Tabellen, Querverweisen `[[Begriff]]`, „Verweise hierher“, Quelle
- Schreiben nur Admins; Entwürfe (nicht öffentlich), Kategorien verwalten

---

## 4 Einstellungen & eigene Daten (`/einstellungen`, je Bereich gefiltert)

- **Profil:** Anzeigename; **Passwort** ändern
- Essen & Trinken: **Tagesziele**, **Trainingstage** (Wochentage + eigenes Ziel), **Kategorien** (anlegen, umbenennen, löschen mit Verschieben), **Lange nicht gekocht** (Wochen-Schwelle)
- **Deine Daten:** Meine Daten herunterladen (JSON, alles), Rezepte sichern/importieren (JSON), Rezeptbuch als Markdown, Rezepte importieren
- Sport & Gesundheit: **Rangliste** (in der Gesamtrangliste zeigen), **Trainingsdaten** exportieren/importieren (eigenes Format + frühere Gym-App)
- **Account löschen** (Anzeigename eintippen; Fotos, Auth-User, per Cascade alles)

## 5 Admin (`/admin`, nur `role = admin`)

- Nutzer per E-Mail einladen, Nutzerliste (Anzeigename, E-Mail, Datum, „Einladung offen“), Nutzer löschen
- Zusätzliche Rechte: Grundbestand der Übungen bearbeiten, Lexikon schreiben, Challenges/Posts/Kommentare anderer löschen

---

## Anhang: Offene Punkte und Auffälligkeiten

Aus `PROGRESS.md` („Offene Punkte“):
- Meal Prep: „Woche kopieren“ kopiert Batches nicht als Batch, verwaiste Batches beim Ersetzen
- Markdown-Import: Fotos aus Notion-ZIP fehlen, Prüf-Warteschlange geht beim Verlassen verloren
- Preise: nur ein Preis je Zutat (keine Preise je Laden)
- Statistik „Meistgeplant/Meistgekocht“: fremde Rezepte filtern die Liste auf „nichts“
- Kochmodus: Timer überleben kein Neuladen, klingeln im Ruhezustand erst beim Aufwecken
- Datenexport: Fotos nur als Liste (kein ZIP)
- Feed zeigt nur die letzten 50 Posts (kein Nachladen)
- Offen beim Nutzer: Einladungs-Mail sagt noch „Rezeptbuch“; erster Challenge-Rundenwechsel am 01.12.2026 ansehen

Bei der Analyse aufgefallen:
- `README.md` steht noch auf „Stand Phase 12“ und beschreibt den Bereich Sport & Gesundheit gar nicht
- Kommentar in `nav-items.ts` nennt das Lexikon noch „Platzhalter“, obwohl es fertig ist
- Ein reines Dehntraining zählt im Kalender als Kraft-Training (bewusst offen gelassen)
