import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEnvAdmin } from "@/lib/admin";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: "Unauthorized", status: 401 };
  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });
  const isAdmin =
    user?.role === "admin" || isEnvAdmin(user?.email ?? session.user.email);
  if (!isAdmin) return { error: "Forbidden", status: 403 };
  return { userId };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [
    totalUsers,
    premiumUsers,
    totalSubmissions,
    totalClicksAgg,
    totalRevenueAgg,
    submissionsByType,
    daily,
    recentSubs,
    recentPayments,
    topCountries,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { plan: "premium" } }),
    prisma.submission.count(),
    prisma.submission.aggregate({ _sum: { clicks: true } }),
    prisma.payment.aggregate({
      where: { status: "success" },
      _sum: { amount: true },
    }),
    prisma.submission.groupBy({
      by: ["type"],
      _count: true,
    }),
    prisma.submission.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.submission.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { user: { select: { email: true } } },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { email: true } } },
    }),
    prisma.submission.groupBy({
      by: ["country"],
      where: { country: { not: null } },
      _count: true,
      orderBy: { _count: { country: "desc" } },
      take: 8,
    }),
  ]);

  const days: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days[d.toISOString().slice(0, 10)] = 0;
  }
  daily.forEach((s) => {
    const k = s.createdAt.toISOString().slice(0, 10);
    if (days[k] !== undefined) days[k]++;
  });

  return NextResponse.json({
    totals: {
      users: totalUsers,
      premiumUsers,
      submissions: totalSubmissions,
      clicks: totalClicksAgg._sum.clicks ?? 0,
      revenueNgn: totalRevenueAgg._sum.amount ?? 0,
    },
    byType: submissionsByType.map((s) => ({
      type: s.type,
      count: s._count,
    })),
    chart: {
      labels: Object.keys(days).map((d) => d.slice(5)),
      values: Object.values(days),
    },
    recentSubmissions: recentSubs,
    recentPayments: recentPayments,
    topCountries: topCountries.map((c) => ({
      country: c.country,
      count: c._count,
    })),
  });
}