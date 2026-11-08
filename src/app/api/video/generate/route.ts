import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkVideoLimit } from "@/lib/limits";
import { renderVideo } from "@/lib/video/renderer";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const plan = (session?.user as any)?.plan ?? "free";

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized — session missing user id. Sign out and back in." },
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
  const title = String(body.title ?? "").trim();
  const priceText = String(body.priceText ?? "").trim();
  const ctaText = String(body.ctaText ?? "").trim();
  const brandColor = String(body.brandColor ?? "#4f46e5").trim();
  const productImageUrl = String(body.productImageUrl ?? "").trim();

  if (!title || title.length < 2) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (!productImageUrl) {
    return NextResponse.json({ error: "Product image is required." }, { status: 400 });
  }
  if (!/^data:image\/|^https?:\/\//.test(productImageUrl)) {
    return NextResponse.json(
      { error: "Product image must be a URL or uploaded file." },
      { status: 400 }
    );
  }

  const video = await prisma.video.create({
    data: {
      userId,
      url: "pending",
      platform: "tiktok",
      status: "rendering",
      title,
      template: "product_promo",
      productImageUrl,
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

  renderVideo({
    id: video.id,
    title,
    priceText,
    ctaText,
    brandColor,
    productImageUrl,
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
    })
    .catch(async (err) => {
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