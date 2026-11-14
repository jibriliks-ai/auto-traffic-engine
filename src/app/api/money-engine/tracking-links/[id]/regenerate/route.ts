import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scrapeUrl } from "@/lib/video/urlScraper";
import { generateSocialImage } from "@/lib/social/imageGenerator";
import { generateSnippets } from "@/lib/money-engine/snippetGenerator";

export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * Re-runs scrape + image + snippets for an existing link.
 * Preserves the existing /go/ slug so old social posts keep working.
 */
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const link = await prisma.userTrackingLink.findFirst({
    where: { id: params.id, userId },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!link.shortUrl) {
    return NextResponse.json({ error: "Cannot regenerate — no cloaked URL yet" }, { status: 400 });
  }

  try {
    await prisma.userTrackingLink.update({
      where: { id: link.id },
      data: { scrapeStatus: "pending", scrapeError: null },
    });

    const scraped = await scrapeUrl(link.merchantUrl);
    const productImage = link.manualImageBase64 || scraped.imageUrl || link.productImageUrl;

    if (!productImage) {
      await prisma.userTrackingLink.update({
        where: { id: link.id },
        data: { scrapeStatus: "failed", scrapeError: "No product image found on the page" },
      });
      return NextResponse.json({ ok: false, error: "No image — upload one manually" }, { status: 400 });
    }

    const discount = computeDiscount(scraped.price, scraped.originalPrice);
    let generatedImage: string | null = null;
    try {
      const { dataUrl } = await generateSocialImage({
        productImageUrl: productImage,
        title: scraped.title,
        price: scraped.price ?? "",
        originalPrice: scraped.originalPrice ?? undefined,
        brandName: scraped.brand ?? undefined,
        ctaText: "Shop now 👆",
        brandColor: "#4f46e5",
        badge: discount ? `${discount}% OFF` : "NEW",
        urgencyLine: "Tap the link in bio to grab yours",
      });
      generatedImage = dataUrl;
    } catch (e: any) {
      console.warn(`[regenerate] Image failed: ${e?.message ?? e}`);
    }

    const snippets = await generateSnippets({
      productName: scraped.title,
      brand: scraped.brand,
      price: scraped.price,
      originalPrice: scraped.originalPrice,
      description: scraped.description,
      category: scraped.category,
      merchantUrl: link.merchantUrl,
      cloakedUrl: link.shortUrl,
    });

    const updated = await prisma.userTrackingLink.update({
      where: { id: link.id },
      data: {
        productName: scraped.title.slice(0, 200),
        productImageUrl: scraped.imageUrl,
        price: scraped.price ? parsePrice(scraped.price) : link.price,
        originalPrice: scraped.originalPrice ? parsePrice(scraped.originalPrice) : link.originalPrice,
        category: scraped.category ?? link.category,
        description: scraped.description?.slice(0, 1500) ?? link.description,
        scrapedTitle: scraped.title,
        scrapedImage: scraped.imageUrl,
        scrapedPrice: scraped.price,
        scrapedDescription: scraped.description,
        scrapedBrand: scraped.brand,
        scrapeStatus: "success",
        scrapeError: null,
        generatedImage,
        generatedSnippets: JSON.stringify(snippets),
        generatedAt: new Date(),
      },
    });

    const { generatedImage: _gi, manualImageBase64: _mi, ...rest } = updated;
    return NextResponse.json({
      ok: true,
      link: {
        ...rest,
        price: rest.price?.toString() ?? null,
        originalPrice: rest.originalPrice?.toString() ?? null,
        hasImage: Boolean(generatedImage || updated.manualImageBase64),
      },
    });
  } catch (e: any) {
    await prisma.userTrackingLink.update({
      where: { id: link.id },
      data: { scrapeStatus: "failed", scrapeError: String(e?.message ?? e).slice(0, 500) },
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed" }, { status: 500 });
  }
}

function computeDiscount(price: string | null, original: string | null): number | null {
  if (!price || !original) return null;
  const p = Number(String(price).replace(/[^0-9.]/g, ""));
  const o = Number(String(original).replace(/[^0-9.]/g, ""));
  if (!p || !o || o <= p) return null;
  return Math.round((1 - p / o) * 100);
}

function parsePrice(s: string): number | null {
  const n = Number(String(s).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}