import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const VALID_PLATFORMS = new Set(["impact", "warriorplus"]);

/** GET /api/money-engine/tracking-links — list user's links */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const links = await prisma.userTrackingLink.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const counts = await prisma.userTrackingLink.groupBy({
    by: ["platform"],
    where: { userId, isActive: true },
    _count: true,
  });

  return NextResponse.json({
    links,
    counts: counts.reduce((acc, row) => {
      acc[row.platform] = row._count;
      return acc;
    }, {} as Record<string, number>),
  });
}

/** POST /api/money-engine/tracking-links — add a link */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const platform = String(body.platform ?? "").trim();
  const label = String(body.label ?? "").trim();
  const productName = String(body.productName ?? "").trim();
  const productImageUrl = String(body.productImageUrl ?? "").trim() || null;
  const merchantUrl = String(body.merchantUrl ?? "").trim();
  const trackingUrl = String(body.trackingUrl ?? "").trim();
  const price = body.price ? Number(body.price) : null;
  const originalPrice = body.originalPrice ? Number(body.originalPrice) : null;
  const currency = String(body.currency ?? "USD").trim() || "USD";
  const category = String(body.category ?? "").trim() || null;
  const description = String(body.description ?? "").trim() || null;
  const offerId = body.offerId ? String(body.offerId) : null;

  if (!VALID_PLATFORMS.has(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }
  if (!label || !productName) {
    return NextResponse.json({ error: "Label and product name are required" }, { status: 400 });
  }
  if (!trackingUrl || !/^https?:\/\//.test(trackingUrl)) {
    return NextResponse.json(
      { error: "Tracking URL must start with http:// or https://" },
      { status: 400 }
    );
  }
  if (!merchantUrl || !/^https?:\/\//.test(merchantUrl)) {
    return NextResponse.json(
      { error: "Merchant URL must start with http:// or https://" },
      { status: 400 }
    );
  }

  try {
    const link = await prisma.userTrackingLink.create({
      data: {
        userId,
        platform,
        label,
        productName,
        productImageUrl,
        merchantUrl,
        trackingUrl,
        price,
        originalPrice,
        currency,
        category,
        description,
        offerId,
      },
    });
    return NextResponse.json({ ok: true, link });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to save link" },
      { status: 500 }
    );
  }
}

/** DELETE /api/money-engine/tracking-links?id=... — remove a link */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.userTrackingLink.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}