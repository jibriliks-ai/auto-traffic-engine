/**
 * src/lib/limits.ts
 *
 * Free / premium / admin enforcement for every module.
 *
 * ⚠️ VERIFY these 4 queries against prisma/schema.prisma before deploying:
 *    [VERIFY 1] prisma.qAPost.count(...)      → Q&A daily count
 *    [VERIFY 2] prisma.submission.count(...)  → Indexer daily count
 *    [VERIFY 3] prisma.video.count(...)       → Video total count
 *    [VERIFY 4] prisma.submission.count(...)  → Social post daily count
 *
 * If any field differs, adjust only that one line — the rest is safe.
 */

import { prisma } from "@/lib/prisma";
import { isEnvAdmin } from "@/lib/admin";

export type Usage = {
  allowed: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
  isPremium: boolean;
  isAdmin?: boolean;
};

/** What every check*Limit() returns for an admin — no caps at all. */
export const UNLIMITED: Usage = {
  allowed: true,
  used: 0,
  limit: null,
  remaining: null,
  isPremium: true,
  isAdmin: true,
};

/** What we return for a normal premium (non-admin) user. */
function premiumUsage(): Usage {
  return {
    allowed: true,
    used: 0,
    limit: null,
    remaining: null,
    isPremium: true,
  };
}

/** Returns true if the user is an admin (DB role='admin' OR email in ADMIN_EMAILS). */
async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });
    if (!user) return false;
    if (user.role === "admin") return true;
    return isEnvAdmin(user.email);
  } catch {
    return false;
  }
}

/** Midnight today (local server time) — used for "per day" counters. */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ════════════════════════════════════════════════════════════
// Q&A  —  5 / day for free
// ════════════════════════════════════════════════════════════

const QA_LIMIT = 5;

export async function checkQALimit(userId: string, plan: string): Promise<Usage> {
  if (await isAdminUser(userId)) return UNLIMITED;
  if (plan === "premium") return premiumUsage();

  // [VERIFY 1] — Q&A activity count for today.
  // Assumes QAPost has: { userId, createdAt }.
  // If you track activities in a separate table, swap the model here.
  const used = await prisma.qAPost.count({
    where: { userId, createdAt: { gte: startOfToday() } },
  });

  const remaining = Math.max(0, QA_LIMIT - used);
  return {
    allowed: remaining > 0,
    used,
    limit: QA_LIMIT,
    remaining,
    isPremium: false,
  };
}

/**
 * Records a Q&A activity so the daily counter in checkQALimit moves forward.
 * Called from /api/qa/search and /api/qa/draft after successful work.
 * Safe no-op on failure — quota tracking should never break the feature.
 */
export async function recordQAActivity(
  userId: string,
  type: string,
  detail?: string
): Promise<void> {
  try {
    const slug = `qa-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await prisma.qAPost.create({
      data: {
        userId,
        title: (detail ?? type).slice(0, 200),
        slug,
        answer: "",
        sourceUrl: "",
        sourcePlatform: type,
        published: false,
      } as any,
    });
  } catch {
    // best-effort — never throw from activity tracking
  }
}

// ════════════════════════════════════════════════════════════
// Indexer  —  2 / day for free
// ════════════════════════════════════════════════════════════

const INDEXER_LIMIT = 2;

export async function checkIndexerLimit(userId: string, plan: string): Promise<Usage> {
  if (await isAdminUser(userId)) return UNLIMITED;
  if (plan === "premium") return premiumUsage();

  // [VERIFY 2] — Indexer submissions for today.
  // Assumes Submission has: { userId, createdAt }.
  // If you filter by type, add: type: "indexer", to the where clause.
  const used = await prisma.submission.count({
    where: { userId, createdAt: { gte: startOfToday() } },
  });

  const remaining = Math.max(0, INDEXER_LIMIT - used);
  return {
    allowed: remaining > 0,
    used,
    limit: INDEXER_LIMIT,
    remaining,
    isPremium: false,
  };
}

// ════════════════════════════════════════════════════════════
// Video  —  1 total for free (ever)
// ════════════════════════════════════════════════════════════

const VIDEO_LIMIT = 1;

export async function checkVideoLimit(userId: string, plan: string): Promise<Usage> {
  if (await isAdminUser(userId)) return UNLIMITED;
  if (plan === "premium") return premiumUsage();

  // [VERIFY 3] — Total videos ever created by this user.
  // Assumes Video has: { userId }.
  const used = await prisma.video.count({ where: { userId } });

  const remaining = Math.max(0, VIDEO_LIMIT - used);
  return {
    allowed: remaining > 0,
    used,
    limit: VIDEO_LIMIT,
    remaining,
    isPremium: false,
  };
}

// ════════════════════════════════════════════════════════════
// Social Posts  —  2 / day for free
// ════════════════════════════════════════════════════════════

const SOCIAL_LIMIT = 2;

export async function checkSocialLimit(userId: string, plan: string): Promise<Usage> {
  if (await isAdminUser(userId)) return UNLIMITED;
  if (plan === "premium") return premiumUsage();

  // [VERIFY 4] — Social post count for today.
  // This assumes social posts are tracked in Submission.
  // If your schema uses a different table, swap the model here.
  let used = 0;
  try {
    used = await prisma.submission.count({
      where: {
        userId,
        createdAt: { gte: startOfToday() },
        // If you have a `type` field, uncomment and adjust:
        // type: "social",
      },
    });
  } catch {
    used = 0;
  }

  const remaining = Math.max(0, SOCIAL_LIMIT - used);
  return {
    allowed: remaining > 0,
    used,
    limit: SOCIAL_LIMIT,
    remaining,
    isPremium: false,
  };
}

// ════════════════════════════════════════════════════════════
// Businesses  —  1 for free
// ════════════════════════════════════════════════════════════

const BUSINESS_LIMIT = 1;

export async function checkBusinessLimit(userId: string, plan: string): Promise<Usage> {
  if (await isAdminUser(userId)) return UNLIMITED;
  if (plan === "premium") return premiumUsage();

  const used = await prisma.business.count({ where: { userId } });

  const remaining = Math.max(0, BUSINESS_LIMIT - used);
  return {
    allowed: remaining > 0,
    used,
    limit: BUSINESS_LIMIT,
    remaining,
    isPremium: false,
  };
}