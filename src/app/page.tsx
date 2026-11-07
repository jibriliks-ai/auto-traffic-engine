import Link from "next/link";
import {
  Zap, Search, MessageSquare, Link2, Megaphone, Share2,
  Check, ArrowRight, Sparkles, Gauge,
} from "lucide-react";
import InstallPWAButton from "@/components/install-pwa-button";

const FEATURES = [
  {
    icon: Gauge,
    title: "Traffic Score",
    desc: "A single health number showing how discoverable your business is across search, social, and Q&A.",
  },
  {
    icon: Search,
    title: "SEO Audit",
    desc: "8-point technical check with AI-powered fixes for every issue found.",
  },
  {
    icon: MessageSquare,
    title: "Q&A Finder",
    desc: "Live questions from Reddit, Lemmy, HackerNews, StackExchange, and Dev.to — filtered by country.",
  },
  {
    icon: Link2,
    title: "Website Indexer",
    desc: "Push URLs to IndexNow and Google in one click. Bing, Yandex, and Naver included.",
  },
  {
    icon: Megaphone,
    title: "Classifieds",
    desc: "Auto-generated listings across 65 countries in 18 languages.",
  },
  {
    icon: Share2,
    title: "Social Poster",
    desc: "Schedule posts to 6 networks from one dashboard.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold sm:text-base">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" />
            </div>
            <span className="truncate">Auto Traffic Engine</span>
          </Link>

          <nav className="ml-auto hidden items-center gap-6 text-sm md:flex">
            <a href="#features" className="text-muted-foreground hover:text-foreground">Features</a>
            <a href="#how" className="text-muted-foreground hover:text-foreground">How it works</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground">Pricing</a>
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:px-4"
            >
              Start free <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3 w-3 text-primary" />
            6 modules · $35/month · cancel anytime
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Get your business{" "}
            <span className="text-primary">found everywhere</span>
          </h1>
          <p className="mt-6 text-base text-muted-foreground sm:text-lg">
            SEO audits, Q&A discovery, IndexNow submissions, classifieds in 65 countries,
            social posts, and video — all from one dashboard. Built for founders without a
            marketing team.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:w-auto"
            >
              Start free — no card required <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium hover:bg-muted sm:w-auto"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free forever plan · Premium $35/mo · No credit card for free
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/60 bg-muted/30 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything your business needs to be found
            </h2>
            <p className="mt-3 text-muted-foreground">
              Six modules that work together. No spreadsheets, no agencies, no busywork.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-border/60 bg-card p-6">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
            <p className="mt-3 text-muted-foreground">Three steps to a measurable traffic lift.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              {
                n: "1",
                title: "Add your business",
                desc: "Name, website, keywords. Takes 60 seconds.",
              },
              {
                n: "2",
                title: "Run the audits",
                desc: "SEO check, Q&A scan, and traffic score in one click.",
              },
              {
                n: "3",
                title: "Publish everywhere",
                desc: "AI drafts replies, generates classifieds, submits URLs, and posts to socials.",
              },
            ].map((s) => (
              <div key={s.n} className="rounded-xl border border-border/60 bg-card p-6">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {s.n}
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/60 bg-muted/30 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple pricing</h2>
            <p className="mt-3 text-muted-foreground">
              Start free. Upgrade when you're ready to grow faster.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
            {/* Free */}
            <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8">
              <h3 className="text-lg font-semibold">Free</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Everything you need to test the water.
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-sm text-muted-foreground">/forever</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "1 business",
                  "5 Q&A searches / day",
                  "2 URL submissions / day",
                  "1 video total",
                  "2 social posts / day",
                  "All 6 modules included",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-8 block rounded-lg border border-border py-2.5 text-center text-sm font-semibold hover:bg-muted"
              >
                Start free
              </Link>
            </div>

            {/* Premium */}
            <div className="relative rounded-2xl border-2 border-primary bg-card p-6 shadow-lg sm:p-8">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                Most popular
              </div>
              <h3 className="text-lg font-semibold">Premium</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                For founders serious about growth.
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$35</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Unlimited businesses",
                  "Unlimited Q&A searches",
                  "Unlimited URL submissions",
                  "Unlimited videos",
                  "Unlimited social posts",
                  "Priority AI processing",
                  "Cancel anytime",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-8 block rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Start 7-day trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to get found?</h2>
          <p className="mt-3 text-muted-foreground">
            Join founders using Auto Traffic Engine to rank higher, get cited, and reach more
            customers.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Start free — no card required <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="grid h-6 w-6 place-items-center rounded bg-primary text-primary-foreground">
              <Zap className="h-3 w-3" />
            </div>
            © {new Date().getFullYear()} Auto Traffic Engine
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/help" className="hover:text-foreground">Help</Link>
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
            <Link href="/register" className="hover:text-foreground">Sign up</Link>
          </div>
        </div>
      </footer>

      <InstallPWAButton />
    </div>
  );
}