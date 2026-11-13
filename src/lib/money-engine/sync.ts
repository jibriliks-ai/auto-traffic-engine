import { prisma } from "@/lib/prisma";
import type { PlatformId, ProductType, RawOffer, SyncResult } from "./types";
import { scoreOffer } from "./scoring";
import { MOCK_DIGITAL, MOCK_PHYSICAL } from "./mockData";

/**
 * Only 2 platforms per spec. Both are connected via the paste-tracking-link
 * method — no API keys needed. `syncAll()` now just loads the mock catalog
 * into the DB so users have offers to browse and generate content from.
 * Their real affiliate link comes from `UserTrackingLink`, not from this sync.
 */
const DIGITAL_PLATFORMS: PlatformId[] = ["impact", "warriorplus"];
const PHYSICAL_PLATFORMS: PlatformId[] = ["impact"];

async function fetchForPlatform(
  platform: PlatformId,
  productType: ProductType
): Promise<{ offers: RawOffer[]; mock: boolean }> {
  // No real API calls anymore — always use mock catalog.
  // Real affiliate links are supplied by the user via UserTrackingLink.
  const pool = productType === "digital" ? MOCK_DIGITAL : MOCK_PHYSICAL;
  const filtered = pool.filter((o) => o.platform === platform);
  const offers =
    filtered.length > 0
      ? filtered
      : (productType === "digital" ? MOCK_DIGITAL : MOCK_PHYSICAL).slice(0, 2);
  return { offers, mock: true };
}

async function syncOne(
  platform: PlatformId,
  productType: ProductType
): Promise<SyncResult> {
  try {
    const { offers, mock } = await fetchForPlatform(platform, productType);

    // Real Impact data doesn't have EPC/refund info at campaign level. We
    // accept all offers from the mock catalog without applying strict filters,
    // since these are curated demo entries already.
    const scored = offers.map(scoreOffer);

    for (const o of scored) {
      const data = {
        productType: o.productType,
        platform: o.platform,
        offerId: o.offerId,
        title: o.title,
        vendor: o.vendor ?? null,
        category: o.category ?? null,
        frontEndPrice: o.frontEndPrice ?? null,
        originalPrice: o.originalPrice ?? null,
        funnelMaxPrice: o.funnelMaxPrice ?? null,
        commissionPct: o.commissionPct ?? null,
        commissionAmount: o.commissionAmount ?? null,
        commissionType: o.commissionType ?? "CPS",
        epc: o.epc ?? 0,
        conversionRate: o.conversionRate ?? 0,
        gravity: o.gravity ?? 0,
        refundRate: o.refundRate ?? 0,
        orders7days: o.orders7days ?? 0,
        rating: o.rating ?? 0,
        isRecurring: o.isRecurring ?? false,
        recurringMonths: o.recurringMonths ?? 0,
        salesPageUrl: o.salesPageUrl ?? null,
        imageUrl: o.imageUrl ?? null,
        videoUrl: o.videoUrl ?? null,
        affiliateLinkTemplate: o.affiliateLinkTemplate ?? null,
        swipeCopy: o.swipeCopy ?? null,
        status: o.status,
        score: o.score,
        priority: o.priority,
        lastSyncedAt: new Date(),
      };
      await prisma.moneyEngineOffer.upsert({
        where: {
          platform_offerId: { platform: o.platform, offerId: o.offerId },
        },
        create: data,
        update: data,
      });
    }

    return {
      platform,
      productType,
      fetched: offers.length,
      kept: scored.length,
      mock,
    };
  } catch (e: any) {
    return {
      platform,
      productType,
      fetched: 0,
      kept: 0,
      mock: false,
      error: e?.message ?? "unknown error",
    };
  }
}

export async function syncAll(): Promise<{
  results: SyncResult[];
  totalKept: number;
  totalFetched: number;
}> {
  const jobs: Array<Promise<SyncResult>> = [
    ...DIGITAL_PLATFORMS.map((p) => syncOne(p, "digital")),
    ...PHYSICAL_PLATFORMS.map((p) => syncOne(p, "physical")),
  ];
  const results = await Promise.all(jobs);
  return {
    results,
    totalKept: results.reduce((s, r) => s + r.kept, 0),
    totalFetched: results.reduce((s, r) => s + r.fetched, 0),
  };
}