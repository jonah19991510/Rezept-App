import type { Metadata } from "next";

export const metadata: Metadata = { title: "Impressum" };

// PLATZHALTER – vor dem Öffnen der Registrierung durch einen echten Text ersetzen
// (Checkliste in DATENVERARBEITUNG.md).
export default function ImprintPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Impressum</h1>
      <p className="rounded-xl border-2 border-dashed border-destructive/50 bg-destructive/5 p-4 font-medium text-destructive">
        TODO: Platzhalter. Hier steht noch kein gültiges Impressum.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>TODO: Name und ladungsfähige Anschrift der verantwortlichen Person</li>
        <li>TODO: Kontakt (E-Mail-Adresse)</li>
        <li>TODO: ggf. weitere Pflichtangaben prüfen lassen</li>
      </ul>
    </>
  );
}
