"use client";

import { useRef, useState, useTransition } from "react";
import { Download, FileUp, Loader2 } from "lucide-react";
import { FormMessage } from "@/components/forms/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { sportBackupFileSchema } from "@/lib/domain/sport-backup";
import { importSportBackupAction } from "./sport-backup-actions";

const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

/**
 * Einstellungen im Sport-Bereich: Trainingsdaten sichern, Sicherung einspielen und (showAllData) alle Daten
 * herunterladen; auf den Einstellungen für alle Bereiche steht dieser Knopf schon bei Essen & Trinken.
 */
export function SportDataSection({ showAllData }: { showAllData: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();
  const [pending, startTransition] = useTransition();

  async function importFile(file: File) {
    setMessage(undefined);
    if (file.size > MAX_BACKUP_BYTES) {
      setMessage({ text: "Die Datei ist zu groß (höchstens 10 MB).", ok: false });
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setMessage({ text: "Die Datei ist keine gültige JSON-Datei.", ok: false });
      return;
    }
    const parsed = sportBackupFileSchema.safeParse(json);
    if (!parsed.success) {
      setMessage({ text: parsed.error.issues[0]?.message ?? "Die Datei ist keine gültige Sport-Sicherung.", ok: false });
      return;
    }
    startTransition(async () => {
      const result = await importSportBackupAction(parsed.data);
      if (!result.ok) {
        setMessage({ text: result.message, ok: false });
        return;
      }
      const parts = [`${result.imported} ${result.imported === 1 ? "Plan" : "Pläne"} importiert`];
      if (result.skipped) parts.push(`${result.skipped} übersprungen (Name gibt es schon)`);
      if (result.importedWorkouts) parts.push(`${result.importedWorkouts} ${result.importedWorkouts === 1 ? "Training" : "Trainings"} importiert`);
      if (result.skippedWorkouts) parts.push(`${result.skippedWorkouts} Trainings übersprungen (gab es schon)`);
      if (result.createdExercises) parts.push(`${result.createdExercises} fehlende Übungen als eigene angelegt`);
      setMessage({ text: `${parts.join(", ")}.`, ok: true });
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {/* Normale Links: Der Browser lädt die Datei herunter */}
        <a href="/einstellungen/sport-sichern" download className={buttonVariants({ variant: "outline" })}>
          <Download aria-hidden />
          Trainingsdaten exportieren
        </a>
        <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <FileUp aria-hidden />}
          {pending ? "Wird importiert …" : "Trainingsdaten importieren"}
        </Button>
        {showAllData ? (
          <a href="/einstellungen/meine-daten" download className={buttonVariants({ variant: "outline" })}>
            <Download aria-hidden />
            Meine Daten herunterladen
          </a>
        ) : null}
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void importFile(file);
          }}
        />
      </div>
      <FormMessage message={message?.text} ok={message?.ok} />
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          <strong className="font-medium text-foreground">Exportieren</strong>: deine Trainingspläne (auch ausgeblendete),
          deine beendeten Trainings mit allen Sätzen und deine eigenen Übungen als Datei, die du hier wieder importieren
          kannst.
        </li>
        <li>
          <strong className="font-medium text-foreground">Importieren</strong> legt Pläne und Trainings zusätzlich an; Pläne
          mit vorhandenem Namen und Trainings mit derselben Startzeit werden übersprungen. Fehlende Übungen werden als eigene
          Übungen angelegt.
        </li>
        {showAllData ? (
          <li>
            <strong className="font-medium text-foreground">Meine Daten</strong>: alles, was die App über dich speichert,
            aus beiden Bereichen.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
