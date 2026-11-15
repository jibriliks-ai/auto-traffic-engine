import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron entry — hit every hour by cron-job.org:
 *   https://growthbot-aprv.onrender.com/api/money-engine/autopilot/cron?secret=<CRON_SECRET>
 *
 * For each user with autopilot enabled:
 *   1. Check if current UTC hour is in their postHours list
 *   2. If yes → run autopilot for that user
 *   3. Return summary
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentHour = new Date().getUTCHours();

  // Find all users with autopilot enabled
  const allSettings = await prisma.autoPilotSettings.findMany({
    where: { isEnabled: true },
    select: { userId: true, postHours: true },
  });

  // Filter to those whose scheduled hour matches now
  const dueUsers = allSettings.filter((s) => {
    try {
      const hours: number[] = JSON.parse(s.postHours);
      return hours.includes(currentHour);
    } catch {
      return false;
    }
  });

  const summary: any[] = [];
  for (const s of dueUsers) {
    try {
      // Import dynamically to avoid circular deps
      const { POST } = await import("@/app/api/money-engine/autopilot/run/route");
      // We need to call the internal function, but auth won't work in cron.
      // Instead, inline a call to the orchestrator via direct fetch won't work either.
      // Use the exported runner by requiring the module directly.
      // → Simplest: re-implement by calling the route's internal logic via a
      //   private helper. But since we can't easily do that, hit the route
      //   with the user's session is impossible.
      //
      // Solution: move the orchestrator to a lib file. For now, log and skip
      // — the /run route still works when the user triggers it manually.
      //
      // ──── To make cron fully work, we'd need to refactor runAutopilotForUser
      //     into src/lib/money-engine/autopilot.ts. The next message ships
      //     that refactor + the settings/history UI. For now, cron returns
      //     a stub so the endpoint is testable.
      summary.push({ userId: s.userId, status: "deferred", note: "Run via /run API for now" });
    } catch (e: any) {
      summary.push({ userId: s.userId, status: "error", error: e?.message });
    }
  }

  return NextResponse.json({
    ok: true,
    currentHourUTC: currentHour,
    dueUsersCount: dueUsers.length,
    summary,
  });
}