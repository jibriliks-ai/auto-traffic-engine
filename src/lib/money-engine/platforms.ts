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
}

export const PLATFORM_CONFIG: PlatformConfig[] = [
  {
    id: "warriorplus",
    name: "WarriorPlus",
    category: "digital",
    hint: "Sign up as an affiliate, then copy your username + API key from the dashboard.",
    fields: [
      { key: "affiliateUsername", label: "Affiliate Username", placeholder: "yourusername", secret: false },
      { key: "apiKey", label: "API Key", placeholder: "wp_xxxxxxxx", secret: true },
    ],
  },
  {
    id: "jvzoo",
    name: "JVZoo",
    category: "digital",
    hint: "JVZoo Affiliate → API Settings. You need both the key and secret.",
    fields: [
      { key: "affiliateId", label: "Affiliate ID", placeholder: "12345", secret: false },
      { key: "apiKey", label: "API Key", placeholder: "jvz_xxxxxxxx", secret: true },
      { key: "apiSecret", label: "API Secret", placeholder: "••••••", secret: true },
    ],
  },
  {
    id: "impact",
    name: "Impact.com",
    category: "digital",
    hint: "Account SID → Settings → API. Token is the Mediapartners token.",
    fields: [
      { key: "accountId", label: "Account SID", placeholder: "1234567", secret: false },
      { key: "accessToken", label: "Bearer Token", placeholder: "••••••", secret: true },
    ],
  },
  {
    id: "partnerstack",
    name: "PartnerStack",
    category: "digital",
    hint: "Partner dashboard → API Keys → generate a public + secret pair.",
    fields: [
      { key: "apiKey", label: "Public Key", placeholder: "pk_live_...", secret: true },
      { key: "apiSecret", label: "Secret Key", placeholder: "••••••", secret: true },
    ],
  },
  {
    id: "temu",
    name: "Temu Affiliate",
    category: "physical",
    hint: "affiliate.temu.com → API Access. Approval can take 1–3 weeks.",
    fields: [
      { key: "apiKey", label: "App Key", placeholder: "tm_xxxxxxxx", secret: true },
      { key: "apiSecret", label: "App Secret", placeholder: "••••••", secret: true },
    ],
  },
  {
    id: "aliexpress",
    name: "AliExpress Portals",
    category: "physical",
    hint: "portals.aliexpress.com → API. App key + secret, business info required.",
    fields: [
      { key: "apiKey", label: "App Key", placeholder: "ALI_xxxxxxxx", secret: true },
      { key: "apiSecret", label: "App Secret", placeholder: "••••••", secret: true },
    ],
  },
  {
    id: "jumia",
    name: "Jumia (via Impact)",
    category: "physical",
    hint: "Uses the same Impact.com credentials — campaign name must be 'Jumia NG'.",
    fields: [
      { key: "accountId", label: "Account SID", placeholder: "1234567", secret: false },
      { key: "accessToken", label: "Bearer Token", placeholder: "••••••", secret: true },
    ],
  },
  {
    id: "konga",
    name: "Konga (via Impact)",
    category: "physical",
    hint: "Uses the same Impact.com credentials — campaign name must be 'Konga'.",
    fields: [
      { key: "accountId", label: "Account SID", placeholder: "1234567", secret: false },
      { key: "accessToken", label: "Bearer Token", placeholder: "••••••", secret: true },
    ],
  },
];

export const REQUIRED_FIELDS: Record<PlatformId, PlatformField["key"][]> = {
  warriorplus: ["affiliateUsername", "apiKey"],
  jvzoo: ["affiliateId", "apiKey", "apiSecret"],
  impact: ["accountId", "accessToken"],
  partnerstack: ["apiKey", "apiSecret"],
  temu: ["apiKey", "apiSecret"],
  aliexpress: ["apiKey", "apiSecret"],
  jumia: ["accountId", "accessToken"],
  konga: ["accountId", "accessToken"],
};