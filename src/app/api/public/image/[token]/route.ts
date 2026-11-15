import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SECRET = process.env.NEXTAUTH_SECRET ?? "";

/** Sign a link ID → token that can be served publicly */
export function signLinkId(linkId: string): string {
  const payload = Buffer.from(linkId, "utf-8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(linkId)
    .digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  let linkId: string;
  try {
    linkId = Buffer.from(payload, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(linkId)
    .digest("base64url");
  try {
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }
  return linkId;
}

/**
 * Public image endpoint — used by Threads + Pinterest.
 * URL is signed (HMAC-SHA256) so the image can be fetched by external
 * platforms without a session cookie.
 */
export async function GET(
  _: Request,
  { params }: { params: { token: string } }
) {
  const linkId = verifyToken(params.token);
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