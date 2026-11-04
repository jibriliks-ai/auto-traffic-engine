import { prisma } from "./prisma";

const LIMITS = {
  free: {
    indexer: 2,
    video: 1,
    socialDaily: 5,
  },
  premium: {
    indexer: Infinity,
    video: Infinity,
    socialDaily: Infinity,
  },
} as const;

export async function checkIndexerLimit(userId: string, plan: string) {
  if (plan === "premium") return { allowed: true, used: 0, limit: Infinity };
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const used = await prisma.submission.count({
    where: { userId, type: "indexer", createdAt: { gte: since } },
  });
  const limit = LIMITS.free.indexer;
  return { allowed: used < limit, used, limit };
}

export async function checkVideoLimit(userId: string, plan: string) {
  if (plan === "premium") return { allowed: true, used: 0, limit: Infinity };
  const used = await prisma.video.count({ where: { userId } });
  const limit = LIMITS.free.video;
  return { allowed: used < limit, used, limit };
}