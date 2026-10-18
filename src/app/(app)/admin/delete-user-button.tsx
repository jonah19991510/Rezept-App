"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionState } from "@/lib/validation/form";
import { deleteUserAction } from "./actions";

export function DeleteUserButton({ userId, displayName }: { userId: string; displayName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await deleteUserAction(prev, formData);
    if (result.ok) {
      setOpen(false);
      toast.success(result.message);
    }
    return result;
  }, {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        <Trash2 aria-hidden />
        Löschen
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{displayName} löschen?</DialogTitle>
          <DialogDescription>
            Der Account und alle zugehörigen Daten werden endgültig gelöscht: Rezepte (auch veröffentlichte), Fotos,
            Wochenpläne, Einkaufslisten und alles Weitere. Das lässt sich nicht rückgängig machen.
          </DialogDescription>
        </DialogHeader>
        {!state.ok ? <FormMessage message={state.message} /> : null}
        <form action={formAction}>
          <input type="hidden" name="userId" value={userId} />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Wird gelöscht …" : "Endgültig löschen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
