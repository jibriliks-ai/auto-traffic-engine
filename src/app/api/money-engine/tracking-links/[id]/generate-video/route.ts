import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkVideoLimit } from "@/lib/limits";
import { renderVideo } from "@/lib/video/renderer";
import { generateQRFile } from "@/lib/video/qrGenerator";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const plan = (session?.user as any)?.plan ?? "free";

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkVideoLimit(userId, plan);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          plan === "free"
            ? "Free plan allows 1 video total. Upgrade to Premium for unlimited."
            : "Video limit reached.",
        usage: limit,
        upgradeRequired: plan === "free",
      },
      { status: 403 }
    );
  }

  const link = await prisma.userTrackingLink.findFirst({
    where: { id: params.id, userId },
  });
  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const productImage =
    link.manualImageBase64 || link.scrapedImage || link.productImageUrl;
  if (!productImage) {
    return NextResponse.json(
      {
        error:
          "No product image available. Upload one via Edit → Upload image first.",
      },
      { status: 400 }
    );
  }

  const title = link.scrapedTitle || link.productName || link.label;
  const priceText =
    link.scrapedPrice ||
    (link.price ? `$${Number(link.price).toFixed(2)}` : "");
  const ctaText = "Link in bio 👆";
  const brandColor = "#4f46e5";

  // Generate QR from cloaked URL (optional — video still renders without it)
  let qrCodeDataUrl: string | undefined;
  if (link.shortUrl) {
    try {
      const workDir = path.join(os.tmpdir(), `video-qr-${link.id}`);
      await fs.mkdir(workDir, { recursive: true });
      const qrPath = path.join(workDir, "qr.png");
      await generateQRFile(link.shortUrl, qrPath);
      qrCodeDataUrl = `data:image/png;base64,${(
        await fs.readFile(qrPath)
      ).toString("base64")}`;
    } catch (e) {
      console.warn(`[video] QR generation failed: ${e}`);
    }
  }

  // Create the Video row so the client can poll status
  const video = await prisma.video.create({
    data: {
      userId,
      url: "pending",
      platform: "tiktok",
      status: "rendering",
      title,
      template: "ffmpeg_professional",
      productImageUrl: productImage,
      priceText,
      ctaText,
      brandColor,
      renderStartedAt: new Date(),
    },
  });

  await prisma.video.update({
    where: { id: video.id },
    data: { url: `/api/video/download/${video.id}` },
  });

  // Fire-and-forget render
  renderVideo({
    id: video.id,
    title,
    priceText,
    ctaText,
    brandColor,
    productImageUrl: productImage,
    qrCodeDataUrl,
  })
    .then(async (result) => {
      await prisma.video.update({
        where: { id: video.id },
        data: {
          status: "done",
          filePath: result.filePath,
          fileSizeBytes: result.fileSizeBytes,
          durationSeconds: result.durationSeconds,
          renderCompletedAt: new Date(),
        },
      });
      console.log(`[video] ${video.id} rendered successfully`);
    })
    .catch(async (err) => {
      console.error(`[video] Pipeline failed: ${err?.message ?? err}`);
      await prisma.video
        .update({
          where: { id: video.id },
          data: {
            status: "failed",
            error: String(err?.message ?? err).slice(0, 2000),
            renderCompletedAt: new Date(),
          },
        })
        .catch(() => {});
    });

  return NextResponse.json({ id: video.id, status: "rendering" });
}