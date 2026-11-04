"use client";

import { useState } from "react";
import {
  Search, Sparkles, Loader2, CheckCircle2, AlertTriangle, XCircle,
  Copy, Download, ArrowRight, Wand2,
} from "lucide-react";

// ---------- Types ----------
type Severity = "critical" | "warning" | "passed";
type Issue = {
  id: string; severity: Severity; category: string; message: string; detail?: string;
};
type Metrics = {
  titleLength: number; metaDescriptionLength: number; h1Count: number; h2Count: number;
  imageCount: number; imagesWithAlt: number; schemaFound: boolean;
  internalLinks: number; wordCount: number;
};
type Audit = {
  score: number; issues: Issue[]; metrics: Metrics;
  title: string; metaDescription: string; h1: string; url: string;
};
type FixResult = {
  fixedHtml: string; keyword: string;
  before: { score: number; metrics: Metrics };
  after: { score: number; metrics: Metrics };
  improvements: string[];
};

// ---------- Score gauge ----------
function ScoreGauge({ score, size = 180 }: { score: number; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);
  const color =
    score >= 80 ? "oklch(0.7 0.15 145)" :
    score >= 50 ? "oklch(0.78 0.16 75)" :
    "oklch(0.65 0.22 25)";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor"
          strokeWidth={stroke} fill="none" className="text-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color}
          strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tabular-nums">{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

// ---------- Metric pill ----------
function Metric({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-rose-500" />
        )}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

// ---------- Issue row ----------
function IssueRow({ issue }: { issue: Issue }) {
  const Icon =
    issue.severity === "passed" ? CheckCircle2 :
    issue.severity === "warning" ? AlertTriangle :
    XCircle;
  const color =
    issue.severity === "passed" ? "text-emerald-500" :
    issue.severity === "warning" ? "text-amber-500" :
    "text-rose-500";
  return (
    <div className="flex items-start gap-3 border-b border-border/60 p-4 last:border-0">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {issue.category}
          </span>
          {issue.detail && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {issue.detail}
            </span>
          )}
        </div>
        <div className="mt-1 text-sm">{issue.message}</div>
      </div>
    </div>
  );
}

// ---------- Main page ----------
export default function SeoPage() {
  const [url, setUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [audit, setAudit] = useState<Audit | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [error, setError] = useState("");

  const [fix, setFix] = useState<FixResult | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixError, setFixError] = useState("");
  const [copied, setCopied] = useState(false);

  async function runAudit() {
    if (!url.trim()) return;
    setAuditing(true);
    setError("");
    setAudit(null);
    setFix(null);
    try {
      const res = await fetch("/api/seo/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Audit failed");
      setAudit(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAuditing(false);
    }
  }

  async function runFix() {
    if (!audit || !keyword.trim()) return;
    setFixing(true);
    setFixError("");
    setFix(null);
    try {
      const res = await fetch("/api/seo/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: audit.url, keyword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fix failed");
      setFix(data);
    } catch (e: any) {
      setFixError(e.message);
    } finally {
      setFixing(false);
    }
  }

  function copyHtml() {
    if (!fix) return;
    navigator.clipboard.writeText(fix.fixedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadHtml() {
    if (!fix) return;
    const blob = new Blob([fix.fixedHtml], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const titleMatch = fix.fixedHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
    const rawTitle = titleMatch ? titleMatch[1].trim().slice(0, 40) : "page";
    const safeTitle = rawTitle.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9\-_]/g, "") || "page";
    a.download = `optimized-${safeTitle}.html`;
    a.click();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">SEO Audit</h1>
        <p className="mt-1 text-muted-foreground">
          Score any URL in seconds, then let AI rewrite your page for the keywords that matter.
        </p>
      </div>

      {/* Input card */}
      <div className="rounded-xl border border-border/60 bg-card p-6">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAudit()}
              placeholder="https://example.com/page-to-audit"
              className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <button
            onClick={runAudit}
            disabled={auditing || !url.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {auditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {auditing ? "Auditing…" : "Run audit"}
          </button>
        </div>
        {error && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}
      </div>

      {/* Audit results */}
      {audit && (
        <>
          {/* Score + metrics */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card p-8">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                SEO Score
              </div>
              <div className="my-4">
                <ScoreGauge score={audit.score} />
              </div>
              <div className="text-sm font-medium">
                {audit.score >= 80 ? "Excellent" : audit.score >= 50 ? "Needs work" : "Poor"}
              </div>
              <div className="mt-1 line-clamp-2 text-center text-xs text-muted-foreground">
                {audit.title || audit.url}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4">
              <Metric label="Title" value={`${audit.metrics.titleLength} chars`} ok={audit.metrics.titleLength >= 50 && audit.metrics.titleLength <= 60} />
              <Metric label="Meta" value={`${audit.metrics.metaDescriptionLength} chars`} ok={audit.metrics.metaDescriptionLength >= 120 && audit.metrics.metaDescriptionLength <= 155} />
              <Metric label="H1" value={`${audit.metrics.h1Count}`} ok={audit.metrics.h1Count === 1} />
              <Metric label="H2" value={`${audit.metrics.h2Count}`} ok={audit.metrics.h2Count >= 2} />
              <Metric label="Words" value={`${audit.metrics.wordCount}`} ok={audit.metrics.wordCount >= 500} />
              <Metric label="Images alt" value={`${audit.metrics.imagesWithAlt}/${audit.metrics.imageCount}`} ok={audit.metrics.imageCount === 0 || audit.metrics.imagesWithAlt === audit.metrics.imageCount} />
              <Metric label="Schema" value={audit.metrics.schemaFound ? "Yes" : "No"} ok={audit.metrics.schemaFound} />
              <Metric label="Internal links" value={`${audit.metrics.internalLinks}`} ok={audit.metrics.internalLinks >= 2} />
            </div>
          </div>

          {/* Issues */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-card lg:col-span-2">
              <div className="flex items-center justify-between border-b border-border/60 p-5">
                <div className="font-semibold">Findings</div>
                <div className="text-sm text-muted-foreground">
                  {audit.issues.filter((i) => i.severity === "critical").length} critical ·{" "}
                  {audit.issues.filter((i) => i.severity === "warning").length} warnings ·{" "}
                  {audit.issues.filter((i) => i.severity === "passed").length} passing
                </div>
              </div>
              <div>
                {audit.issues.map((issue) => <IssueRow key={issue.id} issue={issue} />)}
              </div>
            </div>

            {/* Fix panel */}
            <div className="rounded-xl border border-border/60 bg-card">
              <div className="border-b border-border/60 p-5">
                <div className="flex items-center gap-2 font-semibold">
                  <Wand2 className="h-4 w-4 text-primary" /> Fix with AI
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Generate a fully optimized replacement page.
                </div>
              </div>
              <div className="space-y-3 p-4">
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Target keyword (e.g. email marketing agency)"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
                />
                <button
                  onClick={runFix}
                  disabled={fixing || !keyword.trim()}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {fixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {fixing ? "Generating…" : "Fix with AI"}
                </button>
                {fixError && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                    {fixError}
                  </div>
                )}
                {fixing && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    AI is rewriting your page — this takes 15–30 seconds.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Fix result */}
      {fix && (
        <div className="rounded-xl border border-border/60 bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-5">
            <div>
              <div className="font-semibold">Fixed page ready</div>
              <div className="text-xs text-muted-foreground">
                Optimized for “{fix.keyword}”
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyHtml}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
              >
                <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy HTML"}
              </button>
              <button
                onClick={downloadHtml}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <Download className="h-3.5 w-3.5" /> Download .html
              </button>
            </div>
          </div>

          {/* Before/after score */}
          <div className="grid gap-4 border-b border-border/60 p-5 md:grid-cols-3">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">Before</div>
              <div className="text-2xl font-semibold tabular-nums">{fix.before.score}</div>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">After</div>
              <div className="text-2xl font-semibold tabular-nums text-emerald-500">
                {fix.after.score}
              </div>
            </div>
          </div>

          {/* Improvements */}
          {fix.improvements.length > 0 && (
            <div className="border-b border-border/60 p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Improvements
              </div>
              <ul className="space-y-1.5">
                {fix.improvements.map((imp, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* HTML preview */}
          <div className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Optimized HTML
            </div>
            <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed">
              <code>{fix.fixedHtml}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}