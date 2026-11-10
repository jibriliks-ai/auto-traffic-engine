import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { submitToIndexNow, submitBatchToIndexNow } from "@/lib/seo/indexNow";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/seo/indexnow-test
 * Body: { url?: string, urls?: string[], force?: boolean }
 *
 * Admin-only endpoint for testing IndexNow submissions without
 * creating real content. Use force:true to bypass the 24h dedup.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const isAdmin = (session?.user as any)?.isAdmin === true;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const url = String(body.url ?? "").trim();
  const urls = Array.isArray(body.urls) ? body.urls.map(String) : null;
  const force = Boolean(body.force);

  if (urls && urls.length > 0) {
    const result = await submitBatchToIndexNow(urls);
    return NextResponse.json({ mode: "batch", count: urls.length, result });
  }

  if (!url) {
    return NextResponse.json(
      { error: "Provide url or urls[]" },
      { status: 400 }
    );
  }

  const result = await submitToIndexNow(url, { force });
  return NextResponse.json({ mode: "single", result });
}

