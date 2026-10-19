import { requireUser } from "@/lib/auth";
import { backupFileName } from "@/lib/domain/recipe-backup";
import { buildPersonalDataExport } from "@/lib/server/data-export";

/** „Meine Daten herunterladen“: alle eigenen Daten als JSON-Datei. */
export async function GET() {
  const user = await requireUser();
  const data = await buildPersonalDataExport(user);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${backupFileName("rezeptbuch-meine-daten", new Date())}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
