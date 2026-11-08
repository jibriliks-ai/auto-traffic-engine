import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const video = await prisma.video.findFirst({
    where: { id: params.id, userId },
    select: { filePath: true, status: true, title: true },
  });
  if (!video || video.status !== "done" || !video.filePath) {
    return NextResponse.json({ error: "Video not ready" }, { status: 404 });
  }

  try {
    const data = await fs.readFile(video.filePath);
    const safeTitle = (video.title ?? "video").replace(/[^a-z0-9]/gi, "-").slice(0, 40);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(data.byteLength),
        "Content-Disposition": `attachment; filename="${safeTitle}.mp4"`,
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Video file expired (server restarted). Generate a new one - downloads work only while the server is up.",
      },
      { status: 410 }
    );
  }
}
