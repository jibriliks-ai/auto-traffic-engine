import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/money-engine/crypto";
import { generateSnippets } from "@/lib/money-engine/snippetGenerator";
import { generateSocialImage } from "@/lib/social/imageGenerator";
import { postToThreadsWithImage } from "@/lib/social/platforms/threads";
import { postToPinterest } from "@/lib/social/platforms/pinterest";
import {
  lemmyLogin,
  lemmyFindCommunity,
  lemmyCreatePost,
} from "@/lib/money-engine/lemmy/client";
import { signLinkId } from "@/lib/money-engine/publicImage";

export const runtime = "nodejs";
export const maxDuration = 120;

const APP_DOMAIN =
  process.env.NEXTAUTH_URL ?? "https://growthbot-aprv.onrender.com";

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "post"
  );
}

async function ensureContent(link: any): Promise<any> {
  // Reuse cached snippets if present
  if (link.generatedSnippets) {
    try {
      const parsed = JSON.parse(link.generatedSnippets);
      if (parsed.lemmy && parsed.pinterest && parsed.threads) return parsed;
    } catch {}
  }

  // Otherwise generate fresh
  const snippets = await generateSnippets({
    productName: link.scrapedTitle || link.productName || link.label,
    brand: link.scrapedBrand,
    price:
      link.scrapedPrice ||
      (link.price ? `$${Number(link.price).toFixed(2)}` : null),
    originalPrice: link.originalPrice
      ? `$${Number(link.originalPrice).toFixed(2)}`
      : null,
    description: link.scrapedDescription || link.description,
    category: link.category,
    merchantUrl: link.merchantUrl,
    cloakedUrl: link.shortUrl,
  });

  // Persist so we don't regenerate next cycle
  await prisma.userTrackingLink.update({
    where: { id: link.id },
    data: { generatedSnippets: JSON.stringify(snippets) },
  });

  return snippets;
}

async function ensureImage(link: any): Promise<string | null> {
  if (link.generatedImage) return link.generatedImage;

  const productImage =
    link.manualImageBase64 || link.scrapedImage || link.productImageUrl;
  if (!productImage) return null;

  try {
    const priceText =
      link.scrapedPrice || (link.price ? `$${Number(link.price).toFixed(2)}` : "");
    const original = link.originalPrice
      ? `$${Number(link.originalPrice).toFixed(2)}`
      : undefined;
    const discount = computeDiscount(priceText, original ?? null);

    const { dataUrl } = await generateSocialImage({
      productImageUrl: productImage,
      title: link.scrapedTitle || link.productName || link.label,
      price: priceText,
      originalPrice: original,
      brandName: link.scrapedBrand ?? undefined,
      ctaText: "Shop now 👆",
      brandColor: "#4f46e5",
      badge: discount ? `${discount}% OFF` : "NEW",
      urgencyLine: "Tap the link in bio to grab yours",
    });

    await prisma.userTrackingLink.update({
      where: { id: link.id },
      data: { generatedImage: dataUrl, generatedAt: new Date() },
    });

    return dataUrl;
  } catch (e: any) {
    console.warn(`[autopilot] Image gen failed: ${e?.message}`);
    return null;
  }
}

function computeDiscount(
  price: string | null,
  original: string | null
): number | null {
  if (!price || !original) return null;
  const p = Number(String(price).replace(/[^0-9.]/g, ""));
  const o = Number(String(original).replace(/[^0-9.]/g, ""));
  if (!p || !o || o <= p) return null;
  return Math.round((1 - p / o) * 100);
}

interface PlatformResult {
  platform: string;
  ok: boolean;
  url?: string;
  id?: string;
  error?: string;
}

async function runAutopilotForUser(
  userId: string
): Promise<{ skipped?: string; results: PlatformResult[] }> {
  const settings = await prisma.autoPilotSettings.findUnique({
    where: { userId },
  });
  if (!settings || !settings.isEnabled) {
    return { skipped: "disabled", results: [] };
  }

  const platforms: string[] = JSON.parse(settings.platforms);

  // Dedup: has this user posted in the last 2 hours?
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const recent = await prisma.autoMoneyPostLog.count({
    where: { userId, postedAt: { gte: twoHoursAgo } },
  });
  if (recent > 0) return { skipped: "recently posted", results: [] };

  // Pick the least-recently-auto-posted link
  const link = await prisma.userTrackingLink.findFirst({
    where: { userId, isActive: true, shortUrl: { not: null } },
    orderBy: [
      { lastAutoPostedAt: { sort: "asc", nulls: "first" } },
      { createdAt: "desc" },
    ],
  });
  if (!link) return { skipped: "no active links", results: [] };

  const snippets = await ensureContent(link);
  const imageDataUrl = await ensureImage(link);
  const publicImageUrl = imageDataUrl
    ? `${APP_DOMAIN}/api/public/image/${signLinkId(link.id)}`
    : undefined;

  const results: PlatformResult[] = [];

  // ── 1. Lemmy (real instance OR QAPost clone fallback) ──
  if (platforms.includes("lemmy")) {
    try {
      const lemmyAccount = await prisma.userLemmyAccount.findUnique({
        where: { userId },
      });

      const lemmyTitle =
        snippets.lemmy?.title ||
        `${link.scrapedTitle || link.productName} — worth a look?`;
      const lemmyBody =
        snippets.lemmy?.body || `${link.shortUrl}\n\nWorth checking out.`;

      if (lemmyAccount?.isActive) {
        const community =
          settings.lemmyCommunity || lemmyAccount.defaultCommunity || "test";

        let jwt: string;
        try {
          if (
            lemmyAccount.jwtEncrypted &&
            lemmyAccount.jwtExpiresAt &&
            lemmyAccount.jwtExpiresAt > new Date()
          ) {
            jwt = decryptSecret(lemmyAccount.jwtEncrypted);
          } else {
            throw new Error("jwt expired");
          }
        } catch {
          const password = decryptSecret(lemmyAccount.passwordEncrypted);
          const login = await lemmyLogin(
            lemmyAccount.instanceUrl,
            lemmyAccount.username,
            password
          );
          jwt = login.jwt;
          const { encryptSecret } = await import("@/lib/money-engine/crypto");
          await prisma.userLemmyAccount.update({
            where: { userId },
            data: {
              jwtEncrypted: encryptSecret(jwt),
              jwtExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              lastVerifiedAt: new Date(),
            },
          });
        }

        const communityId = await lemmyFindCommunity(
          lemmyAccount.instanceUrl,
          jwt,
          community
        );
        const r = await lemmyCreatePost(lemmyAccount.instanceUrl, jwt, {
          title: lemmyTitle,
          body: lemmyBody,
          communityId,
          url: link.shortUrl ?? undefined,
        });
        results.push({
          platform: "lemmy",
          ok: true,
          url: r.postUrl,
          id: String(r.postId),
        });
      } else {
        // Fallback: post to Q&A Clone (QAPost table)
        const qaSlug = `${slugify(lemmyTitle)}-${Math.random()
          .toString(36)
          .slice(2, 7)}`;
        const qa = await prisma.qAPost.create({
          data: {
            slug: qaSlug,
            userId,
            title: lemmyTitle.slice(0, 250),
            body: lemmyBody,
            sourceUrl: link.shortUrl || "",
            sourcePlatform: "AutoPilot",
            status: "published",
          },
        });
        results.push({
          platform: "lemmy",
          ok: true,
          url: `${APP_DOMAIN}/qa/${qa.slug}`,
          id: qa.id,
        });
      }
    } catch (e: any) {
      results.push({
        platform: "lemmy",
        ok: false,
        error: String(e?.message ?? e).slice(0, 400),
      });
    }
  }

  // ── 2. Threads ──
  if (platforms.includes("threads") && publicImageUrl) {
    try {
      const conn = await prisma.socialConnection.findUnique({
        where: { userId_platform: { userId, platform: "threads" } },
      });
      if (conn?.isConnected) {
        const creds = JSON.parse(decryptSecret(conn.credentials));
        const threadsText =
          snippets.threads?.tip ||
          snippets.threads?.question ||
          `Just found ${link.scrapedTitle || link.productName}. Check it: ${link.shortUrl}`;
        const r = await postToThreadsWithImage(
          { userId: creds.userId, accessToken: creds.accessToken },
          { text: threadsText, imageUrl: publicImageUrl }
        );
        results.push({
          platform: "threads",
          ok: r.ok,
          url: r.platformUrl,
          id: r.platformPostId,
          error: r.error,
        });
      } else {
        results.push({
          platform: "threads",
          ok: false,
          error: "not connected",
        });
      }
    } catch (e: any) {
      results.push({
        platform: "threads",
        ok: false,
        error: String(e?.message ?? e).slice(0, 400),
      });
    }
  }

  // ── 3. Pinterest ──
  if (platforms.includes("pinterest") && publicImageUrl) {
    try {
      const conn = await prisma.socialConnection.findUnique({
        where: { userId_platform: { userId, platform: "pinterest" } },
      });
      if (conn?.isConnected) {
        const creds = JSON.parse(decryptSecret(conn.credentials));
        const pinTitle =
          snippets.pinterest?.title ||
          `${link.scrapedTitle || link.productName}`.slice(0, 100);
        const pinDescription =
          snippets.pinterest?.description ||
          `${link.scrapedTitle || link.productName}. Details: ${link.shortUrl}`;
        const boardId = settings.pinterestBoard || creds.boardId;
        const r = await postToPinterest(
          { accessToken: creds.accessToken, boardId },
          { caption: pinDescription, title: pinTitle, imageUrl: publicImageUrl }
        );
        results.push({
          platform: "pinterest",
          ok: r.ok,
          url: r.platformUrl,
          id: r.platformPostId,
          error: r.error,
        });
      } else {
        results.push({
          platform: "pinterest",
          ok: false,
          error: "not connected",
        });
      }
    } catch (e: any) {
      results.push({
        platform: "pinterest",
        ok: false,
        error: String(e?.message ?? e).slice(0, 400),
      });
    }
  }

  // Update tracking
  const anyOk = results.some((r) => r.ok);
  await prisma.userTrackingLink.update({
    where: { id: link.id },
    data: {
      lastAutoPostedAt: new Date(),
      autoPostCount: { increment: 1 },
    },
  });

  // Log each result
  for (const r of results) {
    await prisma.autoMoneyPostLog
      .create({
        data: {
          userId,
          trackingLinkId: link.id,
          platform: r.platform,
          title:
            (r.platform === "lemmy"
              ? snippets.lemmy?.title
              : r.platform === "pinterest"
              ? snippets.pinterest?.title
              : snippets.threads?.tip) || link.productName,
          body: JSON.stringify(
            r.platform === "lemmy"
              ? snippets.lemmy
              : r.platform === "pinterest"
              ? snippets.pinterest
              : snippets.threads
          ).slice(0, 8000),
          url: r.url,
          externalId: r.id,
          community:
            r.platform === "lemmy" ? settings.lemmyCommunity || null : null,
          status: r.ok ? "posted" : "failed",
          error: r.error,
        },
      })
      .catch(() => {});
  }

  // Update autopilot run status
  await prisma.autoPilotSettings.update({
    where: { userId },
    data: {
      lastRunAt: new Date(),
      lastRunStatus: anyOk
        ? results.every((r) => r.ok)
          ? "success"
          : "partial"
        : "failed",
      lastRunError: anyOk
        ? null
        : results.find((r) => r.error)?.error ?? "all platforms failed",
      totalPostsMade: { increment: results.filter((r) => r.ok).length },
    },
  });

  return { results };
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const out = await runAutopilotForUser(userId);
    return NextResponse.json({ ok: true, ...out });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Autopilot run failed" },
      { status: 500 }
    );
  }
}