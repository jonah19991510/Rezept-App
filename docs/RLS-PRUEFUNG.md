# Prüfanleitung: Rechte und Datenschutz

Zwei Teile: ein automatischer SQL-Test für die Datenbank und eine kurze Prüfung in der App.

## 1. Automatischer Datenbank-Test

[`supabase/tests/rls_check.sql`](../supabase/tests/rls_check.sql) im Supabase **SQL Editor** ausführen.

Das Skript legt zwei Testnutzer A und B an, lässt B versuchen, auf Daten von A zuzugreifen, prüft
Rollenschutz, Makro-View und Account-Löschung und **bricht am Ende absichtlich ab**. Dadurch wird alles
zurückgerollt; es bleiben keine Testdaten übrig. Das Ergebnis steht in der Fehlermeldung
`TESTERGEBNIS …`. Die erwarteten Werte stehen oben im Skript.

Geprüft wird unter anderem:

- B sieht nur öffentliche Rezepte von A, keine privaten (auch nicht deren Zutaten oder Makros).
- B kann Rezepte von A weder ändern noch löschen, keine Zutaten hinzufügen und keine Rezepte in A's Namen anlegen.
- B sieht keine Favoriten (bzw. Wochenpläne, Einkaufslisten …) von A.
- B kann seine eigene `role` nicht ändern (Fehler `42501`), aber seinen Anzeigenamen.
- B kann ein privates Rezept von A nicht in seinen Wochenplan legen.
- Community (Phase 6): B übernimmt A's öffentliches Rezept als private Kopie (Owner B, mit `forked_from_id`),
  kann A's privates Rezept nicht übernehmen und A's Rezept nicht auf privat stellen; A sieht B's Kopie nicht;
  `profiles` hat keine E-Mail-Spalte. Macht A das Rezept wieder privat, sieht B es nicht mehr, sein
  Plan-Eintrag bleibt, „Woche kopieren“ überspringt ihn ohne Fehler, B's Kopie bleibt.
- Fotos (Phase 7): B sieht im Storage das Foto von A's öffentlichem Rezept, nicht das des privaten; B kann weder in
  A's Ordner noch für A's Rezept hochladen und kein fremdes Foto an sein Rezept hängen (Check-Constraint, `23514`).
  Löschen geht ohnehin nur über die Storage-API, und dort nur im eigenen Ordner.
- Nach dem Löschen von A sind Profil, Rezepte und Favoriten von A weg, und auch der Wochenplan-Eintrag
  von B, der auf A's öffentliches Rezept zeigte. B's Kopie bleibt (Verweis auf das Original leer).

Letzter Lauf: 19.10.2026 (Phase 7, Storage-Teil einzeln), alle Werte wie erwartet.

**Bar (Phase 15):** [`supabase/tests/bar_check.sql`](../supabase/tests/bar_check.sql) genauso ausführen (rollt sich
ebenfalls selbst zurück). Geprüft: Cocktail speichern mit Glas/Methode/Eis/Garnitur, Alkoholgehalt der View
`recipe_alcohol` (Daiquiri geshaked 17,5 % vol, 18,9 g), neue Version beim Methodenwechsel, Aufrufe ohne Typ (ältere
App-Version, Wiederherstellen) lassen Typ und Cocktail-Felder stehen, Gerichte bekommen keine Cocktail-Felder,
B sieht weder `cocktail_details` noch `recipe_alcohol` von A's privatem Cocktail, ohne Login liest
`recipe_alcohol` niemand (`anon` ohne Recht), die geteilte Karte liefert Cocktail-Felder und Alkoholgehalt, nach dem
Löschen von A ist alles weg. Letzter Lauf: 20.10.2026, alle Werte wie erwartet.

**Zutaten bearbeiten und löschen:** [`supabase/tests/ingredient_edit_check.sql`](../supabase/tests/ingredient_edit_check.sql)
(Gramm-Neuberechnung, nur eigene selbst erstellte Zutaten änderbar) und
[`supabase/tests/ingredient_delete_check.sql`](../supabase/tests/ingredient_delete_check.sql) (zwei Blöcke einzeln
ausführen: Löschen nur eigener Zutaten, gesperrt bei Nutzung in Rezepten oder bei anderen im Vorrat/mit Preis).
Letzter Lauf: 20.10.2026, alle Werte wie erwartet.

## 2. Prüfung in der App

Du brauchst zwei Accounts (dein Admin-Account und einen eingeladenen Test-Account) und zwei Browser
(oder ein normales und ein privates Fenster).

> **Achtung beim Einladungslink:** Ein Browser kann pro Seite nur mit einem Account angemeldet sein. Klickst
> du den Link in einer Mail, die im selben Browser offen ist wie dein Admin-Account, öffnet er sich dort und
> meldet dich als Test-Account an. Dein Admin-Tab zeigt danach auch „Seite nicht gefunden“. Besser: Rechtsklick
> auf den Link → „Link-Adresse kopieren“ und im privaten Fenster einfügen.

1. **Admin-Seite gesperrt:** Mit dem Test-Account <http://localhost:3000/admin> öffnen → „Seite nicht
   gefunden“. Im Profilmenü gibt es keinen Punkt „Nutzerverwaltung“.
2. **Login-Pflicht:** Abgemeldet <http://localhost:3000/wochenplan> öffnen → Weiterleitung zum Login.
   Nach dem Anmelden landest du wieder auf dem Wochenplan.
3. **Keine Registrierung:** Bei `SIGNUP_MODE=invite` zeigt die Login-Seite keinen „Registrieren“-Knopf,
   und <http://localhost:3000/registrieren> gibt „Seite nicht gefunden“.
4. **Rolle nicht änderbar:** (für Neugierige) Im Test-Account in den Browser-Entwicklertools ist kein
   Weg vorgesehen; der Datenbank-Test oben deckt den Angriff über die API ab.
5. **Account löschen (Admin):** In der Nutzerverwaltung den Test-Account löschen. Danach im SQL-Editor:

   ```sql
   select count(*) from auth.users where email = 'test@…';
   select count(*) from public.profiles where display_name = 'Name des Test-Accounts';
   ```

   Beides muss `0` sein. (Ab Phase 7 zusätzlich: Storage → `recipe-photos` → kein Ordner mit der ID.)
6. **Veröffentlichen (Phase 6):** Admin macht ein Rezept öffentlich → Test-Account sieht es unter „Entdecken“ mit
   dem Anzeigenamen, nirgends eine E-Mail. Admin stellt es wieder auf privat → Test-Account bekommt beim direkten
   Aufruf der Rezept-Adresse „Seite nicht gefunden“, im Wochenplan steht „Rezept nicht mehr verfügbar“.
7. **Fotos (Phase 7):** Admin lädt ein Foto zu einem privaten Rezept hoch und kopiert die Bildadresse (Rechtsklick →
   „Bildadresse kopieren“, `/foto/…`). Im privaten Fenster mit dem Test-Account geöffnet → „Nicht gefunden“;
   abgemeldet → Login-Seite. Nach dem Veröffentlichen sieht der Test-Account das Foto.
8. **Account löschen selbst (Phase 8):** Mit dem Test-Account in den Einstellungen „Meine Daten herunterladen“
   (Datei enthält nur eigene Daten), dann „Account löschen“ → Anzeigenamen eintippen → Login-Seite mit Hinweis.
   Danach im SQL-Editor wie in Punkt 5 prüfen, zusätzlich Storage → `recipe-photos` → kein Ordner mit der ID.
   Der einzige Admin bekommt beim Löschen einen Hinweis statt einer Löschung.
9. **noindex:** <http://localhost:3000/robots.txt> zeigt `Disallow: /`. In den Entwicklertools
   (Netzwerk → Dokument → Antwort-Header) steht `X-Robots-Tag: noindex, nofollow`, im HTML
   `<meta name="robots" content="noindex, nofollow">`. Ab Phase 14 dürfen nur Vorschau-Bots der Messenger
   zusätzlich `/r/` lesen (eigener Block in robots.txt); auch dort steht noindex.
10. **Teilen per Link (Phase 14):** Admin öffnet ein **privates** Rezept → „Teilen per Link“ → „Link erstellen“ →
   Link kopieren. Im privaten Fenster **abgemeldet** öffnen: Rezeptkarte mit Foto, Anzeigename, keine E-Mail;
   Knopf „Anmelden zum Übernehmen“. Mit dem Test-Account angemeldet: „In mein Rezeptbuch übernehmen“ → private
   Kopie mit Foto. Dann beim Admin „Widerrufen“ → der alte Link zeigt „Link ungültig“, `…/foto` und `…/bild`
   antworten mit „Nicht gefunden“; die Kopie des Test-Accounts bleibt. Im SQL-Editor als Gegenprobe:

   ```sql
   -- ohne gültigen Token kommt nichts zurück
   select public.get_shared_recipe('AAAAAAAAAAAAAAAAAAAAAA');
   ```
11. **Bar (Phase 15):** Admin legt unter Rezepte → „Bar“ einen **privaten** Cocktail an. Der Test-Account sieht ihn
   weder unter Rezepte → Bar noch unter Entdecken → Bar; die Adresse `/rezepte/<id>` zeigt „Seite nicht gefunden“.
   Nach „Öffentlich“ erscheint er bei Entdecken → Bar mit Anzeigenamen; „In mein Rezeptbuch übernehmen“ legt eine
   private Kopie (wieder als Cocktail) an. Der Bar-Bestand im Vorrat und „Was kann ich mixen?“ zeigen nur eigene
   Einträge. „Meine Daten herunterladen“ enthält den Cocktail bei `rezepte` (mit `cocktail_details`) und den
   Bar-Bestand bei `vorrat` (`location: bar`); nach „Account löschen“ wie in Punkt 5 prüfen, zusätzlich:

   ```sql
   select count(*) from public.cocktail_details cd
   left join public.recipes r on r.id = cd.recipe_id where r.id is null; -- 0
   ```
