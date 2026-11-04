import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { auditHtml, fetchHtml, normalizeUrl } from "@/lib/seo-audit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const url = normalizeUrl(body.url ?? "");
  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  let validUrl: URL;
  try {
    validUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(validUrl.protocol)) {
    return NextResponse.json({ error: "Only http/https URLs supported" }, { status: 400 });
  }

  try {
    const html = await fetchHtml(url);
    const result = auditHtml(html, url);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Failed to fetch URL. Check the URL and try again." },
      { status: 502 }
    );
  }
}