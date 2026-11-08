import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const productType = url.searchParams.get("product_type"); // 'digital' | 'physical' | null
  const platform = url.searchParams.get("platform");
  const q = url.searchParams.get("q");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 30), 100);

  const where: any = {};
  if (productType === "digital" || productType === "physical") {
    where.productType = productType;
  }
  if (platform) where.platform = platform;
  if (q) where.title = { contains: q, mode: "insensitive" };

  const offers = await prisma.moneyEngineOffer.findMany({
    where,
    orderBy: [{ score: "desc" }, { lastSyncedAt: "desc" }],
    take: limit,
  });

  const stats = {
    totalActive: await prisma.moneyEngineOffer.count({ where: { status: "active" } }),
    digitalCount: await prisma.moneyEngineOffer.count({ where: { productType: "digital", status: "active" } }),
    physicalCount: await prisma.moneyEngineOffer.count({ where: { productType: "physical", status: "active" } }),
  };

  return NextResponse.json({ offers, stats });
}