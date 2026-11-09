import { aiChat } from "@/lib/ai";
import type { ScrapedProduct } from "./urlScraper";

export interface Scene {
  prompt: string;
  voiceover: string;
  caption: string;
}

export interface SceneScript {
  scenes: Scene[];
  title: string;
  priceText: string;
  cta: string;
  brandColor: string;
}

export async function generateSceneScript(
  product: ScrapedProduct
): Promise<SceneScript> {
  const systemPrompt = "You are a senior direct-response video ad writer. You write 20-second vertical video ads for products. You ALWAYS return valid JSON only - no markdown, no explanation. NEVER make income claims, health claims, or fake urgency.";

  const userPrompt = `Product to turn into a 3-scene, 20-second ad:

URL: ${product.url}
Brand: ${product.brand ?? "Unknown"}
Product: ${product.title}
Description: ${product.description || "(no description)"}
Price found: ${product.price ?? "(no price)"}

Return this exact JSON shape:
{
  "scenes": [
    { "prompt": "cinematic motion - product rotates slowly, soft rim lighting", "voiceover": "12-15 word spoken line", "caption": "3-6 word on-screen text" },
    { "prompt": "another motion description", "voiceover": "12-15 word line", "caption": "3-6 word text" },
    { "prompt": "another motion description", "voiceover": "12-15 word line", "caption": "3-6 word text" }
  ],
  "title": "punchy 4-8 word hook, max 60 chars",
  "priceText": "price line if known, else empty string",
  "cta": "short CTA, max 40 chars",
  "brandColor": "#hexcolor fitting the product"
}

Rules: EXACTLY 3 scenes. Each prompt <=30 words, focus on MOTION. Each voiceover <=18 words. Each caption <=8 words. title <=60 chars. brandColor single valid hex.`;

  let parsed: any = null;
  try {
    const raw = await aiChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 800, temperature: 0.7 }
    );
    parsed = extractJson(raw);
  } catch {
    parsed = null;
  }

  const fallback: SceneScript = {
    scenes: [
      {
        prompt: "product rotating slowly on a clean surface, soft studio lighting",
        voiceover: `Meet ${product.title.slice(0, 40)}.`,
        caption: product.title.slice(0, 24),
      },
      {
        prompt: "close-up detail shot, warm rim lighting, slow zoom in",
        voiceover: product.description?.slice(0, 80) ?? "Built to do the job right.",
        caption: product.description?.slice(0, 20) ?? "Built right",
      },
      {
        prompt: "product displayed with brand color accent, slow pan",
        voiceover: "Tap the link in bio to get yours today.",
        caption: "Link in bio",
      },
    ],
    title: product.title.slice(0, 60),
    priceText: product.price ?? "",
    cta: "Link in bio",
    brandColor: "#4f46e5",
  };

  if (!parsed || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    return fallback;
  }

  const scenes: Scene[] = parsed.scenes.slice(0, 3).map((s: any, i: number): Scene => ({
    prompt:
      typeof s.prompt === "string" && s.prompt.trim()
        ? s.prompt.trim().slice(0, 200)
        : fallback.scenes[i]?.prompt ?? fallback.scenes[0].prompt,
    voiceover:
      typeof s.voiceover === "string" && s.voiceover.trim()
        ? s.voiceover.trim().slice(0, 180)
        : fallback.scenes[i]?.voiceover ?? fallback.scenes[0].voiceover,
    caption:
      typeof s.caption === "string" && s.caption.trim()
        ? s.caption.trim().slice(0, 40)
        : fallback.scenes[i]?.caption ?? fallback.scenes[0].caption,
  }));

  while (scenes.length < 3) {
    scenes.push(fallback.scenes[scenes.length]);
  }

  return {
    scenes,
    title: sanitize(parsed.title, fallback.title, 60),
    priceText: sanitize(parsed.priceText, fallback.priceText, 40),
    cta: sanitize(parsed.cta, fallback.cta, 60),
    brandColor: sanitizeColor(parsed.brandColor) ?? fallback.brandColor,
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

function sanitize(val: any, fallback: string, maxLen: number): string {
  if (typeof val === "string" && val.trim()) return val.trim().slice(0, maxLen);
  return fallback;
}

function sanitizeColor(val: any): string | null {
  if (typeof val !== "string") return null;
  return /^#[0-9a-fA-F]{6}$/.test(val) ? val : null;
}

