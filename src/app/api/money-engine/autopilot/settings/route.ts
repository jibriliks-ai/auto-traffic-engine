import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const VALID_PLATFORMS = new Set(["lemmy", "threads", "pinterest"]);

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let settings = await prisma.autoPilotSettings.findUnique({
    where: { userId },
  });

  // Return defaults if none saved
  if (!settings) {
    return NextResponse.json({
      settings: {
        isEnabled: false,
        postHours: [8, 14, 20],
        platforms: ["lemmy", "threads", "pinterest"],
        lemmyCommunity: null,
        pinterestBoard: null,
        lastRunAt: null,
        lastRunStatus: null,
        lastRunError: null,
        totalPostsMade: 0,
      },
    });
  }

  return NextResponse.json({
    settings: {
      isEnabled: settings.isEnabled,
      postHours: JSON.parse(settings.postHours),
      platforms: JSON.parse(settings.platforms),
      lemmyCommunity: settings.lemmyCommunity,
      pinterestBoard: settings.pinterestBoard,
      lastRunAt: settings.lastRunAt,
      lastRunStatus: settings.lastRunStatus,
      lastRunError: settings.lastRunError,
      totalPostsMade: settings.totalPostsMade,
    },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const isEnabled = Boolean(body.isEnabled);
  const postHours: number[] = Array.isArray(body.postHours)
    ? body.postHours
        .map((h: any) => Number(h))
        .filter((h: number) => h >= 0 && h <= 23)
    : [8, 14, 20];
  const platforms: string[] = Array.isArray(body.platforms)
    ? body.platforms.filter((p: any) => VALID_PLATFORMS.has(p))
    : ["lemmy", "threads", "pinterest"];

  const lemmyCommunity = String(body.lemmyCommunity ?? "").trim() || null;
  const pinterestBoard = String(body.pinterestBoard ?? "").trim() || null;

  await prisma.autoPilotSettings.upsert({
    where: { userId },
    create: {
      userId,
      isEnabled,
      postHours: JSON.stringify(postHours),
      platforms: JSON.stringify(platforms),
      lemmyCommunity,
      pinterestBoard,
    },
    update: {
      isEnabled,
      postHours: JSON.stringify(postHours),
      platforms: JSON.stringify(platforms),
      lemmyCommunity,
      pinterestBoard,
    },
  });

  return NextResponse.json({ ok: true });
}