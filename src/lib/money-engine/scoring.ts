import type { RawOffer, ScoredOffer } from "./types";

/**
 * Scoring formulas — exactly as specified in the Money Engine v2 spec.
 * Digital: EPC × 40 + conversion × 30 + funnel_max × 0.1 − refund × 20 + (recurring ? 30 : 0)
 * Physical: orders_7d / 100 × 10 + rating × 10 + commission × 15 − refund × 20 + (price < 10 ? 10 : 0)
 */
export function scoreOffer(offer: RawOffer): ScoredOffer {
  const isDigital = offer.productType === "digital";

  let score = 0;

  if (isDigital) {
    score =
      (offer.epc ?? 0) * 40 +
      (offer.conversionRate ?? 0) * 30 +
      (offer.funnelMaxPrice ?? 0) * 0.1 -
      (offer.refundRate ?? 0) * 20 +
      (offer.isRecurring ? 30 : 0);
  } else {
    score =
      ((offer.orders7days ?? 0) / 100) * 10 +
      (offer.rating ?? 0) * 10 +
      (offer.commissionAmount ?? 0) * 15 -
      (offer.refundRate ?? 0) * 20 +
      ((offer.frontEndPrice ?? 999) < 10 ? 10 : 0);
  }

  score = Math.max(0, Math.round(score * 100) / 100);

  let status: ScoredOffer["status"] = "active";
  let priority: ScoredOffer["priority"] = "normal";
  let tag: ScoredOffer["tag"] = null;

  if (score > 75) {
    priority = "high";
    tag = "WINNER";
  }
  if (score < 30) {
    status = "paused";
    priority = "low";
  }
  if ((offer.conversionRate ?? 0) > 3) {
    priority = "high";
  }

  return { ...offer, score, status, priority, tag };
}

/**
 * Digital offer keep-filter (spec Part 4).
 * Recurring offers get a lower EPC threshold.
 */
export function passesDigitalFilter(o: RawOffer): boolean {
  const epc = o.epc ?? 0;
  const refund = o.refundRate ?? 100;
  const conv = o.conversionRate ?? 0;
  const hasPage = Boolean(o.salesPageUrl);

  const epcOk = o.isRecurring ? epc >= 0.3 : epc >= 0.5;
  return epcOk && refund <= 20 && conv >= 1 && hasPage;
}

/**
 * Physical offer keep-filter (spec Part 4).
 */
export function passesPhysicalFilter(o: RawOffer): boolean {
  return (
    (o.orders7days ?? 0) >= 500 &&
    (o.rating ?? 0) >= 4.3 &&
    (o.frontEndPrice ?? 999) <= 25 &&
    (o.commissionAmount ?? 0) >= 1 &&
    (o.commissionPct ?? 0) >= 8 &&
    Boolean(o.imageUrl)
  );
}