// src/app/api/qa/search/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkQALimit, recordQAActivity } from "@/lib/limits";
import { fetchQAPool } from "@/lib/qa-sources";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const plan = (session.user as any).plan ?? "free";

  const limit = await checkQALimit(userId, plan);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `You've used your ${limit.limit} free Q&A interactions for today. Upgrade to Premium for unlimited.`,
        usage: limit,
        upgradeRequired: true,
      },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const keyword = (body.keyword ?? "").toString().trim();
  const country = (body.country ?? "All").toString().trim() || "All";

  if (keyword.length < 2) {
    return NextResponse.json(
      { error: "Enter a keyword with at least 2 characters." },
      { status: 400 }
    );
  }

  try {
    const { items, failedSources, succeededSources } = await fetchQAPool(
      keyword,
      country
    );

    // Only count against the daily quota if we actually got results.
    if (items.length > 0) {
      await recordQAActivity(userId, "search", `${keyword} [${country}]`);
    }

    const updatedLimit = await checkQALimit(userId, plan);

    return NextResponse.json({
      results: items,
      usage: updatedLimit,
      failedSources,
      succeededSources,
      meta: {
        keyword,
        country,
        total: items.length,
        sourcesUsed: succeededSources,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Search failed. Please try again." },
      { status: 500 }
    );
  }
}