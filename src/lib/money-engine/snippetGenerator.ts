import { aiChat } from "@/lib/ai";

export interface SnippetSet {
  tiktok: { caption: string; hashtags: string[]; script: string };
  facebook: { caption: string; hashtags: string[] };
  x: { tweets: string[]; hashtags: string[] };
  youtube: { title: string; description: string; tags: string[] };
}

export interface SnippetInput {
  productName: string;
  brand?: string | null;
  price?: string | null;
  originalPrice?: string | null;
  description?: string | null;
  category?: string | null;
  merchantUrl: string;
  cloakedUrl: string;
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

function fallback(input: SnippetInput): SnippetSet {
  const brand = input.brand ?? "this brand";
  const price = input.price ?? "a great price";
  return {
    tiktok: {
      caption: `🔥 Found this at ${brand}. ${input.productName} for ${price}. Link in bio.`,
      hashtags: ["#finds", "#deals", "#shopping"],
      script: `Hook: You need to see this.\nBody: ${input.productName} — now ${price}.\nCTA: Tap the link in bio.`,
    },
    facebook: {
      caption: `Just came across ${input.productName}${input.brand ? ` from ${input.brand}` : ""}. ${price ? `At ${price},` : ""} it's genuinely worth a look.\n\nMore details here: ${input.cloakedUrl}`,
      hashtags: ["#deals", "#shopping"],
    },
    x: {
      tweets: [
        `Found something good 👇`,
        `${input.productName}${price ? ` for ${price}` : ""}. ${input.brand ? `via ${input.brand}.` : ""}`,
        `Details: ${input.cloakedUrl}`,
      ],
      hashtags: ["#deals"],
    },
    youtube: {
      title: `${input.productName} — Quick Look`,
      description: `${input.productName}${price ? ` at ${price}` : ""}. Full details: ${input.cloakedUrl}`,
      tags: ["product", "deal", "review"],
    },
  };
}

export async function generateSnippets(input: SnippetInput): Promise<SnippetSet> {
  const system = `You are a conversion copywriter. You write short, punchy social media posts for e-commerce products.
You NEVER use banned phrases: "game-changer", "unlock your potential", "in today's digital world", "don't miss out", "act now", "amazing opportunity", "100% guaranteed", "limited time offer".
You ALWAYS return valid JSON only, no markdown, no prose.

CRITICAL: The only URL you may include is the cloaked URL provided: ${input.cloakedUrl}
DO NOT invent URLs. DO NOT reference the merchant URL.`;

  const user = `Product: ${input.productName}
Brand: ${input.brand ?? "unknown"}
Price: ${input.price ?? "unknown"}${input.originalPrice ? ` (was ${input.originalPrice})` : ""}
Category: ${input.category ?? "general"}
Description: ${input.description?.slice(0, 400) ?? "(none)"}
Cloaked URL (the ONLY allowed URL): ${input.cloakedUrl}

Return this exact JSON:
{
  "tiktok": { "caption": "1-2 sentences, ≤150 chars, ends with 'link in bio'", "hashtags": ["#tag1","#tag2","#tag3"], "script": "3-part 20-sec script: Hook (1s) | 3 benefits | CTA" },
  "facebook": { "caption": "80-150 word post, empathic opener, 2-3 benefits, CTA with ${input.cloakedUrl}", "hashtags": ["#tag1","#tag2"] },
  "x": { "tweets": ["hook tweet ≤120 chars","body with 2 benefits","CTA with ${input.cloakedUrl}"], "hashtags": ["#tag1","#tag2"] },
  "youtube": { "title": "≤60 chars", "description": "100 words, ends with ${input.cloakedUrl}", "tags": ["tag1","tag2","tag3","tag4","tag5"] }
}

Rules:
- No emojis beyond 1 per caption
- No exclamation-mark spam
- Only use ${input.cloakedUrl} — never the merchant URL
- Make it feel human, like a real shopper`;

  try {
    const raw = await aiChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { maxTokens: 800, temperature: 0.7 }
    );
    const parsed = extractJson(raw);
    if (!parsed || !parsed.tiktok || !parsed.facebook) {
      return fallback(input);
    }
    const fb = fallback(input);
    return {
      tiktok: parsed.tiktok ?? fb.tiktok,
      facebook: parsed.facebook ?? fb.facebook,
      x: parsed.x ?? fb.x,
      youtube: parsed.youtube ?? fb.youtube,
    };
  } catch {
    return fallback(input);
  }
}