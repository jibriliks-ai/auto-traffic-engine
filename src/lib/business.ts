import { prisma } from "./prisma";

export const FREE_BUSINESS_LIMIT = 1;
export const PRO_BUSINESS_LIMIT = 999;

export type BusinessLimits = {
  plan: string;
  count: number;
  limit: number;
  allowed: boolean;
};

export async function getBusinessLimits(userId: string): Promise<BusinessLimits> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, _count: { select: { businesses: true } } },
  });
  if (!user) {
    return { plan: "free", count: 0, limit: FREE_BUSINESS_LIMIT, allowed: false };
  }
  const isPremium = user.plan === "premium";
  const limit = isPremium ? PRO_BUSINESS_LIMIT : FREE_BUSINESS_LIMIT;
  const count = user._count.businesses;
  return { plan: user.plan, count, limit, allowed: count < limit };
}

export async function getActiveBusiness(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeBusinessId: true },
  });
  const businesses = await prisma.business.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  const active =
    businesses.find((b) => b.id === user?.activeBusinessId) ?? businesses[0] ?? null;

  return { active, businesses };
}

export async function ensureActiveBusiness(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeBusinessId: true },
  });
  if (user?.activeBusinessId) {
    const exists = await prisma.business.findFirst({
      where: { id: user.activeBusinessId, userId },
      select: { id: true },
    });
    if (exists) return user.activeBusinessId;
  }
  const first = await prisma.business.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (first) {
    await prisma.user.update({
      where: { id: userId },
      data: { activeBusinessId: first.id },
    });
    return first.id;
  }
  return null;
}