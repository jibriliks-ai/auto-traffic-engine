import type { PlatformId, ProductType, RawOffer, SyncResult } from "./types";
import {
  passesDigitalFilter,
  passesPhysicalFilter,
  scoreOffer,
} from "./scoring";
import { MOCK_DIGITAL, MOCK_PHYSICAL } from "./mockData";

/**
 * Phase 1: fetches mock data whenever the platform's API key is absent.
 * Phase 2: real fetchers replace the `fetchMock*` calls below.
 *
 * Whatever the source, the output goes through:
 *   1. keep-filter (Part 4 of spec)
 *   2. scoring
 *   3. Prisma upsert (deduped by platform + offerId)
 */

const DIGITAL_PLATFORMS: PlatformId[] = [
  "warriorplus",
  "jvzoo",
  "impact",
  "partnerstack",
];
const PHYSICAL_PLATFORMS: PlatformId[] = [
  "temu",
  "aliexpress",
  "jumia",
  "konga",
];

function hasKey(platform: PlatformId): boolean {
  switch (platform) {
    case "warriorplus": return Boolean(process.env.WARRIORPLUS_API_KEY);
    case "jvzoo": return Boolean(process.env.JVZOO_API_KEY && process.env.JVZOO_SECRET);
    case "impact": return Boolean(process.env.IMPACT_TOKEN && process.env.IMPACT_ACCOUNT_ID);
    case "partnerstack": return Boolean(process.env.PARTNERSTACK_PUBLIC_KEY && process.env.PARTNERSTACK_SECRET_KEY);
    case "temu": return Boolean(process.env.TEMU_AFFILIATE_KEY && process.env.TEMU_AFFILIATE_SECRET);
    case "aliexpress": return Boolean(process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_APP_SECRET);
    case "jumia": return Boolean(process.env.IMPACT_TOKEN); // Jumia via Impact
    case "konga": return Boolean(process.env.IMPACT_TOKEN); // Konga via Impact
  }
}

async function fetchForPlatform(
  platform: PlatformId,
  productType: ProductType
): Promise<{ offers: RawOffer[]; mock: boolean }> {
  if (!hasKey(platform)) {
    // Mock fallback — spec Part 8 requires this.
    const pool = productType === "digital" ? MOCK_DIGITAL : MOCK_PHYSICAL;
    const filtered = pool.filter((o) => o.platform === platform);
    // If we don't have a mock for this exact platform, return a rotating slice
    const offers =
      filtered.length > 0
        ? filtered
        : (productType === "digital" ? MOCK_DIGITAL : MOCK_PHYSICAL).slice(0, 2);
    return { offers, mock: true };
  }

  // ─── Phase 2 — real platform fetchers go here ───
  // Each block decrypts its API key, calls the platform endpoint,
  // normalizes into RawOffer[], and returns. Throws are caught by
  // the caller and recorded in failedSources.
  throw new Error(`NOT_IMPLEMENTED:${platform}:fetch`);
}

async function syncOne(
  platform: PlatformId,
  productType: ProductType
): Promise<SyncResult> {
  try {
    const { offers, mock } = await fetchForPlatform(platform, productType);

    const passing = offers.filter((o) =>
      productType === "digital" ? passesDigitalFilter(o) : passesPhysicalFilter(o)
    );

    const scored = passing.map(scoreOffer);

    // Upsert each offer — deduped by (platform, offerId)
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
        where: { platform_offerId: { platform: o.platform, offerId: o.offerId } },
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

// Prisma singleton is imported implicitly via the top-level import
import { prisma } from "@/lib/prisma";