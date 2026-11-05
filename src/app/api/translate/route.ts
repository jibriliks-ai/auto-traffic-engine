import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Free translation via Google's public endpoint.
 * No API key, no package, works from any IP.
 */
async function googleTranslate(text: string, target: string): Promise<string> {
  // Google's endpoint handles up to ~5000 chars via GET.
  // Our texts are short (titles ≤ 100 chars, bodies ≤ 1500 chars).
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Google Translate returned HTTP ${res.status}`);
  }

  const data = await res.json();
  // Response shape: [[[translated, original, null, null, ...], ...], null, "en", ...]
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("Unexpected translation response shape");
  }

  const translated = (data[0] as any[])
    .filter((chunk) => Array.isArray(chunk) && typeof chunk[0] === "string")
    .map((chunk) => chunk[0])
    .join("");

  if (!translated.trim()) {
    throw new Error("Translation returned empty result");
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
    return NextResponse.json({ error: "Target language is required." }, { status: 400 });
  }
  if (text.length > 4500) {
    return NextResponse.json(
      { error: "Text too long for translation (max 4500 chars)." },
      { status: 400 }
    );
  }

  try {
    const translated = await googleTranslate(text, to);
    return NextResponse.json({ translated, target: to });
  } catch (e: any) {
    console.error("[translate] error:", e);
    return NextResponse.json(
      { error: `Translation failed: ${e.message ?? "unknown"}` },
      { status: 502 }
    );
  }
}