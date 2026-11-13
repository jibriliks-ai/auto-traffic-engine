import { prisma } from "@/lib/prisma";

/**
 * Returns the user's affiliate tracking URL for a given offer.
 *
 * Lookup priority:
 *   1. UserTrackingLink where offerId matches the offer
 *   2. UserTrackingLink where platform matches + label resembles offer title
 *   3. Any active UserTrackingLink for this platform (fallback)
 *   4. Throw NOT_CONNECTED — caller shows "Paste your link" prompt
 *
 * No API calls. No SID. No token. The user's pasted URL is the answer.
 */
export async function getPersonalAffiliateLink(
  userId: string,
  offer: {
    platform: string;
    offerId: string;
    title?: string;
    affiliateLinkTemplate?: string | null;
  }
): Promise<string> {
  // 1. Exact offer match
  if (offer.offerId) {
    const exact = await prisma.userTrackingLink.findFirst({
      where: {
        userId,
        platform: offer.platform,
        offerId: offer.offerId,
        isActive: true,
      },
    });
    if (exact) return exact.trackingUrl;
  }

  // 2. Fuzzy match by offer title (in case user didn't set offerId)
  if (offer.title) {
    const fuzzy = await prisma.userTrackingLink.findFirst({
      where: {
        userId,
        platform: offer.platform,
        isActive: true,
        OR: [
          { label: { contains: offer.title.slice(0, 20), mode: "insensitive" } },
          { productName: { contains: offer.title.slice(0, 20), mode: "insensitive" } },
        ],
      },
    });
    if (fuzzy) return fuzzy.trackingUrl;
  }

  // 3. Fallback — any active link for this platform
  const fallback = await prisma.userTrackingLink.findFirst({
    where: { userId, platform: offer.platform, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (fallback) return fallback.trackingUrl;

  // 4. Not connected — caller shows the "paste link" modal
  throw new Error(`NOT_CONNECTED:${offer.platform}`);
}