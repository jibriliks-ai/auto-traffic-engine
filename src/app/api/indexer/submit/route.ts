import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitToIndexNow } from "@/lib/indexnow";
import { submitToGoogle } from "@/lib/google-indexing";

export const runtime = "nodejs";
export const maxDuration = 60;

const FREE_LIMIT = 2;

export async function POST(req: Request) {
  try {
    // 1. Auth
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Not signed in. Refresh and log in again." }, { status: 401 });
    }
    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: "Session has no user id. Log out and log back in." }, { status: 401 });
    }
    const plan = (session.user as any).plan ?? "free";

    // 2. Parse body
    const body = await req.json().catch(() => ({}));
    const urls: string[] = Array.isArray(body.urls)
      ? body.urls.filter((u: any) => typeof u === "string" && u.trim()).map((u: string) => u.trim())
      : [];
    const engines: string[] = Array.isArray(body.engines) ? body.engines : [];

    console.log(`[indexer/submit] user=${userId} urls=${urls.length} engines=${engines.join(",")}`);

    if (urls.length === 0) {
      return NextResponse.json({ error: "At least one URL is required." }, { status: 400 });
    }
    if (engines.length === 0) {
      return NextResponse.json({ error: "Select at least one engine." }, { status: 400 });
    }

    // 3. Validate URLs
    for (const u of urls) {
      try {
        const parsed = new URL(u);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return NextResponse.json({ error: `Only http/https URLs supported: ${u}` }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: `Invalid URL: ${u}` }, { status: 400 });
      }
    }

    // 4. Free-tier limit
    if (plan !== "premium") {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const usedToday = await prisma.submission.count({
        where: { userId, type: "indexer", createdAt: { gte: since } },
      });
      const remaining = Math.max(0, FREE_LIMIT - usedToday);
      if (urls.length > remaining) {
        return NextResponse.json(
          {
            error:
              remaining === 0
                ? "Daily limit reached. Upgrade to Premium for unlimited submissions."
                : `You have ${remaining} submission${remaining === 1 ? "" : "s"} left today. Reduce your URL list or upgrade to Premium.`,
            usage: { used: usedToday, limit: FREE_LIMIT, remaining },
          },
          { status: 429 }
        );
      }
    }

    // 5. Submit to selected engines
    const response: any = {};

    if (engines.includes("indexnow")) {
      try {
        console.log(`[indexer/submit] Calling IndexNow for ${urls.length} URL(s)`);
        response.indexnow = await submitToIndexNow(urls);
        console.log(`[indexer/submit] IndexNow result:`, response.indexnow);
      } catch (e: any) {
        console.error(`[indexer/submit] IndexNow error:`, e);
        response.indexnow = { ok: false, status: 0, detail: e.message ?? "IndexNow error" };
      }
    }

    if (engines.includes("google")) {
      try {
        console.log(`[indexer/submit] Calling Google Indexing for ${urls.length} URL(s)`);
        response.google = await submitToGoogle(urls);
      } catch (e: any) {
        console.error(`[indexer/submit] Google error:`, e);
        response.google = [{ url: "*", ok: false, status: 0, detail: e.message ?? "Google error" }];
      }
    }

    // 6. Save successful submissions
    const successful = new Map<string, string[]>();
    if (response.indexnow?.ok) {
      for (const u of urls) {
        const list = successful.get(u) ?? [];
        list.push("IndexNow");
        successful.set(u, list);
      }
    }
    if (Array.isArray(response.google)) {
      for (const r of response.google) {
        if (r.ok && r.url !== "*") {
          const list = successful.get(r.url) ?? [];
          list.push("Google");
          successful.set(r.url, list);
        }
      }
    }

    if (successful.size > 0) {
      try {
        await prisma.submission.createMany({
          data: Array.from(successful.entries()).map(([url, platforms]) => ({
            userId,
            type: "indexer",
            platform: platforms.join(" + "),
            url,
            submittedUrl: url,
            status: "submitted",
          })),
        });
        response.saved = successful.size;
      } catch (e: any) {
        console.error(`[indexer/submit] DB save failed:`, e);
        response.saved = 0;
        response.saveError = e.message ?? "Could not record submission";
      }
    } else {
      response.saved = 0;
    }

    return NextResponse.json(response);
  } catch (e: any) {
    console.error(`[indexer/submit] Unhandled:`, e);
    return NextResponse.json(
      { error: `Server error: ${e.message ?? String(e)}` },
      { status: 500 }
    );
  }
}