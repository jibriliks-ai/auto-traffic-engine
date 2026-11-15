import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLinkToken } from "@/lib/money-engine/publicImage";

export const runtime = "nodejs";

/**
 * Public image endpoint — used by Threads + Pinterest.
 * URL is signed (HMAC-SHA256) so external platforms can fetch without auth.
 */
export async function GET(
  _: Request,
  { params }: { params: { token: string } }
) {
  const linkId = verifyLinkToken(params.token);
  if (!linkId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const link = await prisma.userTrackingLink.findUnique({
    where: { id: linkId },
    select: { generatedImage: true, manualImageBase64: true },
  });
  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const dataUrl = link.generatedImage || link.manualImageBase64;
  if (!dataUrl || !dataUrl.startsWith("data:image")) {
    return NextResponse.json({ error: "No image" }, { status: 404 });
  }

  const [meta, base64] = dataUrl.split(",");
  if (!base64) {
    return NextResponse.json({ error: "Malformed image" }, { status: 500 });
  }
  const mime = meta.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
  const buf = Buffer.from(base64, "base64");

  return new NextResponse(buf, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buf.length),
      "Cache-Control": "public, max-age=2592000", // 30 days
    },
  });
}