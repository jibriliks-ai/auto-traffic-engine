import { NextResponse } from "next/server";
import { syncAll } from "@/lib/money-engine/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * External cron endpoint (Render Cron Job or cron-job.org).
 * Auth via ?secret=<CRON_SECRET>.
 *
 * Setup (Render — no Vercel):
 *   A) Render → Cron Jobs (paid): command =
 *      curl -fsS "https://growthbot-aprv.onrender.com/api/money-engine/cron?secret=$CRON_SECRET"
 *      schedule = 0 * /6 * * *   (every 6h — remove the spaces around / in real cron)
 *   B) cron-job.org (free): HTTP job → same URL, every 6h, method GET
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAll();
    return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Sync failed" }, { status: 500 });
  }
}