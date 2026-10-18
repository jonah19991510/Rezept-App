import type { Metadata } from "next";

export const metadata: Metadata = { title: "Datenschutz" };

// PLATZHALTER – vor dem Öffnen der Registrierung durch eine echte Datenschutzerklärung ersetzen.
// Grundlage dafür ist DATENVERARBEITUNG.md im Repository.
export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Datenschutzerklärung</h1>
      <p className="rounded-xl border-2 border-dashed border-destructive/50 bg-destructive/5 p-4 font-medium text-destructive">
        TODO: Platzhalter. Hier steht noch keine gültige Datenschutzerklärung.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>TODO: Verantwortliche Stelle</li>
        <li>TODO: Welche Daten wofür verarbeitet werden (siehe DATENVERARBEITUNG.md)</li>
        <li>TODO: Dienstleister (Supabase, Vercel, Open Food Facts) und Auftragsverarbeitung</li>
        <li>TODO: Speicherdauer, Rechte der Nutzer, Kontakt</li>
      </ul>
    </>
  );
}
