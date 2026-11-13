import type { PlatformId } from "./types";

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  color: string;
  description: string;
  howTo: string[];       // Step-by-step guide for getting the tracking link
  linkExample: string;   // Example URL pattern
  dashboardUrl: string;  // Where the user gets their links
}

/**
 * Only 2 platforms supported. Both use the "paste tracking link" method —
 * no API, no SID, no Token. Users grab their affiliate link from the
 * platform dashboard and paste it into the app.
 *
 * The PLATFORM_CONFIG array drives:
 *   - /money-engine/settings page (connect cards + Add Link modal)
 *   - /money-engine page (NOT_CONNECTED modal help text)
 *   - linkResolver.ts (platform validation)
 */
export const PLATFORM_CONFIG: PlatformConfig[] = [
  {
    id: "impact",
    name: "Impact.com",
    color: "#ff5e5e",
    description:
      "Impact powers 3,000+ brands including Jumia, AliExpress, Walmart, Adidas, Canva, Shopify, Monday, HubSpot. Paste your affiliate link for any product you want to promote.",
    howTo: [
      "Log in to app.impact.com as a Partner (Publisher)",
      "Find the campaign (brand) you want to promote",
      "Click 'Create Tracking Link' or 'Get Link'",
      "Copy the full tracking URL (usually starts with https://{brand}.sjv.io/...)",
      "Paste it below with a friendly name and the product page URL",
    ],
    linkExample: "https://jumia-ng.sjv.io/c/123456/789/12345",
    dashboardUrl: "https://app.impact.com",
  },
  {
    id: "warriorplus",
    name: "WarriorPlus",
    color: "#c0392b",
    description:
      "WarriorPlus hosts 1,000+ digital products — software, courses, marketing tools. Paste your affiliate link for any offer you want to promote.",
    howTo: [
      "Log in to warriorplus.com",
      "Find a product in Marketplace you're approved for",
      "Click 'Get Affiliate Link'",
      "Copy your link (format: https://warriorplus.com/o2/a/xxxxx/username)",
      "Paste it below with the product name and page URL",
    ],
    linkExample: "https://warriorplus.com/o2/a/abc123/yourusername",
    dashboardUrl: "https://warriorplus.com",
  },
];