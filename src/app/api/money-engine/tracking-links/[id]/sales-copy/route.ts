import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiChat } from "@/lib/ai";
import { createCloakedLink } from "@/lib/money-engine/linkCloaker";

export const runtime = "nodejs";
export const maxDuration = 60;

const BANNED = [
  "game-changer", "game changer", "unlock your potential",
  "in today's digital world", "don't miss out", "limited time offer",
  "act now", "amazing opportunity", "100% guaranteed", "guaranteed",
  "passive income", "get rich quick",
];

function scrub(text: string): string {
  let out = text;
  for (const p of BANNED) {
    const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(re, "[removed]");
  }
  return out;
}

function extractJson(text: string): any {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) { try { return JSON.parse(brace[0]); } catch {} }
  return null;
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const link = await prisma.userTrackingLink.findFirst({
    where: { id: params.id, userId },
  });
  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  // Ensure we have a cloaked URL — generate on the fly for legacy links
  let shortUrl = link.shortUrl;
  if (!shortUrl) {
    try {
      const cloaked = await createCloakedLink({
        trackingLinkId: link.id,
        productName: link.productName || link.label,
        brand: link.scrapedBrand,
      });
      shortUrl = cloaked.shortUrl;
    } catch {
      return NextResponse.json(
        { error: "Could not generate cloaked URL. Open Edit → click Re-scrape, then try again." },
        { status: 400 }
      );
    }
  }

  const product = link.scrapedTitle || link.productName || link.label;
  const brand = link.scrapedBrand ?? link.platform;
  const price = link.scrapedPrice || (link.price ? `$${Number(link.price).toFixed(2)}` : "");
  const description = link.scrapedDescription || link.description || "";
  const category = link.category ?? "general";

  const systemPrompt = `You are a discussion-forum writer for Lemmy and Apache Answer.
Never use: ${BANNED.join(", ")}.
Return valid JSON only. The ONLY allowed URL is: ${shortUrl}`;

  const userPrompt = `Product: ${product}
Brand: ${brand}
Price: ${price}
Category: ${category}
Description: ${description.slice(0, 500)}
Cloaked URL: ${shortUrl}

Return JSON:
{
  "lemmy": {
    "title": "8-14 word discussion title, human tone",
    "body": "120-200 words: personal opener, 2-3 facts, question + URL once"
  },
  "answer": {
    "question": "30-50 word question a real user might ask",
    "answer": "150-250 words: direct answer, 2-3 facts, personal take + URL once"
  }
}

Include ${shortUrl} EXACTLY ONCE in each. No emojis spam. No "link in bio".`;

  try {
    const raw = await aiChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 1000, temperature: 0.7 }
    );

    const parsed = extractJson(raw);
    if (!parsed?.lemmy || !parsed?.answer) {
      return NextResponse.json(
        { error: "AI returned invalid format — click again to retry" },
        { status: 500 }
      );
    }

    const lemmy = {
      title: scrub(String(parsed.lemmy.title ?? "").slice(0, 250)),
      body: scrub(String(parsed.lemmy.body ?? "").slice(0, 3000)),
    };
    const answer = {
      question: scrub(String(parsed.answer.question ?? "").slice(0, 500)),
      answer: scrub(String(parsed.answer.answer ?? "").slice(0, 3000)),
    };

    return NextResponse.json({ ok: true, lemmy, answer, cloakedUrl: shortUrl });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Generation failed" },
      { status: 500 }
    );
  }
}