import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scrapeUrl } from "@/lib/video/urlScraper";
import { generateVideoContent } from "@/lib/video/contentGenerator";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/video/from-url
 *
 * Body:
 *   { url: "https://product-page.com/..." }     — scrape any URL
 *   OR
 *   { offerId: "cuid..." }                       — pull from Money Engine offer
 *
 * Returns AI-generated video content ready to fill the video form.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized — sign out and back in." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const url = String(body.url ?? "").trim();
  const offerId = String(body.offerId ?? "").trim();

  try {
    if (offerId) {
      // Path A — load from Money Engine offer, no scraping needed
      const offer = await prisma.moneyEngineOffer.findUnique({
        where: { id: offerId },
      });
      if (!offer) {
        return NextResponse.json({ error: "Offer not found." }, { status: 404 });
      }

      const content = await generateVideoContent({
        url: offer.salesPageUrl ?? "",
        title: offer.title,
        description: `${offer.category ?? ""} — ${offer.vendor ?? ""}`.trim(),
        imageUrl: offer.imageUrl ?? null,
        price: offer.frontEndPrice ? `$${Number(offer.frontEndPrice).toFixed(2)}` : null,
        brand: offer.vendor ?? null,
      });

      return NextResponse.json({
        content: {
          ...content,
          priceText:
            content.priceText ||
            (offer.frontEndPrice
              ? `$${Number(offer.frontEndPrice).toFixed(2)}${
                  offer.originalPrice
                    ? ` — was $${Number(offer.originalPrice).toFixed(2)}`
                    : ""
                }`
              : ""),
          imageUrl: content.imageUrl ?? offer.imageUrl ?? null,
        },
        source: { type: "offer", offerId: offer.id },
      });
    }

    if (!url) {
      return NextResponse.json(
        { error: "Provide a product URL or offerId." },
        { status: 400 }
      );
    }

    // Path B — scrape any URL
    const scraped = await scrapeUrl(url);
    if (!scraped.imageUrl) {
      return NextResponse.json(
        {
          error:
            "No product image found on this page. Try a specific product URL (not the homepage).",
        },
        { status: 422 }
      );
    }

    const content = await generateVideoContent(scraped);

    return NextResponse.json({
      content,
      source: { type: "url", url: scraped.url, scraped },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to generate content from this source." },
      { status: 500 }
    );
  }
}