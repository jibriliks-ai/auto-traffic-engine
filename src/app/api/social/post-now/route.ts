import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postToAll } from "@/lib/social/poster";
import { generateSocialImage } from "@/lib/social/imageGenerator";
import type { SocialPlatform } from "@/lib/social/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const offerId = String(body.offerId ?? "").trim();
  const caption = String(body.caption ?? "").trim();
  const platforms = (body.platforms ?? []) as SocialPlatform[];
  const useGeneratedImage = body.useGeneratedImage !== false; // default true

  if (!caption) return NextResponse.json({ error: "caption required" }, { status: 400 });
  if (!platforms.length) return NextResponse.json({ error: "platforms required" }, { status: 400 });

  try {
    let imageBuffer: Buffer | undefined = undefined;

    if (useGeneratedImage && offerId) {
      const offer = await prisma.moneyEngineOffer.findUnique({ where: { id: offerId } });
      if (offer?.imageUrl) {
        const price = offer.frontEndPrice
          ? `$${Number(offer.frontEndPrice).toFixed(2)}${
              offer.originalPrice ? ` — was $${Number(offer.originalPrice).toFixed(2)}` : ""
            }`
          : "";
        const badge =
          offer.originalPrice && offer.frontEndPrice
            ? `${Math.round(
                (1 - Number(offer.frontEndPrice) / Number(offer.originalPrice)) * 100
              )}% OFF`
            : undefined;

        const img = await generateSocialImage({
          productImageUrl: offer.imageUrl,
          title: offer.title,
          price,
          brandName: offer.vendor ?? undefined,
          ctaText: "Link in bio 👆",
          brandColor: "#4f46e5",
          badge,
        });
        imageBuffer = img.buffer;
      }
    }

    const results = await postToAll(
      userId,
      platforms,
      { caption, imageBuffer },
      offerId || undefined
    );

    return NextResponse.json({
      ok: results.every((r) => r.result.ok),
      results,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Post failed" },
      { status: 500 }
    );
  }
}