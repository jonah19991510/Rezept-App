"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Download, FileDown, FileText, FileUp, Loader2, Trash2 } from "lucide-react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { backupFileSchema } from "@/lib/domain/recipe-backup";
import { changePasswordSchema, deleteAccountSchema, displayNameFormSchema } from "@/lib/validation/account";
import {
  changePasswordAction,
  deleteAccountAction,
  importRecipeBackupAction,
  updateDisplayNameAction,
} from "./account-actions";

const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export function DisplayNameForm({ current }: { current: string }) {
  const { state, formAction, pending, errors, onSubmit } = useValidatedAction(displayNameFormSchema, updateDisplayNameAction);
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-3 sm:max-w-md">
      <FormField
        label="Anzeigename"
        name="displayName"
        autoComplete="nickname"
        defaultValue={current}
        maxLength={50}
        required
        hint="So sehen dich andere, z. B. bei veröffentlichten Rezepten."
        errors={errors.displayName}
      />
      <FormMessage message={state.message} ok={state.ok} />
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Wird gespeichert …" : "Namen speichern"}
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { state, formAction, pending, errors, onSubmit } = useValidatedAction(changePasswordSchema, async (prev, data) => {
    const result = await changePasswordAction(prev, data);
    if (result.ok) formRef.current?.reset();
    return result;
  });
  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} noValidate className="grid gap-3 sm:max-w-md">
      <FormField
        label="Neues Passwort"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Mindestens 8 Zeichen."
        errors={errors.password}
      />
      <FormField
        label="Neues Passwort wiederholen"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        errors={errors.passwordConfirm}
      />
      <FormMessage message={state.message} ok={state.ok} />
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Wird gespeichert …" : "Passwort ändern"}
        </Button>
      </div>
    </form>
  );
}

/** Downloads (alle Daten, Rezept-Sicherung) und Import einer Sicherung. */
export function DataSection() {
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
    const parsed = backupFileSchema.safeParse(json);
    if (!parsed.success) {
      setMessage({ text: parsed.error.issues[0]?.message ?? "Die Datei ist keine gültige Sicherung.", ok: false });
      return;
    }
    startTransition(async () => {
      const result = await importRecipeBackupAction(parsed.data);
      if (!result.ok) {
        setMessage({ text: result.message, ok: false });
        return;
      }
      const parts = [`${result.imported} ${result.imported === 1 ? "Rezept" : "Rezepte"} importiert`];
      if (result.skipped) parts.push(`${result.skipped} übersprungen`);
      if (result.createdIngredients) parts.push(`${result.createdIngredients} fehlende Zutaten neu angelegt`);
      setMessage({ text: `${parts.join(", ")}. Sie stehen als private Rezepte in deinem Buch.`, ok: true });
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {/* Rezepte von Webseiten oder aus Markdown/Notion (früher als Knopf über der Rezeptliste) */}
        <Link href="/rezepte/import" className={buttonVariants({ variant: "outline" })}>
          <FileDown aria-hidden />
          Rezepte importieren
        </Link>
        {/* Normale Links: Der Browser lädt die Datei herunter */}
        <a href="/einstellungen/meine-daten" download className={buttonVariants({ variant: "outline" })}>
          <Download aria-hidden />
          Meine Daten herunterladen
        </a>
        <a href="/einstellungen/rezepte-sichern" download className={buttonVariants({ variant: "outline" })}>
          <Download aria-hidden />
          Rezepte sichern
        </a>
        <a href="/einstellungen/rezepte-markdown" download className={buttonVariants({ variant: "outline" })}>
          <FileText aria-hidden />
          Rezeptbuch als Markdown
        </a>
        <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <FileUp aria-hidden />}
          {pending ? "Wird importiert …" : "Sicherung importieren"}
        </Button>
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
          <strong className="font-medium text-foreground">Meine Daten</strong>: alles, was die App über dich speichert
          (Profil, Rezepte und Cocktails mit Versionen, Wochenpläne, Ziele, Einkaufsliste, Vorrat mit Bar, Preise,
          Koch-Log, Favoriten, Liste deiner Fotos, Trainingspläne und eigene Übungen).
        </li>
        <li>
          <strong className="font-medium text-foreground">Rezepte sichern</strong>: deine Rezepte und Cocktails in einem
          Format, das du hier wieder importieren kannst. Ältere Sicherungen (nur Rezepte) gehen weiterhin. Fotos sind
          nicht enthalten.
        </li>
        <li>
          <strong className="font-medium text-foreground">Rezeptbuch als Markdown</strong>: alle Rezepte und Cocktails als
          lesbare .md-Datei mit Inhaltsverzeichnis, z. B. für Obsidian oder zum Ausdrucken. Ein einzelnes Rezept gibt es auf der
          Rezeptseite unter „⋮“ → „Als Markdown“.
        </li>
        <li>
          <strong className="font-medium text-foreground">Importieren</strong> legt die Rezepte zusätzlich an (privat),
          vorhandene bleiben unverändert.
        </li>
      </ul>
    </div>
  );
}

export function DeleteAccount({ displayName }: { displayName: string }) {
  const [open, setOpen] = useState(false);
  const { state, formAction, pending, errors, onSubmit } = useValidatedAction(deleteAccountSchema, deleteAccountAction);

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        Account löschen
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Account wirklich löschen?</DialogTitle>
              <DialogDescription>
                Das löscht deinen Zugang und alle deine Daten endgültig: Rezepte (auch veröffentlichte), Fotos,
                Wochenpläne, Einkaufsliste, Ziele und Favoriten. Kopien, die andere von deinen Rezepten übernommen
                haben, bleiben bei ihnen. Lade vorher bei Bedarf deine Daten herunter.
              </DialogDescription>
            </DialogHeader>
            <FormField
              label={`Zur Bestätigung „${displayName}“ eintippen`}
              name="confirmName"
              autoComplete="off"
              required
              errors={errors.confirmName}
            />
            <FormMessage message={state.message} ok={state.ok} />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Wird gelöscht …" : "Endgültig löschen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
