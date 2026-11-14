import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Serves the marketing image as a binary JPEG.
 * Browser caches it via Cache-Control, so the JSON list stays lean.
 */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const link = await prisma.userTrackingLink.findFirst({
    where: { id: params.id, userId },
    select: { generatedImage: true, manualImageBase64: true },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dataUrl = link.generatedImage || link.manualImageBase64;
  if (!dataUrl || !dataUrl.startsWith("data:image")) {
    return NextResponse.json({ error: "No image" }, { status: 404 });
  }

  const [meta, base64] = dataUrl.split(",");
  if (!base64) return NextResponse.json({ error: "Malformed image" }, { status: 500 });

  const mime = meta.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
  const buf = Buffer.from(base64, "base64");

  return new NextResponse(buf, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buf.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}