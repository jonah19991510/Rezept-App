import { timingSafeEqual } from "node:crypto";
import { createAnonClient } from "@/lib/supabase/anon";

// Keep-alive (21.10.2026): Supabase pausiert Projekte im kostenlosen Plan nach einer Woche ohne Aktivität.
// Ein Vercel-Cron (vercel.json, einmal täglich) ruft diese Adresse auf; sie stellt eine winzige Leseanfrage
// an die Datenbank (eine Zeile aus app_config, die ohnehin öffentlich lesbar ist). Es werden keine Daten verändert.
// Ist CRON_SECRET gesetzt (Vercel → Settings → Environment Variables), schickt Vercel es als
// „Authorization: Bearer …“ mit; dann antworten fremde Aufrufe mit 401.

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false }, { status: 401 });

  const started = Date.now();
  const { error } = await createAnonClient().from("app_config").select("key").limit(1);
  const body = { ok: !error, ms: Date.now() - started, at: new Date().toISOString() };
  return Response.json(body, {
    status: error ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
