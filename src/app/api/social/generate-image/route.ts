import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSocialImage } from "@/lib/social/imageGenerator";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const offerId = String(body.offerId ?? "").trim();
  if (!offerId) {
    return NextResponse.json({ error: "offerId required" }, { status: 400 });
  }

  const offer = await prisma.moneyEngineOffer.findUnique({ where: { id: offerId } });
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  if (!offer.imageUrl) {
    return NextResponse.json({ error: "Offer has no product image" }, { status: 400 });
  }

  try {
    const price = offer.frontEndPrice
      ? `$${Number(offer.frontEndPrice).toFixed(2)}${
          offer.originalPrice ? ` — was $${Number(offer.originalPrice).toFixed(2)}` : ""
        }`
      : "";

    const badge = offer.originalPrice && offer.frontEndPrice
      ? `${Math.round(
          (1 - Number(offer.frontEndPrice) / Number(offer.originalPrice)) * 100
        )}% OFF`
      : undefined;

    const { dataUrl } = await generateSocialImage({
      productImageUrl: offer.imageUrl,
      title: offer.title,
      price,
      brandName: offer.vendor ?? undefined,
      ctaText: "Link in bio 👆",
      brandColor: "#4f46e5",
      badge,
    });

    return NextResponse.json({ ok: true, dataUrl });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Image generation failed" },
      { status: 500 }
    );
  }
}