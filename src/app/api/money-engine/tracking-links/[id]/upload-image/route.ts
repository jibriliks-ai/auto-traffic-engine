import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import sharp from "sharp";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSocialImage } from "@/lib/social/imageGenerator";
import { generateSnippets } from "@/lib/money-engine/snippetGenerator";
import { createCloakedLink } from "@/lib/money-engine/linkCloaker";

export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_SIZE = 8 * 1024 * 1024;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const link = await prisma.userTrackingLink.findFirst({
    where: { id: params.id, userId },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Image must be under 8MB" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  // Re-encode as JPEG to strip EXIF and normalize
  const raw = Buffer.from(await file.arrayBuffer());
  const normalized = await sharp(raw)
    .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();

  const manualImageBase64 = `data:image/jpeg;base64,${normalized.toString("base64")}`;

  // Regenerate the marketing composite using the uploaded image
  const title = link.scrapedTitle || link.productName || link.label;
  const brand = link.scrapedBrand || null;
  const price = link.scrapedPrice || null;
  const originalPrice = link.originalPrice ? `$${Number(link.originalPrice).toFixed(2)}` : null;
  const discount = computeDiscount(price, originalPrice);

  let generatedImage: string | null = null;
  try {
    const { dataUrl } = await generateSocialImage({
      productImageUrl: manualImageBase64,
      title,
      price: price ?? "",
      originalPrice: originalPrice ?? undefined,
      brandName: brand ?? undefined,
      ctaText: "Shop now 👆",
      brandColor: "#4f46e5",
      badge: discount ? `${discount}% OFF` : "NEW",
      urgencyLine: "Tap the link in bio to grab yours",
    });
    generatedImage = dataUrl;
  } catch (e: any) {
    console.warn(`[upload-image] Composite failed: ${e?.message ?? e}`);
  }

  // Make sure we have a cloaked link
  let shortUrl = link.shortUrl;
  let slug = link.slug;
  if (!shortUrl) {
    try {
      const cloaked = await createCloakedLink({
        trackingLinkId: link.id,
        productName: title,
        brand,
      });
      shortUrl = cloaked.shortUrl;
      slug = cloaked.slug;
    } catch {}
  }

  // Generate snippets if we don't have them yet
  let generatedSnippets = link.generatedSnippets;
  if (!generatedSnippets && shortUrl) {
    try {
      const snippets = await generateSnippets({
        productName: title,
        brand,
        price,
        originalPrice,
        description: link.scrapedDescription || link.description,
        category: link.category,
        merchantUrl: link.merchantUrl,
        cloakedUrl: shortUrl,
      });
      generatedSnippets = JSON.stringify(snippets);
    } catch {}
  }

  const updated = await prisma.userTrackingLink.update({
    where: { id: link.id },
    data: {
      manualImageBase64,
      generatedImage,
      generatedSnippets,
      slug,
      shortUrl,
      scrapeStatus: generatedImage ? "success" : link.scrapeStatus,
      scrapeError: null,
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
      hasImage: Boolean(generatedImage || manualImageBase64),
    },
  });
}

function computeDiscount(price: string | null, original: string | null): number | null {
  if (!price || !original) return null;
  const p = Number(String(price).replace(/[^0-9.]/g, ""));
  const o = Number(String(original).replace(/[^0-9.]/g, ""));
  if (!p || !o || o <= p) return null;
  return Math.round((1 - p / o) * 100);
}