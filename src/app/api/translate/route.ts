import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Provider 1: SimplyTranslate AI
 * Free, no API key, 100 req/min, 5000 chars/req.
 * Docs: https://simplytranslate.ai/api-docs
 */
async function translateWithSimplyTranslate(
  text: string,
  target: string
): Promise<string> {
  const res = await fetch("https://api.simplytranslate.ai/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "AutoTrafficEngine/1.0",
    },
    body: JSON.stringify({
      text,
      from: "auto", // auto-detect source language
      to: target,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `SimplyTranslate HTTP ${res.status}: ${errText.slice(0, 200)}`
    );
  }

  const data = await res.json();
  if (!data?.result || typeof data.result !== "string") {
    throw new Error("SimplyTranslate returned an unexpected response shape.");
  }

  return data.result;
}

/**
 * Provider 2 (Fallback): MyMemory
 * Free, no API key, 5000 chars/day anonymous (50k with email).
 * Docs: https://mymemory.translated.net/doc/spec.php
 */
async function translateWithMyMemory(
  text: string,
  target: string
): Promise<string> {
  // Optional: pass your email as `de` to get 50k chars/day instead of 5k
  const email = process.env.MYMEMORY_EMAIL ?? "";
  const langPair = `auto|${target}`;
  const url =
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text
    )}&langpair=${encodeURIComponent(langPair)}` +
    (email ? `&de=${encodeURIComponent(email)}` : "");

  const res = await fetch(url, {
    headers: { "User-Agent": "AutoTrafficEngine/1.0" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`MyMemory HTTP ${res.status}`);
  }

  const data = await res.json();
  const translated = data?.responseData?.translatedText;

  if (!translated || typeof translated !== "string") {
    throw new Error("MyMemory returned an unexpected response shape.");
  }

  // MyMemory sometimes returns "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY"
  if (translated.toUpperCase().includes("MYMEMORY WARNING")) {
    throw new Error("MyMemory daily limit reached.");
  }

  return translated;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const text = (body.text ?? "").toString().trim();
  const to = (body.to ?? "").toString().trim();

  if (!text) {
    return NextResponse.json({ error: "Text is required." }, { status: 400 });
  }
  if (!to) {
    return NextResponse.json(
      { error: "Target language is required." },
      { status: 400 }
    );
  }
  if (text.length > 4500) {
    return NextResponse.json(
      { error: "Text too long for translation (max 4500 chars)." },
      { status: 400 }
    );
  }

  let translated: string | null = null;
  let providerUsed = "";
  const errors: string[] = [];

  // Try Provider 1: SimplyTranslate AI
  try {
    translated = await translateWithSimplyTranslate(text, to);
    providerUsed = "SimplyTranslate";
  } catch (e: any) {
    errors.push(`SimplyTranslate: ${e.message}`);
    console.warn(`[translate] SimplyTranslate failed: ${e.message}`);
  }

  // Fallback to Provider 2: MyMemory
  if (!translated) {
    try {
      translated = await translateWithMyMemory(text, to);
      providerUsed = "MyMemory";
    } catch (e: any) {
      errors.push(`MyMemory: ${e.message}`);
      console.warn(`[translate] MyMemory failed: ${e.message}`);
    }
  }

  if (!translated) {
    console.error("[translate] All providers failed:", errors);
    return NextResponse.json(
      {
        error: `All translation providers failed. Try again in a moment.`,
        details: errors,
      },
      { status: 502 }
    );
  }

  console.log(`[translate] Translated to ${to} via ${providerUsed}`);
  return NextResponse.json({
    translated,
    target: to,
    provider: providerUsed,
  });
}