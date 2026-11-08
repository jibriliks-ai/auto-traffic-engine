export type ProductType = "digital" | "physical";

export type PlatformId =
  | "warriorplus"
  | "jvzoo"
  | "impact"
  | "partnerstack"
  | "temu"
  | "aliexpress"
  | "jumia"
  | "konga";

export type TrafficModule = "tiktok" | "facebook" | "x" | "youtube";

export interface RawOffer {
  productType: ProductType;
  platform: PlatformId;
  offerId: string;
  title: string;
  vendor?: string;
  category?: string;
  frontEndPrice?: number;
  originalPrice?: number;
  funnelMaxPrice?: number;
  commissionPct?: number;
  commissionAmount?: number;
  commissionType?: string;
  epc?: number;
  conversionRate?: number;
  gravity?: number;
  refundRate?: number;
  orders7days?: number;
  rating?: number;
  isRecurring?: boolean;
  recurringMonths?: number;
  salesPageUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  affiliateLinkTemplate?: string;
  swipeCopy?: string;
}

export interface ScoredOffer extends RawOffer {
  score: number;
  status: "active" | "paused" | "dead";
  priority: "low" | "normal" | "high";
  tag?: "WINNER" | null;
}

export interface SyncResult {
  platform: PlatformId;
  productType: ProductType;
  fetched: number;
  kept: number;
  mock: boolean;
  error?: string;
}

export interface SyncAllResult {
  results: SyncResult[];
  totalKept: number;
  totalFetched: number;
}