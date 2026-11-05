"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search, MessageSquare, ExternalLink, Copy, Loader2, Sparkles, Send,
  Crown, AlertTriangle,
} from "lucide-react";

const COUNTRIES = [
  "All", "USA", "UK", "Canada", "India", "Nigeria",
  "South Africa", "Germany", "Australia",
];

type QA = {
  id: string;
  platform: string;
  title: string;
  url: string;
  score: number;
  country: string;
  snippet?: string;
};

type Usage = {
  used: number;
  limit: number | null;
  remaining: number | null;
  isPremium: boolean;
};

export default function QAPage() {
  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("All");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<QA[]>([]);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [activeQuestion, setActiveQuestion] = useState<QA | null>(null);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<{ url: string } | null>(null);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    // Prefill from business
    fetch("/api/businesses")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.activeBusinessId) return;
        const b = d.businesses?.find((x: any) => x.id === d.activeBusinessId);
        if (b?.keywords) {
          const first = b.keywords.split(",")[0].trim();
          setKeyword((prev) => prev || first);
        }
      })
      .catch(() => {});

    // Load usage
    fetch("/api/qa/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUsage(d))
      .catch(() => {});
  }, []);

  async function search() {
    if (!keyword.trim()) return;
    setLoading(true);
    setResults([]);
    setError("");
    try {
      const res = await fetch("/api/qa/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, country }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && data.usage) setUsage(data.usage);
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setResults(data.results ?? []);
      if (data.usage) setUsage(data.usage);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function draftReply(q: QA) {
    setDrafting(q.id);
    setActiveQuestion(q);
    setDraft("");
    setPublished(null);
    setError("");
    try {
      const res = await fetch("/api/qa/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.title, platform: q.platform, url: q.url }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && data.usage) setUsage(data.usage);
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setDraft(data.draft ?? "");
      if (data.usage) setUsage(data.usage);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDrafting(null);
    }
  }

  function copyDraft() {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function publishToClone() {
    if (!activeQuestion || !draft) return;
    setPublishing(true);
    setPublished(null);
    try {
      const res = await fetch("/api/qa/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: activeQuestion.title,
          answer: draft,
          sourceUrl: activeQuestion.url,
          sourcePlatform: activeQuestion.platform,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Publish failed");
      setPublished({ url: data.url });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPublishing(false);
    }
  }

  const atLimit = usage && !usage.isPremium && usage.remaining === 0;
  const nearLimit =
    usage && !usage.isPremium && usage.remaining !== null && usage.remaining <= 2 && usage.remaining > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Q&amp;A Finder</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Find live questions across 11 networks and reply with AI drafts that convert.
        </p>
      </div>

      {/* Usage bar */}
      {usage && !usage.isPremium && (
        <div
          className={`rounded-xl border p-4 ${
            atLimit
              ? "border-rose-500/40 bg-rose-500/5"
              : nearLimit
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-border/60 bg-card"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Sparkles className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2 text-sm font-medium">
                  <span>{usage.used} / {usage.limit} Q&amp;A interactions today</span>
                  <span className="text-xs text-muted-foreground">
                    ({usage.remaining} remaining)
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${
                      atLimit ? "bg-rose-500" : nearLimit ? "bg-amber-500" : "bg-primary"
                    }`}
                    style={{
                      width: `${
                        usage.limit ? Math.min(100, (usage.used / usage.limit) * 100) : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
            {atLimit && (
              <Link
                href="/billing"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <Crown className="h-3 w-3" /> Upgrade for unlimited
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Limit-reached banner */}
      {atLimit && (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-purple-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Crown className="h-4 w-4 text-primary" />
              You've reached your daily Q&amp;A limit
            </div>
            <Link
              href="/billing"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Upgrade to Premium — $35/mo
            </Link>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Search bar */}
      <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="e.g. best email marketing for small business"
              className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="h-11 flex-1 rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none md:flex-none md:px-4"
            >
              {COUNTRIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={search}
              disabled={loading || !keyword.trim() || !!atLimit}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 md:flex-none md:px-6"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </div>
      </div>

      {/* Results + draft panel */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card lg:col-span-2">
          <div className="border-b border-border/60 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Results</div>
              <div className="text-sm text-muted-foreground">{results.length} questions</div>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {results.length === 0 && !loading && (
              <div className="p-8 text-center text-sm text-muted-foreground sm:p-12">
                Enter a keyword to search across 11 platforms.
              </div>
            )}
            {loading && (
              <div className="p-8 text-center text-sm text-muted-foreground sm:p-12">
                <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
                Searching 11 sources in parallel…
              </div>
            )}
            {results.map((q) => (
              <div key={q.id} className="flex items-start gap-2 p-3 sm:gap-3 sm:p-4">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold uppercase sm:h-9 sm:w-9">
                  {q.platform.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-medium sm:line-clamp-1">{q.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{q.platform}</span>
                    <span>·</span>
                    <span>{q.score} pts</span>
                    <span className="hidden sm:inline">·</span>
                    <span className="hidden sm:inline">{q.country}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5 sm:gap-2">
                  <a
                    href={q.url}
                    target="_blank"
                    rel="noreferrer"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted"
                    title="Open"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => draftReply(q)}
                    disabled={drafting === q.id || !!atLimit}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-2 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 sm:px-3"
                  >
                    {drafting === q.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    <span className="hidden sm:inline">Draft</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card">
          <div className="border-b border-border/60 p-4 sm:p-5">
            <div className="font-semibold">AI Draft</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {activeQuestion ? activeQuestion.title : "Select a question to draft a reply"}
            </div>
          </div>
          <div className="p-3 sm:p-4">
            {drafting ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
                Writing your reply…
              </div>
            ) : draft ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-64 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none sm:h-80"
              />
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                AI drafts will appear here
              </div>
            )}
            {draft && (
              <div className="mt-3 space-y-2">
                <button
                  onClick={copyDraft}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm font-medium hover:bg-muted"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copied!" : "Copy draft"}
                </button>
                <button
                  onClick={publishToClone}
                  disabled={publishing}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {publishing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {publishing ? "Publishing…" : "Publish to Q&A Clone"}
                </button>
                {published && (
                  <a
                    href={published.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                  >
                    ✓ Published — view public page ↗
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}