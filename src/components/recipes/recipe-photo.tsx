"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, CookingPot, Loader2, Martini, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { preparePhotoUploadAction, removeRecipePhotoAction, setRecipePhotoAction } from "@/app/(app)/rezepte/photo-actions";
import { checkPhotoFile, photoUrl } from "@/lib/domain/photo";
import { compressPhoto } from "@/lib/photo-compress";
import { RECIPE_PHOTO_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Status = "idle" | "compressing" | "uploading";

const STATUS_TEXT: Record<Exclude<Status, "idle">, string> = {
  compressing: "Foto wird verkleinert …",
  uploading: "Foto wird hochgeladen …",
};

/** Runder Knopf auf dem Foto (Kamera, Entfernen) */
const photoButtonClass =
  "grid size-11 place-items-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60 [&_svg]:size-5";

/**
 * Foto auf der Rezeptseite; ohne Foto ein Platzhalter mit Topf bzw. Glas. Der Owner kann es über den runden
 * Kamera-Knopf hinzufügen oder ändern und es entfernen.
 */
export function RecipePhoto({
  recipeId,
  imagePath,
  title,
  isOwner,
  cocktail = false,
}: {
  recipeId: string;
  imagePath: string | null;
  title: string;
  isOwner: boolean;
  cocktail?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();

  // Vorschau-URL wieder freigeben
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function upload(file: File) {
    const problem = checkPhotoFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setStatus("compressing");
    let uploaded: string[] = [];
    const supabase = createClient();
    try {
      const photo = await compressPhoto(file);
      setPreview(URL.createObjectURL(photo.full));
      setStatus("uploading");

      const target = await preparePhotoUploadAction({ recipeId, ext: photo.ext });
      if (!target.ok) throw new Error(target.message);

      const bucket = supabase.storage.from(RECIPE_PHOTO_BUCKET);
      const options = { contentType: photo.contentType, cacheControl: "31536000", upsert: false };
      const [full, thumb] = await Promise.all([
        bucket.upload(target.full, photo.full, options),
        bucket.upload(target.thumb, photo.thumb, options),
      ]);
      uploaded = [full.data?.path, thumb.data?.path].filter((p): p is string => Boolean(p));
      if (full.error || thumb.error) throw new Error("Das Hochladen hat nicht geklappt. Bitte noch einmal versuchen.");

      const saved = await setRecipePhotoAction({ recipeId, path: target.full });
      if (!saved.ok) throw new Error(saved.message);
      uploaded = [];
      toast.success("Foto gespeichert.");
      router.refresh();
    } catch (e) {
      // Halb hochgeladene Dateien wieder entfernen
      if (uploaded.length) await supabase.storage.from(RECIPE_PHOTO_BUCKET).remove(uploaded);
      setPreview(null);
      toast.error(
        e instanceof Error && e.message && !e.message.includes("decode")
          ? e.message
          : "Das Foto konnte nicht gelesen werden. Bitte ein JPG oder PNG wählen.",
      );
    } finally {
      setStatus("idle");
    }
  }

  function remove() {
    startRemove(async () => {
      const result = await removeRecipePhotoAction({ recipeId });
      if (result.ok) {
        setPreview(null);
        toast.success("Foto entfernt.");
        router.refresh();
      } else toast.error(result.message);
    });
  }

  const busy = status !== "idle" || removing;
  const src = preview ?? (imagePath ? photoUrl(imagePath) : null);

  const fileInput = isOwner ? (
    <input
      ref={input}
      type="file"
      accept="image/*"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // dieselbe Datei erneut wählbar
        if (file) void upload(file);
      }}
    />
  ) : null;

  if (!src) {
    const Placeholder = cocktail ? Martini : CookingPot;
    return (
      <div className="relative grid aspect-[3/2] place-items-center overflow-hidden rounded-3xl border bg-muted sm:aspect-[16/9]">
        <Placeholder className="size-16 text-muted-foreground/50" strokeWidth={1.25} aria-hidden />
        {isOwner ? (
          <>
            {fileInput}
            <span className="absolute bottom-4 left-4 font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase" aria-live="polite">
              {busy ? STATUS_TEXT[status as Exclude<Status, "idle">] : "Foto hinzufügen"}
            </span>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              aria-label="Foto hinzufügen (wird verkleinert, Standort und Kameradaten werden entfernt)"
              className={cn(photoButtonClass, "absolute right-3 bottom-3")}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
            </button>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <figure className="relative overflow-hidden rounded-3xl border bg-muted shadow-sm shadow-foreground/5">
      <div className="relative aspect-[3/2] sm:aspect-[16/9]">
        <Image
          src={src}
          alt={`Foto: ${title}`}
          fill
          unoptimized // Fotos sind schon verkleinert und kommen aus der geschützten Route /foto
          sizes="(min-width: 1024px) 896px, 100vw"
          className={cn("object-cover transition-opacity", busy && "opacity-60")}
          priority
        />
      </div>
      {status !== "idle" ? (
        <figcaption
          role="status"
          className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-background/85 px-4 py-2 text-sm backdrop-blur"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {STATUS_TEXT[status]}
        </figcaption>
      ) : null}
      {isOwner && status === "idle" ? (
        <div className="absolute right-3 bottom-3 flex gap-2">
          {fileInput}
          <button type="button" onClick={remove} disabled={busy} aria-label="Foto entfernen" className={photoButtonClass}>
            <Trash2 aria-hidden />
          </button>
          <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label="Foto ändern" className={photoButtonClass}>
            <Camera aria-hidden />
          </button>
        </div>
      ) : null}
    </figure>
  );
}
