import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiChat } from "@/lib/ai";
import {
  buildPrompt,
  scrubBannedWords,
  type QAPlatform,
  type Niche,
} from "@/lib/money-engine/qaPromptBuilder";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_PLATFORMS: QAPlatform[] = [
  "answer",
  "threads",
  "pinterest",
  "youtube",
  "instagram",
];

const VALID_NICHES: Niche[] = [
  "physical",
  "digital",
  "finance",
  "jobs",
  "beauty",
  "tech",
  "general",
];

function extractJson(text: string): any {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) { try { return JSON.parse(brace[0]); } catch {} }
  return null;
}

function scrubObject(obj: any, niche: Niche): any {
  if (typeof obj === "string") return scrubBannedWords(obj, niche);
  if (Array.isArray(obj)) return obj.map((v) => scrubObject(v, niche));
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const k of Object.keys(obj)) out[k] = scrubObject(obj[k], niche);
    return out;
  }
  return obj;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const platform = String(body.platform ?? "").trim() as QAPlatform;
  const nicheRaw = String(body.niche ?? "general").trim() as Niche;
  const question = String(body.question ?? "").trim();
  const productId = body.productId ? String(body.productId) : null;
  const productNameOverride = String(body.productName ?? "").trim();
  const productTypeOverride = String(body.productType ?? "").trim();

  if (!VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { error: `Invalid platform. Use one of: ${VALID_PLATFORMS.join(", ")}` },
      { status: 400 }
    );
  }
  const niche: Niche = VALID_NICHES.includes(nicheRaw) ? nicheRaw : "general";

  if (!question || question.length < 5) {
    return NextResponse.json(
      { error: "Question must be at least 5 characters" },
      { status: 400 }
    );
  }

  // Resolve product (from UserTrackingLink if productId given)
  let productName = productNameOverride || "this product";
  let productType = productTypeOverride || "physical";
  let cloakedUrl: string | undefined;

  if (productId) {
    const link = await prisma.userTrackingLink.findFirst({
      where: { id: productId, userId },
    });
    if (!link) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    productName = link.productName || link.label;
    productType = "physical"; // conservative default
    cloakedUrl = link.shortUrl ?? undefined;
  }

  try {
    const { system, user } = buildPrompt({
      platform,
      niche,
      productName,
      productType,
      question,
      cloakedUrl,
    });

    const raw = await aiChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { maxTokens: 900, temperature: 0.7 }
    );

    const parsed = extractJson(raw);
    if (!parsed) {
      return NextResponse.json(
        { error: "AI returned invalid format — try again" },
        { status: 500 }
      );
    }

    // Scrub banned words from every string field
    const cleaned = scrubObject(parsed, niche);

    // Save to history
    await prisma.autoMoneyQAHistory.create({
      data: {
        userId,
        niche,
        productName,
        productId,
        question,
        platform,
        generatedContent: JSON.stringify(cleaned),
        status: "generated",
      },
    });

    return NextResponse.json({ ok: true, platform, niche, content: cleaned });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Generation failed" },
      { status: 500 }
    );
  }
}