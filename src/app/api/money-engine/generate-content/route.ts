import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiChat } from "@/lib/ai";
import { getPersonalAffiliateLink } from "@/lib/money-engine/linkResolver";
import { generateSocialImage } from "@/lib/social/imageGenerator";
import type { TrafficModule } from "@/lib/money-engine/types";

export const runtime = "nodejs";
export const maxDuration = 90;

const VALID_MODULES: TrafficModule[] = ["tiktok", "facebook", "x", "youtube"];

function extractJson(raw: string): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {}
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
  }
  const brace = raw.match(/\{[\s\S]*\}/);
  if (brace) {
    try {
      return JSON.parse(brace[0]);
    } catch {}
  }
  return null;
}

function buildPrompt(
  offer: any,
  module: TrafficModule
): { system: string; user: string } {
  const isDigital = offer.productType === "digital";
  const price = Number(offer.frontEndPrice ?? 0).toFixed(2);
  const original = offer.originalPrice
    ? Number(offer.originalPrice).toFixed(2)
    : null;
  const funnelMax = offer.funnelMaxPrice
    ? Number(offer.funnelMaxPrice).toFixed(2)
    : null;

  const baseContext = `Offer: ${offer.title}
Product type: ${offer.productType}
Category: ${offer.category ?? "general"}
Price: $${price}${original ? ` (was $${original})` : ""}${
    funnelMax ? `, funnel max $${funnelMax}` : ""
  }
${offer.vendor ? `Vendor: ${offer.vendor}` : ""}
${
  isDigital
    ? `EPC: $${Number(offer.epc).toFixed(2)} | Conversion: ${Number(
        offer.conversionRate
      ).toFixed(1)}%`
    : `Orders last 7 days: ${offer.orders7days.toLocaleString()} | Rating: ${Number(
        offer.rating
      ).toFixed(1)}/5`
}
${isDigital && offer.isRecurring ? "Type: RECURRING subscription" : ""}

Rules (non-negotiable):
- No income guarantees, no get-rich-quick language, no fake claims.
- ${
    isDigital
      ? "Frame as solving a specific problem, then show price + value."
      : "Frame as social proof + price drop + urgency. Do not promise results."
  }
- Output must be valid JSON only.`;

  const moduleInstructions: Record<TrafficModule, string> = {
    tiktok: `Write TikTok content.
Return JSON: { "script": "20-second video script with Hook (3s), Body (3 benefits, 12s), CTA (5s)", "caption": "2 sentences max", "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"] }`,
    facebook: `Write Facebook content.
Return JSON: { "caption": "150-250 word post, empathetic opener, 3 benefits, soft CTA", "hashtags": ["#tag1", "#tag2", "#tag3"] }`,
    x: `Write an X (Twitter) 3-tweet thread.
Return JSON: { "tweets": ["tweet 1 (hook)", "tweet 2 (offer + 3 benefits)", "tweet 3 (CTA)"], "hashtags": ["#tag1", "#tag2"] }`,
    youtube: `Write YouTube Shorts metadata.
Return JSON: { "title": "max 60 chars", "description": "150 words", "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"] }`,
  };

  return {
    system:
      "You are a conversion-focused copywriter for affiliate marketing. You always return valid JSON only.",
    user: `${baseContext}\n\n${moduleInstructions[module]}`,
  };
}

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
  const offerId = String(body.offerId ?? "").trim();
  const requestedModules = Array.isArray(body.trafficModules)
    ? body.trafficModules
    : VALID_MODULES;

  if (!offerId) {
    return NextResponse.json({ error: "offerId required" }, { status: 400 });
  }

  const modules = (requestedModules as string[]).filter(
    (m): m is TrafficModule => VALID_MODULES.includes(m as TrafficModule)
  );
  if (modules.length === 0) {
    return NextResponse.json(
      { error: "No valid traffic modules" },
      { status: 400 }
    );
  }

  const offer = await prisma.moneyEngineOffer.findUnique({
    where: { id: offerId },
  });
  if (!offer) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  // Resolve personal affiliate link if possible. If not connected, we still
  // generate content and save as draft — the link is filled on Phase 2.
  let affiliateLink = "PENDING_CONNECTION";
  try {
    affiliateLink = await getPersonalAffiliateLink(userId, {
      platform: offer.platform,
      offerId: offer.offerId,
      affiliateLinkTemplate: offer.affiliateLinkTemplate,
    });
  } catch {
    // expected until real platform clients land
  }

  const created: any[] = [];
  const errors: string[] = [];

  // ── Step 1: Generate text content for each traffic module ──
  for (const trafficModule of modules) {
    try {
      const { system, user } = buildPrompt(offer, trafficModule);
      const raw = await aiChat(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        { maxTokens: 700, temperature: 0.6 }
      );

      const parsed = extractJson(raw) ?? { caption: raw };

      // Normalize across module shapes
      let caption = "";
      let script = "";
      if (trafficModule === "tiktok") {
        caption = `${parsed.caption ?? ""}\n\n${(parsed.hashtags ?? []).join(
          " "
        )}`.trim();
        script = parsed.script ?? "";
      } else if (trafficModule === "facebook") {
        caption = `${parsed.caption ?? ""}\n\n${(parsed.hashtags ?? []).join(
          " "
        )}`.trim();
      } else if (trafficModule === "x") {
        const tweets = Array.isArray(parsed.tweets)
          ? parsed.tweets
          : [parsed.caption ?? ""];
        caption = tweets.join("\n\n---\n\n");
        script = tweets.join("\n\n");
      } else if (trafficModule === "youtube") {
        caption = `${parsed.title ?? ""}\n\n${
          parsed.description ?? ""
        }`.trim();
        script = (parsed.tags ?? []).join(", ");
      }

      const post = await prisma.moneyEnginePost.create({
        data: {
          userId,
          offerId: offer.id,
          productType: offer.productType,
          trafficModule,
          caption,
          script,
          videoUrl: offer.videoUrl ?? null,
          affiliateLink,
          utmSource: trafficModule,
          status: "draft",
        },
      });
      created.push(post);
    } catch (e: any) {
      errors.push(`${trafficModule}: ${e?.message ?? "unknown"}`);
    }
  }

  // ── Step 2: Generate branded social images in parallel ──
  // One 1080×1080 image per traffic module. Same base product image,
  // but each is regenerated to keep costs predictable and allow
  // per-module customization later.
  const imagesByModule: Record<string, string> = {};

  if (offer.imageUrl && created.length > 0) {
    const price = offer.frontEndPrice
      ? `$${Number(offer.frontEndPrice).toFixed(2)}${
          offer.originalPrice
            ? ` — was $${Number(offer.originalPrice).toFixed(2)}`
            : ""
        }`
      : "";

    const badge =
      offer.originalPrice && offer.frontEndPrice
        ? `${Math.round(
            (1 -
              Number(offer.frontEndPrice) / Number(offer.originalPrice)) *
              100
          )}% OFF`
        : undefined;

    await Promise.all(
      created.map(async (p) => {
        try {
          const { dataUrl } = await generateSocialImage({
            productImageUrl: offer.imageUrl!,
            title: offer.title,
            price,
            brandName: offer.vendor ?? undefined,
            ctaText: "Link in bio 👆",
            brandColor: "#4f46e5",
            badge,
          });
          imagesByModule[p.trafficModule] = dataUrl;
        } catch (e: any) {
          // Non-fatal — the text content is still valid without the image
          console.warn(
            `[generate-content] Image failed for ${p.trafficModule}: ${e?.message ?? e}`
          );
        }
      })
    );
  }

  // ── Step 3: Return posts with their matching images ──
  return NextResponse.json({
    ok: errors.length === 0,
    posts: created.map((p: any) => ({
      ...p,
      image: imagesByModule[p.trafficModule] ?? null,
    })),
    errors,
    linkResolved: affiliateLink !== "PENDING_CONNECTION",
  });
}