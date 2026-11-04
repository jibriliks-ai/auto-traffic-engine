import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNumber, timeAgo } from "@/lib/utils";
import {
  ArrowUpRight, BarChart3, MessageSquare, Megaphone, Globe2, Video, Share2,
  TrendingUp, MousePointerClick, Send, Sparkles,
} from "lucide-react";
import { ActivityChart } from "@/components/dashboard/activity-chart";

async function getDashboard(userId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [totalSubs, totalClicks, indexed, recent, byType, daily] = await Promise.all([
    prisma.submission.count({ where: { userId } }),
    prisma.submission.aggregate({ where: { userId }, _sum: { clicks: true } }),
    prisma.submission.count({ where: { userId, type: "indexer", status: "submitted" } }),
    prisma.submission.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.submission.groupBy({
      by: ["type"],
      where: { userId },
      _count: true,
    }),
    prisma.submission.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Build daily chart data (last 30 days)
  const days: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days[d.toISOString().slice(0, 10)] = 0;
  }
  daily.forEach((s) => {
    const key = s.createdAt.toISOString().slice(0, 10);
    if (days[key] !== undefined) days[key]++;
  });

  return {
    totalSubs,
    totalClicks: totalClicks._sum.clicks ?? 0,
    indexed,
    recent,
    byType,
    chart: {
      labels: Object.keys(days).map((d) => d.slice(5)),
      values: Object.values(days),
    },
  };
}

const moduleLinks = [
  { href: "/seo", label: "Run SEO Audit", icon: BarChart3, color: "text-blue-500" },
  { href: "/qa", label: "Find Q&A", icon: MessageSquare, color: "text-purple-500" },
  { href: "/classifieds", label: "Post Classified", icon: Megaphone, color: "text-amber-500" },
  { href: "/indexer", label: "Submit URL", icon: Globe2, color: "text-emerald-500" },
  { href: "/video", label: "Create Video", icon: Video, color: "text-rose-500" },
  { href: "/social", label: "Publish Post", icon: Share2, color: "text-cyan-500" },
];

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const data = await getDashboard((session.user as any).id);

  // Traffic Score = submissions + clicks*2 + indexed*5
  const score = data.totalSubs + data.totalClicks * 2 + data.indexed * 5;

  const stats = [
    { label: "Total Submissions", value: formatNumber(data.totalSubs), icon: Send, delta: "across all modules" },
    { label: "Tracked Clicks", value: formatNumber(data.totalClicks), icon: MousePointerClick, delta: "via /r/ links" },
    { label: "Indexed URLs", value: formatNumber(data.indexed), icon: Globe2, delta: "IndexNow + Google" },
    { label: "Traffic Score", value: formatNumber(score), icon: TrendingUp, delta: "grows with every action" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Your traffic engine at a glance.</p>
      </div>

      {/* Traffic Score hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-purple-500/5 to-blue-500/10 p-8">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> TRAFFIC SCORE
            </div>
            <div className="mt-2 text-6xl font-semibold tracking-tight md:text-7xl">
              {formatNumber(score)}
            </div>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Your aggregate growth metric. Every submission, click, and indexed URL moves it up.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/qa" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
              Find traffic <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-3xl font-semibold">{s.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Chart + Module shortcuts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">Activity · last 30 days</div>
              <div className="text-sm text-muted-foreground">Submissions per day</div>
            </div>
          </div>
          <ActivityChart data={data.chart} />
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-6">
          <div className="mb-4 font-semibold">Quick actions</div>
          <div className="space-y-2">
            {moduleLinks.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm transition hover:border-border hover:bg-muted/50"
              >
                <m.icon className={`h-4 w-4 ${m.color}`} />
                <span className="flex-1 font-medium">{m.label}</span>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent submissions */}
      <div className="rounded-xl border border-border/60 bg-card">
        <div className="flex items-center justify-between border-b border-border/60 p-5">
          <div className="font-semibold">Recent activity</div>
          <Link href="/submissions" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        <div className="divide-y divide-border/60">
          {data.recent.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No submissions yet. <Link href="/qa" className="text-primary hover:underline">Start with Q&A</Link>.
            </div>
          )}
          {data.recent.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold uppercase">
                  {s.type.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.platform}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.url}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{s.clicks} clicks</span>
                <span>{timeAgo(s.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}