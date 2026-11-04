import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FREE_LIMIT = 2;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;
  const plan = (session.user as any).plan ?? "free";

  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const [used, recent, indexnowKey, googleRaw] = await Promise.all([
    prisma.submission.count({
      where: { userId, type: "indexer", createdAt: { gte: since } },
    }),
    prisma.submission.findMany({
      where: { userId, type: "indexer" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    Promise.resolve(process.env.INDEXNOW_KEY ?? null),
    Promise.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? null),
  ]);

  const limit = plan === "premium" ? null : FREE_LIMIT;
  const remaining = limit === null ? null : Math.max(0, limit - used);

  let googleConfigured = false;
  let googleError: string | null = null;
  if (googleRaw) {
    try {
      const parsed = JSON.parse(googleRaw);
      if (parsed.client_email && parsed.private_key) googleConfigured = true;
      else googleError = "Missing client_email or private_key";
    } catch {
      googleError = "Invalid JSON";
    }
  }

  return NextResponse.json({
    plan,
    indexnow: { keySet: !!indexnowKey, key: indexnowKey },
    google: { configured: googleConfigured, error: googleError },
    usage: { used, limit, remaining },
    recent,
  });
}