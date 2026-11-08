import { prisma } from "@/lib/prisma";
import type { PlatformId, ProductType, RawOffer, SyncResult } from "./types";
import {
  passesDigitalFilter,
  passesPhysicalFilter,
  scoreOffer,
} from "./scoring";
import { MOCK_DIGITAL, MOCK_PHYSICAL } from "./mockData";

/**
 * Only two networks per Final Clean Build v2 spec.
 * Jumia, AliExpress, Walmart, Adidas, Konga = brands inside Impact.
 * Monday, HubSpot, Slack, Webflow = brands inside PartnerStack.
 */
const DIGITAL_PLATFORMS: PlatformId[] = ["impact", "partnerstack"];
const PHYSICAL_PLATFORMS: PlatformId[] = ["impact"];

function hasKey(platform: PlatformId): boolean {
  if (platform === "impact") {
    return Boolean(process.env.IMPACT_TOKEN && process.env.IMPACT_ACCOUNT_ID);
  }
  if (platform === "partnerstack") {
    return Boolean(
      process.env.PARTNERSTACK_PUBLIC_KEY && process.env.PARTNERSTACK_SECRET_KEY
    );
  }
  return false;
}

async function fetchForPlatform(
  platform: PlatformId,
  productType: ProductType
): Promise<{ offers: RawOffer[]; mock: boolean }> {
  if (!hasKey(platform)) {
    // Mock fallback — spec §8 requires the demo dashboard to work with no keys.
    const pool = productType === "digital" ? MOCK_DIGITAL : MOCK_PHYSICAL;
    const filtered = pool.filter((o) => o.platform === platform);
    const offers =
      filtered.length > 0
        ? filtered
        : (productType === "digital" ? MOCK_DIGITAL : MOCK_PHYSICAL).slice(0, 2);
    return { offers, mock: true };
  }

  // ─── Phase 2 — real platform fetchers go here ───
  // Impact:
  //   GET https://api.impact.com/Mediapartners/{ACCOUNT_ID}/Campaigns
  //   Auth: Basic base64(SID:TOKEN)
  //   Map campaigns → RawOffer[] (Jumia, Konga, Walmart, Adidas, etc.)
  //
  // PartnerStack:
  //   GET https://api.partnerstack.com/api/v2/offers
  //   Auth: Bearer PARTNERSTACK_API_KEY, X-Partner-Id header
  //   Map offers → RawOffer[] (Monday, HubSpot, Notion, etc.)
  //
  // Both return normalized RawOffer[] — the caller handles filtering + scoring.
  throw new Error(`NOT_IMPLEMENTED:${platform}:fetch`);
}

async function syncOne(
  platform: PlatformId,
  productType: ProductType
): Promise<SyncResult> {
  try {
    const { offers, mock } = await fetchForPlatform(platform, productType);

    const passing = offers.filter((o) =>
      productType === "digital"
        ? passesDigitalFilter(o)
        : passesPhysicalFilter(o)
    );

    const scored = passing.map(scoreOffer);

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
      kept: passing.length,
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