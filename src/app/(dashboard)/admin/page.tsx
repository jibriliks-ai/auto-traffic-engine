import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNumber, timeAgo } from "@/lib/utils";
import {
  Users, Send, MousePointerClick, Coins, Crown, TrendingUp,
  Building2, Globe2, Shield, AlertTriangle,
} from "lucide-react";
import { AdminChart } from "@/components/admin/admin-chart";

async function getAdminData() {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [
    totalUsers, premiumUsers, totalSubmissions, totalClicksAgg,
    totalRevenueAgg, submissionsByType, daily, recentSubs, recentPayments,
    topCountries,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { plan: "premium" } }),
    prisma.submission.count(),
    prisma.submission.aggregate({ _sum: { clicks: true } }),
    prisma.payment.aggregate({ where: { status: "success" }, _sum: { amount: true } }),
    prisma.submission.groupBy({ by: ["type"], _count: true }),
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

  return {
    totals: {
      users: totalUsers,
      premiumUsers,
      submissions: totalSubmissions,
      clicks: totalClicksAgg._sum.clicks ?? 0,
      revenueNgn: totalRevenueAgg._sum.amount ?? 0,
    },
    byType: submissionsByType.map((s) => ({ type: s.type, count: s._count })),
    chart: {
      labels: Object.keys(days).map((d) => d.slice(5)),
      values: Object.values(days),
    },
    recentSubmissions: recentSubs,
    recentPayments,
    topCountries: topCountries.map((c) => ({ country: c.country!, count: c._count })),
  };
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { role: true },
  });
  if (user?.role !== "admin") {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-4 w-4" /> Admin access required
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account doesn't have admin privileges. To promote yourself:
        </p>
        <pre className="mt-2 overflow-auto rounded bg-muted p-3 text-xs">
          UPDATE "User" SET role='admin' WHERE email='{session.user.email}';
        </pre>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const data = await getAdminData();

  const stats = [
    { label: "Total users", value: formatNumber(data.totals.users), icon: Users },
    {
      label: "Premium users",
      value: formatNumber(data.totals.premiumUsers),
      icon: Crown,
      sub:
        data.totals.users > 0
          ? `${Math.round((data.totals.premiumUsers / data.totals.users) * 100)}% conversion`
          : "—",
    },
    { label: "Submissions", value: formatNumber(data.totals.submissions), icon: Send },
    { label: "Tracked clicks", value: formatNumber(data.totals.clicks), icon: MousePointerClick },
    {
      label: "Revenue",
      value: `₦${formatNumber(data.totals.revenueNgn)}`,
      icon: Coins,
    },
    {
      label: "MRR (est.)",
      value: `₦${formatNumber(data.totals.premiumUsers * 25000)}`,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            Platform-wide metrics, users, submissions, and revenue.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-2xl font-semibold tabular-nums">{s.value}</div>
            {s.sub && <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card p-6 lg:col-span-2">
          <div className="mb-4 font-semibold">Submissions · last 30 days</div>
          <AdminChart data={data.chart} />
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-6">
          <div className="mb-4 font-semibold">By module</div>
          <div className="space-y-2">
            {data.byType.map((t) => {
              const max = Math.max(...data.byType.map((x) => x.count), 1);
              return (
                <div key={t.type}>
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{t.type}</span>
                    <span className="tabular-nums text-muted-foreground">{t.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(t.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card lg:col-span-2">
          <div className="border-b border-border/60 p-5 font-semibold">Recent submissions</div>
          <div className="divide-y divide-border/60">
            {data.recentSubmissions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs uppercase">
                      {s.type}
                    </span>{" "}
                    {s.platform}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {s.user.email}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{timeAgo(s.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card">
          <div className="border-b border-border/60 p-5 font-semibold">Top countries</div>
          <div className="divide-y divide-border/60">
            {data.topCountries.length === 0 && (
              <div className="p-5 text-sm text-muted-foreground">No data yet.</div>
            )}
            {data.topCountries.map((c) => (
              <div key={c.country} className="flex items-center justify-between p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{c.country}</span>
                </div>
                <span className="text-muted-foreground">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card">
        <div className="border-b border-border/60 p-5 font-semibold">Recent payments</div>
        <div className="divide-y divide-border/60">
          {data.recentPayments.length === 0 && (
            <div className="p-5 text-sm text-muted-foreground">No payments yet.</div>
          )}
          {data.recentPayments.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div className="min-w-0 flex-1 truncate">{p.user.email}</div>
              <div className="font-medium tabular-nums">
                ₦{p.amount.toLocaleString()}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  p.status === "success"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                {p.status}
              </span>
              <div className="text-xs text-muted-foreground">
                {timeAgo(p.createdAt)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}