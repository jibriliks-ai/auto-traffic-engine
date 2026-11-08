import type { PlatformId, ProductType } from "./types";

export interface PlatformField {
  key: "affiliateUsername" | "affiliateId" | "apiKey" | "apiSecret" | "accessToken" | "accountId";
  label: string;
  placeholder: string;
  secret: boolean;
}

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  category: ProductType;
  fields: PlatformField[];
  hint: string;
  brands: string[];
}

export const PLATFORM_CONFIG: PlatformConfig[] = [
  {
    id: "impact",
    name: "Impact.com",
    category: "digital",
    hint:
      "One Impact account carries 30+ brands — Jumia NG, AliExpress, Walmart, Adidas, Shopify, Canva, Semrush, Hostinger, NordVPN, Konga and more. Get credentials from Settings → API.",
    fields: [
      { key: "accountId", label: "Account SID", placeholder: "1234567", secret: false },
      { key: "accessToken", label: "Auth Token", placeholder: "••••••", secret: true },
    ],
    brands: [
      "Jumia NG", "Konga", "AliExpress", "Walmart", "Adidas", "Levi's",
      "StockX", "Etsy", "Fanatics", "Lenovo", "Nike", "eBay",
      "Shopify", "Canva", "Semrush", "Hostinger", "NordVPN", "Norton",
      "Bitdefender", "Wondershare", "EaseUS", "AppSumo", "Skillshare",
      "Airbnb", "Booking.com", "TripAdvisor", "Ticketmaster", "Uber",
      "L'Oréal", "Glossier",
    ],
  },
  {
    id: "partnerstack",
    name: "PartnerStack",
    category: "digital",
    hint:
      "One PartnerStack account carries 20+ SaaS programs — Monday.com, HubSpot, Slack, Webflow, Asana, Notion, Jasper AI, Typeform and more. Most programs pay recurring.",
    fields: [
      { key: "apiKey", label: "Public Key", placeholder: "pk_live_...", secret: true },
      { key: "apiSecret", label: "Secret Key", placeholder: "••••••", secret: true },
      { key: "affiliateId", label: "Partner ID", placeholder: "partner_12345", secret: false },
    ],
    brands: [
      "Monday.com", "HubSpot", "Slack", "Webflow", "Asana", "Typeform",
      "Mailchimp", "Freshbooks", "Unbounce", "Loom", "ActiveCampaign",
      "ClickUp", "Calendly", "Pipedrive", "Intercom", "ZoomInfo",
      "ConvertKit", "Notion", "Grammarly", "Jasper AI",
    ],
  },
];

export const REQUIRED_FIELDS: Record<PlatformId, PlatformField["key"][]> = {
  impact: ["accountId", "accessToken"],
  partnerstack: ["apiKey", "apiSecret", "affiliateId"],
};