export type QAPlatform =
  | "answer"
  | "tiktok_comments"
  | "threads"
  | "pinterest"
  | "youtube"
  | "instagram";

export type Niche =
  | "physical"
  | "digital"
  | "finance"
  | "jobs"
  | "beauty"
  | "tech"
  | "general";

export interface PromptInput {
  platform: QAPlatform;
  niche: Niche;
  productName: string;
  productType: string;
  question: string;
  cloakedUrl?: string;
  videoCaption?: string;
}

const NICHE_RULES: Record<
  Niche,
  { require: string; ban: string; tone: string }
> = {
  finance: {
    require:
      "Use: 'might qualify', 'check eligibility', 'terms apply', 'lender decides', 'not guaranteed'",
    ban: "secure, guaranteed, low interest, instant approval, no credit check, free money",
    tone: "Cautious, factual, referral to official lender",
  },
  digital: {
    require: "Use: 'learn', 'step-by-step', 'results vary', 'takes work'",
    ban: "guaranteed income, get rich quick, make $10k, passive income, no work",
    tone: "Educational, honest about effort required",
  },
  physical: {
    require: "Use: 'I use it for', 'check specs', 'pros/cons'",
    ban: "best ever guaranteed, cures, fake review, miracle",
    tone: "Personal experience, spec-driven",
  },
  jobs: {
    require: "Use: 'requirements', 'check official site'",
    ban: "guaranteed visa, guaranteed job, no experience needed",
    tone: "Practical, refer to official application",
  },
  beauty: {
    require: "Use: 'results vary', 'check ingredients'",
    ban: "cures, guaranteed results, dermatologist tested (unless verified), miracle",
    tone: "Honest, personal routine",
  },
  tech: {
    require: "Use: 'check specs', 'in my experience'",
    ban: "best ever, guaranteed performance, perfect for everyone",
    tone: "Technical, specific use cases",
  },
  general: {
    require: "Plain English, factual",
    ban: "guaranteed, 100%, miracle, instant",
    tone: "Conversational, honest",
  },
};

const GLOBAL_BANNED = [
  "game-changer",
  "game changer",
  "unlock your potential",
  "in today's digital world",
  "don't miss out",
  "limited time offer",
  "act now",
  "amazing opportunity",
  "100% guaranteed",
  "guaranteed",
  "get rich quick",
  "miracle",
  "best ever",
  "no work required",
  "dm me",
  "check bio",
  "link in bio for more info",
];

// TikTok tag suggestions per niche (spec's tagMap)
export const TAG_MAP: Record<Niche, string[]> = {
  physical: ["musthaves", "amazonfinds", "gadgets", "techgadgets"],
  digital: ["sidehustle", "learnontiktok", "digitalproducts", "onlinebusiness"],
  finance: ["moneytips", "personalfinance", "financetips", "budgeting"],
  jobs: ["jobsearch", "careertok", "jobtips", "hiring"],
  beauty: ["skincare", "beautytips", "makeup", "skincareroutine"],
  tech: ["techtok", "gadgets", "techreview", "techtips"],
  general: ["lifehacks", "tipsandtricks", "learnontiktok", "howto"],
};

export function scrubBannedWords(text: string, niche?: Niche): string {
  let out = text;
  const allBanned = niche
    ? [...GLOBAL_BANNED, ...NICHE_RULES[niche].ban.split(",").map((s) => s.trim())]
    : GLOBAL_BANNED;

  for (const phrase of allBanned) {
    if (!phrase) continue;
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "gi");
    out = out.replace(re, "[removed]");
  }
  return out;
}

function systemBase(niche: Niche): string {
  const rules = NICHE_RULES[niche];
  return `You write short, human, honest social media content.

NICHE: ${niche}
TONE: ${rules.tone}
REQUIRED LANGUAGE: ${rules.require}
BANNED WORDS (never use): ${rules.ban}, ${GLOBAL_BANNED.join(", ")}

Use PLAIN ENGLISH (US/EU). No slang. No Pidgin.
You ALWAYS return valid JSON only — no markdown, no prose.`;
}

export function buildPrompt(input: PromptInput): {
  system: string;
  user: string;
} {
  const { platform, niche, productName, productType, question, cloakedUrl } =
    input;
  const system = systemBase(niche);

  const ctx = `Niche: ${niche}
Product: ${productName}
Product type: ${productType}
User question: ${question}`;

  switch (platform) {
    case "answer":
      return {
        system,
        user: `${ctx}

Return JSON: { "answer": "120-200 word honest answer. Paragraph 1: direct answer. Paragraph 2: 2-3 specific facts (specs, price, use case). Paragraph 3: personal take + one caveat. Do NOT include any URL." }`,
      };

    case "threads":
      return {
        system,
        user: `${ctx}

Return JSON for Threads (3 posts, each under 400 chars):
{
  "question": "A relatable question to spark replies",
  "tip": "One specific, practical tip",
  "engagement": "A poll-style or 'this vs that' prompt (no URL)"
}

Rules: NO link in the first post. Do NOT mention product name. Conversational, honest.`,
      };

    case "pinterest":
      return {
        system,
        user: `${ctx}

Return JSON for a Pinterest pin:
{
  "title": "Under 100 chars, keyword-rich, no clickbait",
  "description": "Under 500 chars. Include 2 pros + 1 con. Honest. No guarantee language.",
  "imagePrompt": "A one-sentence visual prompt for an AI image generator (product on plain background, natural lighting, lifestyle context)",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}

${cloakedUrl ? `The affiliate link will be attached separately by the user as: ${cloakedUrl}` : ""}`,
      };

    case "youtube":
      return {
        system,
        user: `${ctx}

Return JSON for a YouTube Short:
{
  "script": "30-second script. 0-3s hook. 3-20s one lesson. 20-30s 'Results vary, link in description, terms apply'. No fake results.",
  "title": "Under 100 chars, honest",
  "description": "100 words. Include 'Affiliate link in description' and 'Terms apply'.",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}

${cloakedUrl ? `The description should end with: ${cloakedUrl}` : ""}`,
      };

    case "instagram":
      return {
        system,
        user: `${ctx}

Return JSON for an Instagram Reel:
{
  "caption": "Under 150 chars. 'Link in bio' is allowed. Honest, personal.",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "bestTime": "Best posting time for this niche (e.g. 'Tuesday 7pm EST')"
}`,
      };

    case "tiktok_comments":
      return {
        system,
        user: `Question context: ${question}
Video caption: ${input.videoCaption ?? "(none)"}

Return JSON for 3 TikTok comments to leave on this video. Each under 150 chars.
{
  "agree": "A comment that agrees + adds one small tip (no selling, no link)",
  "question": "A genuine question about the video",
  "experience": "A short 'I tried this' personal experience (no product name, no link)"
}

Rules:
- NEVER include "check bio", "DM me", or any URL
- NEVER mention the product name
- Feels human, like a real viewer`,
      };

    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

export function getScrapedTikTokPrompt(): string {
  return `Extract video metadata from this TikTok HTML page. Return JSON: { videos: [{ author, caption, views, likes, comments, url }] }. Only include videos with views >= the min filter.`;
}