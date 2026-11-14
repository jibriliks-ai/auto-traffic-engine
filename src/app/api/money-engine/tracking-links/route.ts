import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scrapeUrl } from "@/lib/video/urlScraper";
import { createCloakedLink } from "@/lib/money-engine/linkCloaker";
import { generateSnippets } from "@/lib/money-engine/snippetGenerator";
import { generateSocialImage } from "@/lib/social/imageGenerator";

export const runtime = "nodejs";
export const maxDuration = 90;

const VALID_PLATFORMS = new Set(["impact", "warriorplus"]);

function serializeLean(l: any) {
  const { generatedImage, manualImageBase64, ...rest } = l;
  return {
    ...rest,
    price: rest.price?.toString() ?? null,
    originalPrice: rest.originalPrice?.toString() ?? null,
    hasImage: Boolean(manualImageBase64 || generatedImage),
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await prisma.userTrackingLink.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ links: raw.map(serializeLean) });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const platform = String(body.platform ?? "").trim();
  const trackingUrl = String(body.trackingUrl ?? "").trim();
  const merchantUrl = String(body.merchantUrl ?? "").trim();
  const label = String(body.label ?? "").trim() || "My product";
  const manualImageBase64 = typeof body.manualImageBase64 === "string" && body.manualImageBase64.startsWith("data:image")
    ? body.manualImageBase64
    : null;

  if (!VALID_PLATFORMS.has(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }
  if (!trackingUrl || !/^https?:\/\//.test(trackingUrl)) {
    return NextResponse.json({ error: "Tracking URL must start with http:// or https://" }, { status: 400 });
  }
  if (!merchantUrl || !/^https?:\/\//.test(merchantUrl)) {
    return NextResponse.json({ error: "Product page URL must start with http:// or https://" }, { status: 400 });
  }

  const trackingLink = await prisma.userTrackingLink.create({
    data: {
      userId,
      platform,
      label,
      productName: label,
      merchantUrl,
      trackingUrl,
      productImageUrl: null,
      manualImageBase64,
      scrapeStatus: "pending",
    },
  });

  try {
    // ── Scrape product page (best-effort) ──
    let scraped: Awaited<ReturnType<typeof scrapeUrl>> | null = null;
    let scrapeError: string | null = null;
    try {
      scraped = await scrapeUrl(merchantUrl);
    } catch (e: any) {
      scrapeError = String(e?.message ?? e).slice(0, 400);
      if (!manualImageBase64) throw e; // no fallback available
    }

    const productImage = manualImageBase64 || scraped?.imageUrl || null;
    if (!productImage) {
      await prisma.userTrackingLink.update({
        where: { id: trackingLink.id },
        data: {
          scrapeStatus: "failed",
          scrapeError: "No product image found — upload one manually or try a different product page URL",
        },
      });
      return NextResponse.json({
        ok: false,
        id: trackingLink.id,
        error: "No image found. Upload a product image or try another URL.",
      });
    }

    // ── Cloaked link ──
    const cloaked = await createCloakedLink({
      trackingLinkId: trackingLink.id,
      productName: scraped?.title ?? label,
      brand: scraped?.brand ?? null,
    });

    // ── Marketing image ──
    const discount = computeDiscount(scraped?.price ?? null, scraped?.originalPrice ?? null);
    let generatedImage: string | null = null;
    try {
      const { dataUrl } = await generateSocialImage({
        productImageUrl: productImage,
        title: scraped?.title ?? label,
        price: scraped?.price ?? "",
        originalPrice: scraped?.originalPrice ?? undefined,
        brandName: scraped?.brand ?? undefined,
        ctaText: "Shop now 👆",
        brandColor: "#4f46e5",
        badge: discount ? `${discount}% OFF` : "NEW",
        urgencyLine: "Tap the link in bio to grab yours",
      });
      generatedImage = dataUrl;
    } catch (e: any) {
      console.warn(`[tracking-links] Image gen failed: ${e?.message ?? e}`);
    }

    // ── Marketing snippets ──
    const snippets = await generateSnippets({
      productName: scraped?.title ?? label,
      brand: scraped?.brand ?? null,
      price: scraped?.price ?? null,
      originalPrice: scraped?.originalPrice ?? null,
      description: scraped?.description ?? null,
      category: scraped?.category ?? null,
      merchantUrl,
      cloakedUrl: cloaked.shortUrl,
    });

    await prisma.userTrackingLink.update({
      where: { id: trackingLink.id },
      data: {
        productName: (scraped?.title ?? label).slice(0, 200),
        productImageUrl: scraped?.imageUrl ?? null,
        price: scraped?.price ? parsePrice(scraped.price) : null,
        originalPrice: scraped?.originalPrice ? parsePrice(scraped.originalPrice) : null,
        category: scraped?.category ?? null,
        description: scraped?.description?.slice(0, 1500) ?? null,
        scrapedTitle: scraped?.title ?? null,
        scrapedImage: scraped?.imageUrl ?? null,
        scrapedPrice: scraped?.price ?? null,
        scrapedDescription: scraped?.description ?? null,
        scrapedBrand: scraped?.brand ?? null,
        scrapeStatus: scrapeError && !scraped ? "failed" : "success",
        scrapeError,
        slug: cloaked.slug,
        shortUrl: cloaked.shortUrl,
        generatedImage,
        generatedSnippets: JSON.stringify(snippets),
        generatedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, id: trackingLink.id });
  } catch (e: any) {
    await prisma.userTrackingLink.update({
      where: { id: trackingLink.id },
      data: { scrapeStatus: "failed", scrapeError: String(e?.message ?? e).slice(0, 500) },
    }).catch(() => {});
    return NextResponse.json({ ok: false, id: trackingLink.id, error: e?.message ?? "Failed" }, { status: 500 });
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