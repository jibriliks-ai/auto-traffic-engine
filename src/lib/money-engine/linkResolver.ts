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
 *   wraps it in a cloaked /go/{slug} link (Phase 3) instead.
 * - All API keys are decrypted here only, never logged or exposed.
 */
export async function getPersonalAffiliateLink(
  userId: string,
  offer: {
    platform: string;
    offerId: string;
    affiliateLinkTemplate?: string | null;
  }
): Promise<string> {
  const account = await prisma.userAffiliateAccount.findUnique({
    where: { userId_platform: { userId, platform: offer.platform } },
  });

  if (!account || !account.isConnected) {
    throw new Error(`NOT_CONNECTED:${offer.platform}`);
  }

  // ─── Phase 2 — real platform clients go here ───

  switch (offer.platform) {
    case "impact":
      // Phase 2:
      //   decrypt account.accessTokenEncrypted + account.accountId
      //   POST https://api.impact.com/Mediapartners/{accountId}/Campaigns/{offerId}/TrackingLinks
      //   Body: { SubId1: userId }  (for click attribution)
      //   Return the TrackingURL from the response.
      throw new Error("NOT_IMPLEMENTED:impact");

    case "partnerstack":
      // Phase 2:
      //   decrypt account.apiKeyEncrypted + account.apiSecretEncrypted
      //   POST https://api.partnerstack.com/api/v2/links
      //   Body: { offer_id: offerId, partner_id: account.affiliateId, customer_id: userId }
      //   Return the url from the response.
      throw new Error("NOT_IMPLEMENTED:partnerstack");

    default:
      throw new Error(`UNKNOWN_PLATFORM:${offer.platform}`);
  }
}