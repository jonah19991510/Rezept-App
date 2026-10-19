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
- Nach dem Löschen von A sind Profil, Rezepte und Favoriten von A weg, und auch der Wochenplan-Eintrag
  von B, der auf A's öffentliches Rezept zeigte.

Letzter Lauf: 18.10.2026, alle Werte wie erwartet.

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
6. **noindex:** <http://localhost:3000/robots.txt> zeigt `Disallow: /`. In den Entwicklertools
   (Netzwerk → Dokument → Antwort-Header) steht `X-Robots-Tag: noindex, nofollow`, im HTML
   `<meta name="robots" content="noindex, nofollow">`.
