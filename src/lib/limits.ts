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

/** What every check function returns for an admin. */
export const UNLIMITED: Usage = {
  allowed: true,
  used: 0,
  limit: null,
  remaining: null,
  isPremium: true,
  isAdmin: true,
};

/**
 * One DB hit per check, cached within the request by Next.js's
 * built-in fetch/db memoisation. Returns true for role='admin'
 * in DB OR email in ADMIN_EMAILS env.
 */
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


const FREE_INDEXER_DAILY = 2;
const FREE_QA_DAILY = 5;
const FREE_SOCIAL_DAILY = 2;
const FREE_BUSINESS_LIMIT = 1;
const FREE_VIDEO_TOTAL = 1;

// =========================
// Q&A — 5 interactions/day for free
// =========================
export async function checkQALimit(userId: string, plan: string) {
  if (plan === "premium") {
    return {
      allowed: true,
      used: 0,
      limit: null as number | null,
      remaining: null as number | null,
      isPremium: true,
    };
  }
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const used = await prisma.submission.count({
    where: { userId, type: "qa_activity", createdAt: { gte: since } },
  });

  const limit = FREE_QA_DAILY;
  const remaining = Math.max(0, limit - used);
  return { allowed: used < limit, used, limit, remaining, isPremium: false };
}

export async function recordQAActivity(
  userId: string,
  kind: "search" | "draft",
  keyword: string
) {
  try {
    await prisma.submission.create({
      data: {
        userId,
        type: "qa_activity",
        platform: kind,
        url: keyword.slice(0, 200),
        submittedUrl: keyword.slice(0, 200),
        status: "success",
      },
    });
  } catch (e) {
    console.error("[limits] recordQAActivity failed:", e);
  }
}

// =========================
// Indexer — 2 submissions/day for free
// =========================
export async function checkIndexerLimit(userId: string, plan: string) {
  if (plan === "premium") {
    return { allowed: true, used: 0, limit: null, remaining: null };
  }
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const used = await prisma.submission.count({
    where: { userId, type: "indexer", createdAt: { gte: since } },
  });

  const limit = FREE_INDEXER_DAILY;
  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

// =========================
// Video — 1 total for free
// =========================
export async function checkVideoLimit(userId: string, plan: string) {
  if (plan === "premium") {
    return { allowed: true, used: 0, limit: null };
  }
  const used = await prisma.video.count({ where: { userId } });
  const limit = FREE_VIDEO_TOTAL;
  return { allowed: used < limit, used, limit };
}

// =========================
// Social — 2 posts/day for free (across ALL channels)
// =========================
export async function checkSocialLimit(userId: string, plan: string) {
  if (plan === "premium") {
    return {
      allowed: true,
      used: 0,
      limit: null as number | null,
      remaining: null as number | null,
    };
  }
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const used = await prisma.submission.count({
    where: { userId, type: "social", createdAt: { gte: since } },
  });

  const limit = FREE_SOCIAL_DAILY;
  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

// =========================
// Business — 1 for free (already enforced in route, helper here)
// =========================
export async function checkBusinessLimit(userId: string, plan: string) {
  if (plan === "premium") {
    return { allowed: true, count: 0, limit: null };
  }
  const count = await prisma.business.count({ where: { userId } });
  const limit = FREE_BUSINESS_LIMIT;
  return { allowed: count < limit, count, limit };
}