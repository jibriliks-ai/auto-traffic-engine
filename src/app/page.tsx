import Link from "next/link";
import { ArrowRight, BarChart3, MessageSquare, Video, Globe2, Sparkles, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";

async function getStats() {
  try {
    const [users, submissions, clicks] = await Promise.all([
      prisma.user.count(),
      prisma.submission.count(),
      prisma.submission.aggregate({ _sum: { clicks: true } }),
    ]);
    return { users, submissions, clicks: clicks._sum.clicks ?? 0 };
  } catch {
    return { users: 0, submissions: 0, clicks: 0 };
  }
}

const modules = [
  { icon: BarChart3, title: "SEO Audit + AI Fix", desc: "Score any URL in seconds, then let AI rewrite your page for the keywords that matter." },
  { icon: MessageSquare, title: "Q&A Finder", desc: "Surface live questions across 6 networks and reply with AI drafts that convert." },
  { icon: Globe2, title: "Classifieds Engine", desc: "65 countries × 10 sites — unique AI-generated ad copy for each, ready to post." },
  { icon: Sparkles, title: "Instant Indexer", desc: "Push URLs to IndexNow (Bing, Yandex, Naver) and Google Indexing API in one click." },
  { icon: Video, title: "15-20s Video Creator", desc: "Turn a product image into a ready-to-post video with AI voiceover." },
  { icon: ArrowRight, title: "Social Poster", desc: "Publish to Facebook Pages and X, with click tracking and lead webhooks." },
];

export default async function LandingPage() {
  const stats = await getStats();
  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/40 backdrop-blur-xl bg-background/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            Auto Traffic Engine
          </Link>
          <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <Link href="/help" className="hover:text-foreground">Docs</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link href="/register" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="gradient-mesh relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 py-24 text-center md:py-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Live traffic engine · updated hourly
          </div>
          <h1 className="mx-auto max-w-4xl text-5xl font-semibold tracking-tight md:text-7xl">
            Drive real traffic in <span className="bg-gradient-to-r from-primary via-purple-500 to-blue-500 bg-clip-text text-transparent">days</span>,
            not months.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Six marketing engines in one dashboard. Audit, answer, post, index, publish — every click tracked, every lead captured.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-8 font-medium text-primary-foreground hover:opacity-90">
              Start free — no card <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="inline-flex h-12 items-center rounded-lg border border-border px-8 font-medium hover:bg-muted">
              Live demo
            </Link>
          </div>

          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-6 text-center">
            {[
              { label: "Active users", value: stats.users || "—" },
              { label: "Submissions", value: stats.submissions || "—" },
              { label: "Tracked clicks", value: stats.clicks || "—" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-semibold md:text-4xl">{s.value.toLocaleString?.() ?? s.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold md:text-4xl">Everything you need to grow</h2>
          <p className="mt-4 text-muted-foreground">Seven modules. One login. Zero busywork.</p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <div key={m.title} className="group rounded-xl border border-border/60 bg-card p-6 transition hover:border-primary/40 hover:shadow-lg">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <m.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{m.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/40 bg-muted/30 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold md:text-4xl">Simple pricing</h2>
            <p className="mt-4 text-muted-foreground">Start free. Upgrade when traffic flows.</p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-8">
              <div className="text-sm font-medium text-muted-foreground">Free</div>
              <div className="mt-2 text-4xl font-semibold">$0</div>
              <p className="mt-2 text-sm text-muted-foreground">Perfect for testing the waters.</p>
              <ul className="mt-6 space-y-3 text-sm">
                {["Unlimited SEO audits", "Unlimited Q&A search", "Unlimited classifieds", "2 indexer submissions / day", "1 video total", "5 social posts / platform / day"].map((f) => (
                  <li key={f} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />{f}</li>
                ))}
              </ul>
              <Link href="/register" className="mt-8 block w-full rounded-lg border border-border py-3 text-center font-medium hover:bg-muted">
                Start free
              </Link>
            </div>
            <div className="relative rounded-2xl border-2 border-primary bg-card p-8 shadow-xl">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                Most popular
              </div>
              <div className="text-sm font-medium text-primary">Premium</div>
              <div className="mt-2 text-4xl font-semibold">
                $29<span className="text-lg font-normal text-muted-foreground">/mo</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">For serious operators.</p>
              <ul className="mt-6 space-y-3 text-sm">
                {["Everything in Free", "Unlimited indexer", "Unlimited videos", "Unlimited social posts", "Priority AI", "Lead webhook + CRM sync"].map((f) => (
                  <li key={f} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />{f}</li>
                ))}
              </ul>
              <Link href="/register?plan=premium" className="mt-8 block w-full rounded-lg bg-primary py-3 text-center font-medium text-primary-foreground hover:opacity-90">
                Go Premium
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/40 py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Auto Traffic Engine · Built for growth
      </footer>
    </main>
  );
}