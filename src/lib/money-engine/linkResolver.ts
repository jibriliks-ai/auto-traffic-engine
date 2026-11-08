import { prisma } from "@/lib/prisma";

/**
 * Returns a personalized affiliate link for the given user + offer.
 *
 * Phase 1: real platform clients are NOT wired up yet — every platform
 * throws NOT_IMPLEMENTED with a clear message. When you add a real
 * platform client (Phase 2), swap the throw for the actual API call.
 *
 * Security:
 * - Never returns the raw affiliate link to the frontend — the caller
 *   wraps it in a cloaked /api/r/[postId] link instead.
 * - All API keys are decrypted here only, never logged or exposed.
 */
export async function getPersonalAffiliateLink(
  userId: string,
  offer: { platform: string; offerId: string; affiliateLinkTemplate?: string | null }
): Promise<string> {
  const account = await prisma.userAffiliateAccount.findUnique({
    where: { userId_platform: { userId, platform: offer.platform } },
  });

  if (!account || !account.isConnected) {
    throw new Error(`NOT_CONNECTED:${offer.platform}`);
  }

  // ─── Phase 2 — real platform clients go here ───
  // Each case will decrypt the required key, call the platform API,
  // and return the generated link. For now, every case throws a
  // clear NOT_IMPLEMENTED error so nothing breaks silently.

  switch (offer.platform) {
    case "warriorplus":
      // Phase 2: GET https://warriorplus.com/api/v1/links?offer_id=...&aff=...
      throw new Error("NOT_IMPLEMENTED:warriorplus");
    case "jvzoo":
      throw new Error("NOT_IMPLEMENTED:jvzoo");
    case "impact":
    case "jumia":
    case "konga":
      throw new Error(`NOT_IMPLEMENTED:${offer.platform}`);
    case "partnerstack":
      throw new Error("NOT_IMPLEMENTED:partnerstack");
    case "temu":
      throw new Error("NOT_IMPLEMENTED:temu");
    case "aliexpress":
      throw new Error("NOT_IMPLEMENTED:aliexpress");
    default:
      throw new Error(`UNKNOWN_PLATFORM:${offer.platform}`);
  }
}