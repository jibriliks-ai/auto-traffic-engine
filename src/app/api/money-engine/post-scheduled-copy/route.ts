import { NextResponse } from "next/server";
import { postDueSalesCopy } from "@/lib/money-engine/autoPostSalesCopy";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron endpoint — hits every 30 min from cron-job.org.
 * URL: https://growthbot-aprv.onrender.com/api/money-engine/post-scheduled-copy?secret=<CRON_SECRET>
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await postDueSalesCopy();
    return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Post failed" },
      { status: 500 }
    );
  }
}