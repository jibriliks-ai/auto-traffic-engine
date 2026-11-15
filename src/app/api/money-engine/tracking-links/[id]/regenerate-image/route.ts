import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSocialImage } from "@/lib/social/imageGenerator";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const link = await prisma.userTrackingLink.findFirst({
    where: { id: params.id, userId },
  });
  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  // Fallback chain: manual upload → scraped → raw product image
  const productImage =
    link.manualImageBase64 || link.scrapedImage || link.productImageUrl;

  if (!productImage) {
    return NextResponse.json(
      {
        error:
          "No product image available. Open Edit → click Upload image to add one.",
      },
      { status: 400 }
    );
  }

  const title = link.scrapedTitle || link.productName || link.label;
  const price =
    link.scrapedPrice ||
    (link.price ? `$${Number(link.price).toFixed(2)}` : "");
  const originalPrice = link.originalPrice
    ? `$${Number(link.originalPrice).toFixed(2)}`
    : undefined;
  const discount = computeDiscount(price, originalPrice ?? null);

  try {
    const { dataUrl } = await generateSocialImage({
      productImageUrl: productImage,
      title,
      price,
      originalPrice,
      brandName: link.scrapedBrand ?? undefined,
      ctaText: "Shop now 👆",
      brandColor: "#4f46e5",
      badge: discount ? `${discount}% OFF` : "NEW",
      urgencyLine: "Tap the link in bio to grab yours",
    });

    await prisma.userTrackingLink.update({
      where: { id: link.id },
      data: { generatedImage: dataUrl, generatedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Image generation failed" },
      { status: 500 }
    );
  }
}

function computeDiscount(
  price: string | null,
  original: string | null
): number | null {
  if (!price || !original) return null;
  const p = Number(String(price).replace(/[^0-9.]/g, ""));
  const o = Number(String(original).replace(/[^0-9.]/g, ""));
  if (!p || !o || o <= p) return null;
  return Math.round((1 - p / o) * 100);
}