import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const offerId = url.searchParams.get("offer_id");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  const where: any = { userId };
  if (status) where.status = status;
  if (offerId) where.offerId = offerId;

  const posts = await prisma.moneyEnginePost.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { offer: { select: { title: true, platform: true, imageUrl: true } } },
  });

  return NextResponse.json({ posts });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Only allow deleting your own drafts
  const deleted = await prisma.moneyEnginePost.deleteMany({
    where: { id, userId, status: "draft" },
  });
  return NextResponse.json({ ok: true, deleted: deleted.count });
}