import { aiChat } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

type Platform = "lemmy" | "answer";
type Angle = "price" | "legit" | "delivery" | "comparison" | "problem";

const ANGLES: Angle[] = ["price", "legit", "delivery", "comparison", "problem"];

const BANNED_PHRASES = [
  "unlock your potential",
  "game-changer",
  "game changer",
  "revolutionary",
  "in today's digital world",
  "don't miss out",
  "limited time offer",
  "act now",
  "best in the world",
  "amazing opportunity",
  "passive income dream",
  "make money while you sleep",
  "100% guaranteed",
  "dm me for link",
  "link in bio for more info",
];

export interface SalesCopyInput {
  userId: string;
  offer: {
    id: string;
    title: string;
    vendor: string | null;
    category: string | null;
    frontEndPrice: any;
    originalPrice: any;
    salesPageUrl: string | null;
    swipeCopy: string | null;
  };
  platform: Platform;
  shortUrl: string;
  forceAngle?: Angle;
}

export interface GeneratedSalesCopy {
  platform: Platform;
  postType: string;
  title: string;
  body: string;
  hookUsed: string;
  angleUsed: Angle;
  variationSeed: number;
}

/** Week number since epoch — used in variation seed for "new post after 7 days = new variation" */
function weekNumber(): number {
  return Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
}

/** Simple Levenshtein similarity (0-1) */
function similarity(a: string, b: string): number {
  const s1 = a.toLowerCase().slice(0, 800);
  const s2 = b.toLowerCase().slice(0, 800);
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        s1[i - 1] === s2[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

/** Pick an angle different from the last one used by this user */
async function pickAngle(userId: string, forceAngle?: Angle): Promise<Angle> {
  if (forceAngle) return forceAngle;

  const lastCopy = await prisma.moneyEngineSalesCopy.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { angleUsed: true },
  });

  const lastAngle = (lastCopy?.angleUsed as Angle) ?? null;
  const pool = ANGLES.filter((a) => a !== lastAngle);
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildPrompt(
  input: SalesCopyInput,
  angle: Angle,
  variationSeed: number
): { system: string; user: string } {
  const merchant = input.offer.vendor ?? "the merchant";
  const product = input.offer.title;
  const price = input.offer.frontEndPrice
    ? `₦${Number(input.offer.frontEndPrice).toLocaleString()}`
    : "the listed price";
  const category = input.offer.category ?? "general";

  const angleGuide: Record<Angle, string> = {
    price: "Focus on price comparison — is it cheaper than market? Local story about pricing.",
    legit: "Focus on authenticity — is it original? How to spot fake vs real?",
    delivery: "Focus on delivery speed and reliability to Lagos/Abuja.",
    comparison: `Compare ${merchant} vs a competitor for this product.`,
    problem: "Personal story — old item broke, needed replacement, found this deal.",
  };

  const system = `You are a Nigerian Nairaland-style forum user writing sales-adjacent discussion posts.
You write in Nigerian English + Pidgin mix — real, casual, human.
You NEVER use these banned phrases (will trigger spam filters):
${BANNED_PHRASES.map((p) => `- "${p}"`).join("\n")}

You always output valid JSON only — no markdown, no explanation.`;

  const template = input.platform === "lemmy"
    ? `Return EXACTLY this JSON for a Lemmy discussion post:
{
  "title": "discussion title 8-14 words, use 1 hook template",
  "body": "120-200 word body: paragraph 1 (personal story hook using ${angle} angle), paragraph 2 (facts: price ${price}, delivery info, real specs from offer), paragraph 3 (question for community + soft CTA with the short URL)",
  "hookUsed": "the exact first sentence of paragraph 1 (for dedup tracking)"
}

Title templates (pick ONE that fits):
- "Anyone don buy ${product} from ${merchant}? E be like price drop o"
- "${product} for ${price} - Na scam or real deal?"
- "I wan buy ${product}, ${merchant} or Konga - which one better for delivery to Lagos?"
- "My old ${category} just spoil, I dey eye ${product} - who don use am?"
- "${product} at ${price} - I no believe am until I check"
- "Honest question: ${product} worth am for ${price}?"
- "${merchant} dey sell ${product} for ${price} - I compare with market, na wa"
- "Who don order ${product} from ${merchant} this month? How long delivery take?"
- "I find ${product} for ${price}, but I dey fear fake - how to check original?"
- "${product} vs competitor - which one you go pick if na you?"

Rules:
- Angle to use: ${angleGuide[angle]}
- Max 2 emojis TOTAL
- Include this exact URL once in paragraph 3: ${input.shortUrl}
- DO NOT add hashtags
- DO NOT say "link in bio"`

    : `Return EXACTLY this JSON for an Apache Answer question + answer:
{
  "title": "30-50 word question title, must be a real user question",
  "body": "150-250 word answer body: paragraph 1 (direct answer with 2-3 facts), paragraph 2 (how to verify/buy in steps), paragraph 3 (personal take + CTA with the short URL)",
  "hookUsed": "the exact first sentence of the answer (for dedup tracking)"
}

Question title templates (pick ONE that fits):
- "Is ${product} from ${merchant} original or fake?"
- "How long does ${merchant} take to deliver ${product} to Lagos?"
- "Is ${product} worth ${price} in Nigeria?"
- "${product} vs competitor - which is better?"
- "Does ${merchant} offer cash on delivery for ${product}?"
- "What is the cheapest price for ${product} in Nigeria right now?"
- "Can I return ${product} if I don't like it from ${merchant}?"
- "Is ${merchant} legit for buying ${product} in 2026?"
- "${product} - does it work well in Nigeria?"
- "Where can I buy original ${product} in Nigeria?"

Rules:
- Angle to use: ${angleGuide[angle]}
- Answer must feel human, first-person, no "As an AI"
- Include this exact URL once in paragraph 3: ${input.shortUrl}
- Max 2 emojis TOTAL
- DO NOT add hashtags`;

  const userPrompt = `Product: ${product}
Merchant: ${merchant}
Category: ${category}
Price: ${price}
Offer description: ${input.offer.swipeCopy ?? "(none)"}
Short URL: ${input.shortUrl}
Variation seed (use this to make the post unique): ${variationSeed}

${template}

Be creative with this seed — different seed = different wording, different personal story, different sentence structure.`;

  return { system, user: userPrompt };
}

function extractJson(text: string): any {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) { try { return JSON.parse(brace[0]); } catch {} }
  return null;
}

function containsBannedPhrase(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

/** Check if hook has been used too many times */
async function hookUsedTooOften(userId: string, hook: string): Promise<boolean> {
  const existing = await prisma.moneyEngineUsedHook.findUnique({
    where: { userId_hookText: { userId, hookText: hook.slice(0, 300) } },
  });
  return existing !== null && existing.usedCount >= 3;
}

/** Check similarity against existing copy for same user+offer+platform */
async function tooSimilarToExisting(
  userId: string,
  offerId: string,
  platform: Platform,
  body: string
): Promise<boolean> {
  const existing = await prisma.moneyEngineSalesCopy.findMany({
    where: { userId, offerId, platform },
    select: { body: true },
    take: 10,
  });
  for (const e of existing) {
    if (similarity(e.body, body) > 0.85) return true;
  }
  return false;
}

async function recordHookUsage(userId: string, hook: string): Promise<void> {
  try {
    await prisma.moneyEngineUsedHook.upsert({
      where: { userId_hookText: { userId, hookText: hook.slice(0, 300) } },
      create: { userId, hookText: hook.slice(0, 300), usedCount: 1 },
      update: { usedCount: { increment: 1 }, lastUsedAt: new Date() },
    });
  } catch {
    /* non-fatal */
  }
}

/**
 * Generate one unique sales copy post.
 * Retries up to 2 times if banned phrase OR hook used 3+ times OR >85% similar.
 */
export async function generateSalesCopy(
  input: SalesCopyInput
): Promise<GeneratedSalesCopy> {
  const angle = await pickAngle(input.userId, input.forceAngle);
  const week = weekNumber();

  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const variationSeed = Math.floor(Math.random() * 1000) + week * 1000;

    try {
      const { system, user } = buildPrompt(input, angle, variationSeed);
      const raw = await aiChat(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        { maxTokens: 900, temperature: 0.85 }
      );

      const parsed = extractJson(raw);
      if (!parsed || !parsed.title || !parsed.body) {
        lastError = "AI returned invalid JSON";
        continue;
      }

      const title = String(parsed.title).trim().slice(0, 250);
      const body = String(parsed.body).trim().slice(0, 3000);
      const hookUsed = String(parsed.hookUsed ?? body.split(".")[0] ?? "").trim().slice(0, 300);

      // 1. Banned phrase check
      const banned = containsBannedPhrase(title + " " + body);
      if (banned) {
        lastError = `Banned phrase: "${banned}"`;
        continue;
      }

      // 2. Hook reuse check
      if (await hookUsedTooOften(input.userId, hookUsed)) {
        lastError = "Hook used 3+ times already";
        continue;
      }

      // 3. Similarity check
      if (await tooSimilarToExisting(input.userId, input.offer.id, input.platform, body)) {
        lastError = "Body too similar to existing (>85%)";
        continue;
      }

      // All checks passed — record hook and return
      await recordHookUsage(input.userId, hookUsed);

      return {
        platform: input.platform,
        postType: input.platform === "lemmy" ? "lemmy_discussion" : "answer_question",
        title,
        body,
        hookUsed,
        angleUsed: angle,
        variationSeed,
      };
    } catch (e: any) {
      lastError = e?.message ?? "unknown";
    }
  }

  throw new Error(`Sales copy generation failed after 3 attempts: ${lastError}`);
}