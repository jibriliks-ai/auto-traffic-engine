import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkVideoLimit } from "@/lib/limits";
import { scrapeUrl } from "@/lib/video/urlScraper";
import { generateSceneScript } from "@/lib/video/sceneScript";
import { createOrReuseLink } from "@/lib/money-engine/linkCloaker";
import { generateQRFile } from "@/lib/video/qrGenerator";
import { renderVideo } from "@/lib/video/renderer";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const plan = (session?.user as any)?.plan ?? "free";

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized — sign out and back in." },
      { status: 401 }
    );
  }

  const limit = await checkVideoLimit(userId, plan);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          plan === "free"
            ? "Free plan allows 1 video. Upgrade to Premium for unlimited."
            : "Your plan does not allow more videos.",
        usage: limit,
        upgradeRequired: plan === "free",
      },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const urlInput = String(body.url ?? "").trim();
  const offerId = String(body.offerId ?? "").trim();

  let productUrl = urlInput;
  let offerRow: any = null;

  if (!productUrl && offerId) {
    offerRow = await prisma.moneyEngineOffer.findUnique({
      where: { id: offerId },
    });
    if (!offerRow) {
      return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    }
    productUrl = offerRow.salesPageUrl ?? "";
  }

  if (!productUrl || !/^https?:\/\//.test(productUrl)) {
    return NextResponse.json(
      { error: "Provide a product URL or offerId." },
      { status: 400 }
    );
  }

  const video = await prisma.video.create({
    data: {
      userId,
      url: "pending",
      platform: "tiktok",
      status: "rendering",
      title: "Rendering…",
      template: "ffmpeg_professional",
      productImageUrl: "",
      renderStartedAt: new Date(),
    },
  });

  await prisma.video.update({
    where: { id: video.id },
    data: { url: `/api/video/download/${video.id}` },
  });

  runPipeline({
    userId,
    videoId: video.id,
    productUrl,
    offerId: offerId || undefined,
    offerRow,
  })
    .then(async (result) => {
      await prisma.video.update({
        where: { id: video.id },
        data: {
          status: "done",
          title: result.title,
          script: result.script,
          productImageUrl: result.productImage,
          priceText: result.priceText,
          ctaText: result.cta,
          brandColor: result.brandColor,
          filePath: result.filePath,
          fileSizeBytes: result.fileSizeBytes,
          durationSeconds: 20,
          renderCompletedAt: new Date(),
        },
      });
      console.log(`[video] ${video.id} rendered successfully`);
    })
    .catch(async (err) => {
      console.error(`[video] Pipeline failed for ${video.id}:`, err?.message ?? err);
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

interface PipelineArgs {
  userId: string;
  videoId: string;
  productUrl: string;
  offerId?: string;
  offerRow: any | null;
}

interface PipelineResult {
  title: string;
  script: string;
  productImage: string;
  priceText: string;
  cta: string;
  brandColor: string;
  filePath: string;
  fileSizeBytes: number;
}

async function runPipeline(args: PipelineArgs): Promise<PipelineResult> {
  const workDir = path.join(os.tmpdir(), `video-${args.videoId}`);
  await fs.mkdir(workDir, { recursive: true });

  let productTitle: string;
  let productImage: string;
  let productPrice: string;
  let productBrand: string;
  let productDescription: string;

  if (args.offerRow) {
    productTitle = args.offerRow.title;
    productImage = args.offerRow.imageUrl ?? "";
    productPrice = args.offerRow.frontEndPrice
      ? `$${Number(args.offerRow.frontEndPrice).toFixed(2)}`
      : "";
    productBrand = args.offerRow.vendor ?? "product";
    productDescription = args.offerRow.swipeCopy ?? "";
  } else {
    const scraped = await scrapeUrl(args.productUrl);
    if (!scraped.imageUrl) {
      throw new Error(
        "No product image found at this URL. Try a specific product page."
      );
    }
    productTitle = scraped.title;
    productImage = scraped.imageUrl;
    productPrice = scraped.price ?? "";
    productBrand = scraped.brand ?? "product";
    productDescription = scraped.description;
  }

  if (!productImage) {
    throw new Error("Product image could not be resolved.");
  }

  // AI script for title/CTA/brand color (light usage)
  const script = await generateSceneScript({
    url: args.productUrl,
    title: productTitle,
    description: productDescription,
    imageUrl: productImage,
    price: productPrice || null,
    brand: productBrand,
  });

  // Cloaked link + QR
  const link = await createOrReuseLink({
    userId: args.userId,
    offerId: args.offerId,
    sourceType: "video",
    platform: "tiktok",
    destinationUrl: args.productUrl,
    brandHint: productBrand,
    productHint: productTitle.split(" ").slice(0, 3).join(" "),
  });

  const qrPath = path.join(workDir, "qr.png");
  await generateQRFile(link.shortUrl, qrPath);
  const qrDataUrl = `data:image/png;base64,${(
    await fs.readFile(qrPath)
  ).toString("base64")}`;

  console.log(`[video] Rendering FFmpeg for videoId=${args.videoId}`);
  const result = await renderVideo({
    id: args.videoId,
    title: script.title || productTitle.slice(0, 60),
    priceText: script.priceText || productPrice || "",
    ctaText: script.cta || "Link in bio",
    brandColor: script.brandColor || "#4f46e5",
    productImageUrl: productImage,
    qrCodeDataUrl: qrDataUrl,
  });

  console.log(
    `[video] Render complete: ${result.filePath} (${(
      result.fileSizeBytes / 1024 / 1024
    ).toFixed(2)} MB)`
  );

  return {
    title: script.title,
    script: JSON.stringify(script),
    productImage,
    priceText: script.priceText,
    cta: script.cta,
    brandColor: script.brandColor,
    filePath: result.filePath,
    fileSizeBytes: result.fileSizeBytes,
  };
}