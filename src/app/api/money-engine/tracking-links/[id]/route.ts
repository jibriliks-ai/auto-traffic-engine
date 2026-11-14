import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const link = await prisma.userTrackingLink.findFirst({
    where: { id: params.id, userId },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Lean — no base64
  const { generatedImage, manualImageBase64, ...rest } = link;
  return NextResponse.json({
    link: {
      ...rest,
      price: rest.price?.toString() ?? null,
      originalPrice: rest.originalPrice?.toString() ?? null,
      hasImage: Boolean(manualImageBase64 || generatedImage),
    },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.userTrackingLink.findFirst({
    where: { id: params.id, userId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const patch: any = {};

  if (typeof body.label === "string" && body.label.trim()) patch.label = body.label.trim().slice(0, 200);
  if (typeof body.productName === "string" && body.productName.trim()) patch.productName = body.productName.trim().slice(0, 200);

  if (typeof body.trackingUrl === "string") {
    if (!/^https?:\/\//.test(body.trackingUrl)) {
      return NextResponse.json({ error: "Tracking URL must start with http:// or https://" }, { status: 400 });
    }
    patch.trackingUrl = body.trackingUrl.trim();
  }

  if (typeof body.merchantUrl === "string") {
    if (!/^https?:\/\//.test(body.merchantUrl)) {
      return NextResponse.json({ error: "Merchant URL must start with http:// or https://" }, { status: 400 });
    }
    const newMerchant = body.merchantUrl.trim();
    patch.merchantUrl = newMerchant;
    // If merchant URL changed, scraped data is stale — clear it
    if (newMerchant !== existing.merchantUrl) {
      patch.scrapeStatus = "pending";
      patch.scrapedTitle = null;
      patch.scrapedImage = null;
      patch.scrapedPrice = null;
      patch.scrapedDescription = null;
      patch.scrapedBrand = null;
    }
  }

  if (body.price !== undefined) {
    if (body.price === null || body.price === "") patch.price = null;
    else {
      const n = Number(String(body.price).replace(/[^0-9.]/g, ""));
      if (Number.isFinite(n)) patch.price = n;
    }
  }
  if (body.originalPrice !== undefined) {
    if (body.originalPrice === null || body.originalPrice === "") patch.originalPrice = null;
    else {
      const n = Number(String(body.originalPrice).replace(/[^0-9.]/g, ""));
      if (Number.isFinite(n)) patch.originalPrice = n;
    }
  }
  if (typeof body.category === "string") patch.category = body.category.trim() || null;
  if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 1500) || null;
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;

  const updated = await prisma.userTrackingLink.update({
    where: { id: params.id },
    data: patch,
  });

  const { generatedImage, manualImageBase64, ...rest } = updated;
  return NextResponse.json({
    ok: true,
    link: {
      ...rest,
      price: rest.price?.toString() ?? null,
      originalPrice: rest.originalPrice?.toString() ?? null,
      hasImage: Boolean(manualImageBase64 || generatedImage),
    },
  });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.userTrackingLink.deleteMany({ where: { id: params.id, userId } });
  return NextResponse.json({ ok: true });
}