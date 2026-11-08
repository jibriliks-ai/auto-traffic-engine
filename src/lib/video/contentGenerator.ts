import { aiChat } from "@/lib/ai";
import type { ScrapedProduct } from "./urlScraper";

export interface GeneratedVideoContent {
  title: string;      // punchy hook (≤60 chars) — the on-video title
  priceText: string;  // price line — can be empty
  cta: string;        // call to action
  brandColor: string; // hex
  imageUrl: string | null;
  benefits: string[]; // informational — shown as suggestions in the UI
}

/**
 * Takes scraped product data and asks the AI to write a professional
 * 20-second ad script: hook, price line, CTA, brand color, benefits.
 * Returns sensible defaults if the AI fails.
 */
export async function generateVideoContent(
  product: ScrapedProduct
): Promise<GeneratedVideoContent> {
  const systemPrompt =
    "You are a senior direct-response copywriter for 20-second vertical video ads. " +
    "You write in plain, human, punchy language. " +
    "NEVER make income claims, health claims, or fake urgency. " +
    "You ALWAYS return valid JSON only — no markdown, no explanation.";

  const userPrompt = `Product page to turn into a 20-second vertical ad:

URL: ${product.url}
Brand: ${product.brand ?? "Unknown"}
Product: ${product.title}
Description: ${product.description || "(no description available)"}
Price found on page: ${product.price ?? "(no price detected)"}

Return this exact JSON shape:
{
  "title": "punchy 4-8 word hook that makes someone stop scrolling. Example: 'These earbuds fix a problem you didn't know you had'",
  "priceText": "price line if a price is known — e.g. '$12.99 — was $39.99' — or empty string if no price",
  "cta": "short CTA e.g. 'Link in bio → Comment LINK'",
  "brandColor": "#hex color that fits the product's vibe (warm/orange for food & lifestyle, blue/purple for tech & SaaS, green for health, black for luxury)",
  "benefits": ["3 very short benefit phrases, ≤5 words each"]
}

Rules:
- Title: max 60 characters. No emojis. No ALL CAPS. No exclamation points.
- priceText: only include if a price was detected — otherwise empty string.
- cta: max 40 characters. Must invite action without being spammy.
- brandColor: single valid hex like "#4f46e5".
- benefits: array of 3 short strings.`;

  let parsed: any = null;
  try {
    const raw = await aiChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 500, temperature: 0.7 }
    );
    parsed = extractJson(raw);
  } catch {
    parsed = null;
  }

  // Fallback if AI returned nothing usable
  const fallbackTitle =
    product.title.length > 60
      ? product.title.slice(0, 57) + "…"
      : product.title || "Trending right now";

  return {
    title: sanitizeTitle(parsed?.title) ?? fallbackTitle,
    priceText: sanitizePrice(parsed?.priceText, product.price),
    cta: sanitizeCta(parsed?.cta) ?? "Link in bio → Comment LINK",
    brandColor: sanitizeColor(parsed?.brandColor) ?? "#4f46e5",
    imageUrl: product.imageUrl,
    benefits: Array.isArray(parsed?.benefits)
      ? parsed.benefits
          .filter((b: any) => typeof b === "string" && b.trim())
          .slice(0, 3)
      : [],
  };
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

function sanitizeTitle(t: any): string | null {
  if (typeof t !== "string") return null;
  const clean = t.replace(/[!]/g, "").replace(/\s+/g, " ").trim();
  if (clean.length < 3) return null;
  return clean.slice(0, 60);
}

function sanitizePrice(p: any, fallback: string | null): string {
  if (typeof p === "string" && p.trim()) return p.trim().slice(0, 40);
  return fallback ?? "";
}

function sanitizeCta(c: any): string | null {
  if (typeof c !== "string") return null;
  const clean = c.trim();
  if (clean.length < 3) return null;
  return clean.slice(0, 60);
}

function sanitizeColor(c: any): string | null {
  if (typeof c !== "string") return null;
  const m = c.match(/^#[0-9a-fA-F]{6}$/);
  return m ? m[0] : null;
}