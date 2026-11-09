<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Funktionsübersicht aktuell halten

`docs/FUNKTIONEN.md` listet alle Funktionen der App nach Bereichen und Modulen (mit Routen). Sie muss immer zum Code
passen:

- **Bei jeder Änderung, die eine Funktion hinzufügt, verändert oder entfernt**, `docs/FUNKTIONEN.md` im selben Commit
  mit anpassen: passenden Bereich/Modul ergänzen, ändern oder streichen, die Zeile „Stand:“ oben auf das heutige Datum
  setzen, erledigte offene Punkte im Anhang entfernen und neue dort eintragen. Reine Bugfixes, Designänderungen ohne neue
  Bedienung und Refactorings brauchen keine Änderung.
- **Dem Nutzer danach kurz sagen, was sich in der Übersicht geändert hat**, z. B. „Funktionsübersicht: unter Sport →
  Getränke neu ‚Espresso-Mengen 30/60 ml‘; unter Einkauf geändert …; entfernt …“.
- Kommt ein ganz neuer Bereich oder ein neues Modul dazu, auch den Baum am Anfang der Datei und, wenn betroffen, die
  README nachziehen.
