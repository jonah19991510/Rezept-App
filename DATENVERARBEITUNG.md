# Datenverarbeitung

Übersicht, welche personenbezogenen Daten die App wo speichert, wofür und welche Dienstleister beteiligt
sind. Grundlage für eine spätere Datenschutzerklärung. **Kein Rechtstext.** Wird mit jeder Phase
aktualisiert.

Letzte Aktualisierung: Phase 1 (18.10.2026)

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

### Inhalte der Nutzer (angelegt in Phase 1, genutzt ab den genannten Phasen)

Alle Zeilen hängen über `user_id` bzw. `owner_id` am Nutzer und werden beim Löschen des Accounts per
`ON DELETE CASCADE` mitgelöscht.

| Tabelle | Inhalt | Ab Phase | Sichtbar für |
|---|---|---|---|
| `recipes` (+ `recipe_ingredients`, `recipe_steps`, `cocktail_details`) | Rezepte, optional Quell-URL | 2 | nur Owner; bei `is_public` alle eingeloggten Nutzer (mit Anzeigename) |
| `recipe_versions` | frühere Fassungen eines Rezepts | 12 | nur Owner |
| `meal_plan_entries`, `meal_prep_batches`, `plan_days` | Wochenplan, Meal Prep, Trainingstage | 3 / 11 | nur Nutzer selbst |
| `user_goals` | Tagesziele kcal/Protein/KH/Fett | 3 / 11 | nur Nutzer selbst |
| `user_settings` | Standard-Trainingstage, Einkaufs-Sortierung, Präferenzen | 1 (leer angelegt) | nur Nutzer selbst |
| `shopping_list_items` | Einkaufsliste | 4 | nur Nutzer selbst |
| `pantry_items` | Vorrat (Küche/Bar), Ablaufdatum | 10 | nur Nutzer selbst |
| `ingredient_prices` | Preise, optional Laden | 12 | nur Nutzer selbst |
| `cook_logs` | Kochdatum, Bewertung, Notiz | 12 | nur Nutzer selbst |
| `favorites` | Lieblingsrezepte | 2 | nur Nutzer selbst |
| `ingredients` (Spalte `created_by`) | selbst angelegte Zutaten | 2 | Zutaten sind global für alle lesbar; `created_by` wird beim Löschen auf leer gesetzt |
| Storage-Bucket `recipe-photos/<user-id>/…` | Rezeptfotos, vor dem Upload ohne EXIF/GPS | 7 | wie das Rezept |

**Hinweis:** Tagesziele, Trainingstage und Essenspläne können Rückschlüsse auf Gesundheit und
Lebensgewohnheiten zulassen. Das sollte die spätere Datenschutzerklärung ausdrücklich erwähnen.

### Nicht personenbezogen

- `ingredients` aus dem Grundbestand (`source = seed`) und `app_config` (Schwellenwerte).

## Dienstleister

| Dienst | Rolle | Ort | Was dort landet |
|---|---|---|---|
| **Supabase** (Supabase Inc.) | Datenbank, Auth, Storage, Standard-Mailversand | Projekt in Frankfurt (AWS `eu-central-1`) | alle oben genannten Daten, Auth-Logs, Einladungs-/Passwort-Mails |
| **Vercel** (Vercel Inc.) | Hosting der App ab Phase 8 | Functions in Frankfurt (`fra1`), statische Dateien über weltweites CDN | Request-Logs (u. a. IP-Adresse, URL), keine Analytics |
| **Open Food Facts** (gemeinnützig) | Nährwert-Datenbank ab Phase 2 | – | nur Suchbegriffe, serverseitig abgefragt, **keine** Nutzerdaten |
| Webseiten beim Link-Import (Phase 7) | Rezept-Quellen | – | serverseitiger Abruf der URL, **keine** Nutzerdaten |

## Rechte der Nutzer

- **Löschen:** Der Admin kann Accounts über die Nutzerverwaltung löschen. Dabei werden zuerst die Fotos
  im Storage gelöscht, dann der Auth-User; alle Tabellen folgen per Cascade, auch veröffentlichte Rezepte.
  „Account löschen“ für Nutzer selbst kommt in Phase 8.
- **Export:** „Meine Daten herunterladen“ (JSON) kommt in Phase 8.

## Checkliste „Vor dem Öffnen der Registrierung“

- [ ] Impressum fertig (`/impressum`, aktuell Platzhalter)
- [ ] Datenschutzerklärung fertig (`/datenschutz`, aktuell Platzhalter), auf Basis dieser Datei
- [ ] Auftragsverarbeitungsvertrag (DPA) mit **Supabase** abgeschlossen
- [ ] Auftragsverarbeitungsvertrag (DPA) mit **Vercel** abgeschlossen
- [ ] Eigener SMTP-Dienst für E-Mails in Supabase eingerichtet (Authentication → Emails → SMTP Settings),
      der Standardversand ist stark limitiert
- [ ] `SIGNUP_MODE=open` in Vercel gesetzt und neu deployt
- [ ] Freie Registrierung in Supabase wieder aktiviert (Authentication → Sign In / Providers → „Allow new users to sign up“)
- [ ] Vorlage „Confirm signup“ angepasst (README, Schritt 4)
- [ ] noindex-Regeln bewusst überprüft (robots.txt, Meta-Tag, `X-Robots-Tag`): sollen sie bleiben?

## Änderungsverlauf

- **Phase 1:** Schema für alle Tabellen mit RLS und Cascade, Supabase Auth mit Einladung, Admin-Nutzerliste
  (E-Mail nur für Admin), Theme-Wahl im `localStorage`, noindex.
