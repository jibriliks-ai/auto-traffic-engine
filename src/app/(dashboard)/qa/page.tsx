"use client";

import { useState, useEffect } from "react";
import {
  Search,
  MessageSquare,
  ExternalLink,
  Copy,
  Loader2,
  Sparkles,
  Send,
} from "lucide-react";

const COUNTRIES = [
  "All",
  "USA",
  "UK",
  "Canada",
  "India",
  "Nigeria",
  "South Africa",
  "Germany",
  "Australia",
];

type QA = {
  id: string;
  platform: string;
  title: string;
  url: string;
  score: number;
  country: string;
  body?: string;
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

  // Prefill keyword from the user's active business
  useEffect(() => {
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
  }, []);

  async function search() {
    if (!keyword.trim()) return;
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch("/api/qa/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, country }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function draftReply(q: QA) {
    setDrafting(q.id);
    setActiveQuestion(q);
    setDraft("");
    setPublished(null);
    try {
      const res = await fetch("/api/qa/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.title, platform: q.platform, url: q.url }),
      });
      const data = await res.json();
      setDraft(data.draft ?? data.error ?? "");
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
      alert(e.message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Q&amp;A Finder</h1>
        <p className="mt-1 text-muted-foreground">
          Find live questions across 9 networks and reply with AI drafts that convert.
        </p>
      </div>

      {/* Search bar */}
      <div className="rounded-xl border border-border/60 bg-card p-6">
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
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="h-11 rounded-lg border border-border bg-background px-4 text-sm focus:border-primary focus:outline-none"
          >
            {COUNTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={search}
            disabled={loading || !keyword.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      {/* Results + Draft panel */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card lg:col-span-2">
          <div className="border-b border-border/60 p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Results</div>
              <div className="text-sm text-muted-foreground">
                {results.length} questions
              </div>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {results.length === 0 && !loading && (
              <div className="p-12 text-center text-sm text-muted-foreground">
                Enter a keyword to search across Reddit, Lemmy, Mbin, PieFed, StackExchange,
                Hacker News, Dev.to, and Discourse.
              </div>
            )}
            {loading && (
              <div className="p-12 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
                Searching 9 sources in parallel…
              </div>
            )}
            {results.map((q) => (
              <div key={q.id} className="flex items-start gap-3 p-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold uppercase">
                  {q.platform.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{q.title}</div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{q.platform}</span>
                    <span>·</span>
                    <span>{q.score} pts</span>
                    <span>·</span>
                    <span>{q.country}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
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
                    disabled={drafting === q.id}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                  >
                    {drafting === q.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Draft
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Draft panel */}
        <div className="rounded-xl border border-border/60 bg-card">
          <div className="border-b border-border/60 p-5">
            <div className="font-semibold">AI Draft</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {activeQuestion
                ? activeQuestion.title
                : "Select a question to draft a reply"}
            </div>
          </div>
          <div className="p-4">
            {drafting ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
                Writing your reply…
              </div>
            ) : draft ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-80 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none"
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