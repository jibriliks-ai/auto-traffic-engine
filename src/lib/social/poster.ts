import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/money-engine/crypto";
import type { SocialPlatform, PostPayload, PostResult } from "./types";
import { postToTelegram } from "./platforms/telegram";
import { postToBluesky } from "./platforms/bluesky";
import { postToMastodon } from "./platforms/mastodon";
import { postToFacebook } from "./platforms/facebook";
import { postToX } from "./platforms/x";

export async function saveConnection(
  userId: string,
  platform: SocialPlatform,
  accountName: string,
  credentials: Record<string, string>
): Promise<void> {
  const encrypted = encryptSecret(JSON.stringify(credentials));
  await prisma.socialConnection.upsert({
    where: { userId_platform: { userId, platform } },
    create: {
      userId,
      platform,
      accountName,
      credentials: encrypted,
      isConnected: true,
      lastVerifiedAt: new Date(),
    },
    update: {
      accountName,
      credentials: encrypted,
      isConnected: true,
      lastVerifiedAt: new Date(),
    },
  });
}

export async function deleteConnection(
  userId: string,
  platform: SocialPlatform
): Promise<void> {
  await prisma.socialConnection.deleteMany({ where: { userId, platform } });
}

export async function getConnections(userId: string) {
  const rows = await prisma.socialConnection.findMany({ where: { userId } });
  return rows.map((r) => ({
    platform: r.platform as SocialPlatform,
    accountName: r.accountName,
    isConnected: r.isConnected,
    lastVerifiedAt: r.lastVerifiedAt,
  }));
}

async function postToSinglePlatform(
  userId: string,
  platform: SocialPlatform,
  payload: PostPayload
): Promise<PostResult> {
  const conn = await prisma.socialConnection.findUnique({
    where: { userId_platform: { userId, platform } },
  });
  if (!conn || !conn.isConnected) {
    return { ok: false, error: `${platform} not connected` };
  }

  let creds: any;
  try {
    creds = JSON.parse(decryptSecret(conn.credentials));
  } catch {
    return { ok: false, error: `${platform} credentials corrupted — reconnect` };
  }

  switch (platform) {
    case "telegram":
      return postToTelegram(creds, payload);
    case "bluesky":
      return postToBluesky(creds, payload);
    case "mastodon":
      return postToMastodon(creds, payload);
    case "facebook":
      return postToFacebook(creds, payload);
    case "x":
      return postToX(creds, payload);
    default:
      return { ok: false, error: `Unknown platform: ${platform}` };
  }
}

export interface PostAllResult {
  platform: SocialPlatform;
  result: PostResult;
}

/**
 * Post to multiple platforms in parallel.
 * Saves a SocialPost row per platform for history + retry tracking.
 */
export async function postToAll(
  userId: string,
  platforms: SocialPlatform[],
  payload: PostPayload,
  offerId?: string
): Promise<PostAllResult[]> {
  const results = await Promise.all(
    platforms.map(async (platform) => {
      const result = await postToSinglePlatform(userId, platform, payload);
      // Persist result
      try {
        await prisma.socialPost.create({
          data: {
            userId,
            offerId: offerId ?? null,
            platform,
            caption: payload.caption.slice(0, 4000),
            imageBase64: payload.imageBuffer
              ? `data:image/jpeg;base64,${payload.imageBuffer.toString("base64")}`
              : null,
            status: result.ok ? "posted" : "failed",
            postedAt: result.ok ? new Date() : null,
            platformPostId: result.platformPostId ?? null,
            platformUrl: result.platformUrl ?? null,
            error: result.error ?? null,
          },
        });
      } catch {
        /* non-fatal */
      }
      return { platform, result };
    })
  );
  return results;
}