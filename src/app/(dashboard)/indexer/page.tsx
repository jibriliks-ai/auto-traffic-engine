"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Globe2, Key, CheckCircle2, XCircle, AlertTriangle, Loader2,
  Copy, ExternalLink, Send, Crown, RefreshCw, Sparkles,
} from "lucide-react";
import { formatNumber, timeAgo } from "@/lib/utils";

type Status = {
  plan: string;
  indexnow: { keySet: boolean; key: string | null };
  google: { configured: boolean; error: string | null };
  usage: { used: number; limit: number | null; remaining: number | null };
  recent: Array<{
    id: string;
    platform: string;
    url: string;
    status: string;
    createdAt: string;
  }>;
};

type SubmitResult = {
  indexnow?: { ok: boolean; status: number; detail: string };
  google?: Array<{ url: string; ok: boolean; status: number; detail: string }>;
  saved?: number;
  error?: string;
};

export default function IndexerPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [urlText, setUrlText] = useState("");
  const [useIndexNow, setUseIndexNow] = useState(true);
  const [useGoogle, setUseGoogle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [statusError, setStatusError] = useState("");

  async function loadStatus() {
    setLoading(true);
    setStatusError("");
    try {
      const res = await fetch("/api/indexer/status");
      const data = await res.json();
      if (!res.ok) {
        setStatusError(data.error ?? `HTTP ${res.status}`);
      } else {
        setStatus(data);
      }
    } catch (e: any) {
      setStatusError(e.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  const urls = urlText
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);

  async function submit() {
    setError("");
    setResult(null);
    if (urls.length === 0) {
      setError("Enter at least one URL.");
      return;
    }
    const engines: string[] = [];
    if (useIndexNow) engines.push("indexnow");
    if (useGoogle) engines.push("google");
    if (engines.length === 0) {
      setError("Select at least one engine.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/indexer/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, engines }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed.");
      } else {
        setResult(data);
        await loadStatus();
        setUrlText("");
      }
    } catch (e: any) {
      setError(e.message ?? "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  function copyKey() {
    if (!status?.indexnow.key) return;
    navigator.clipboard.writeText(status.indexnow.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

   if (!status) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6">
        <div className="text-sm font-medium text-rose-600 dark:text-rose-400">
          Could not load indexer status
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {statusError || "Unknown error — check browser DevTools Network tab"}
        </div>
        <button
          onClick={loadStatus}
          className="mt-4 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Retry
        </button>
      </div>
    );
  }

  const { usage } = status;
  const outOfCredits = usage.remaining !== null && usage.remaining <= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Website Indexer</h1>
          <p className="mt-1 text-muted-foreground">
            Push URLs to search engines instantly — no waiting for crawlers.
          </p>
        </div>
        <button
          onClick={loadStatus}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">IndexNow key</span>
            {status.indexnow.keySet ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-500" />
            )}
          </div>
          <div className="mt-3 text-lg font-semibold">
            {status.indexnow.keySet ? "Configured" : "Missing"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {status.indexnow.keySet
              ? "Broadcasts to Bing, Yandex, Naver"
              : "Add INDEXNOW_KEY to env"}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Today's usage</span>
            <Globe2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-3 text-lg font-semibold tabular-nums">
            {formatNumber(usage.used)}
            {usage.limit !== null && (
              <span className="text-sm font-normal text-muted-foreground">
                {" "}/ {usage.limit}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {status.plan === "premium" ? "Unlimited plan" : "Free plan · resets daily"}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Google Indexing</span>
            {status.google.configured ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : status.google.error ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="mt-3 text-lg font-semibold">
            {status.google.configured ? "Ready" : "Optional"}
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {status.google.error ?? "Add GOOGLE_SERVICE_ACCOUNT_JSON to enable"}
          </div>
        </div>
      </div>

      {outOfCredits && status.plan !== "premium" && (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-purple-500/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <Crown className="h-4 w-4 text-primary" /> Daily limit reached
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Free plan includes 2 indexer submissions per day.
              </div>
            </div>
            <Link
              href="/billing"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Upgrade to Premium
            </Link>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Submit form */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-border/60 bg-card">
            <div className="border-b border-border/60 p-5">
              <div className="font-semibold">Submit URLs</div>
              <div className="mt-1 text-xs text-muted-foreground">
                One URL per line. All URLs must share the same hostname.
              </div>
            </div>
            <div className="space-y-4 p-5">
              <textarea
                value={urlText}
                onChange={(e) => setUrlText(e.target.value)}
                placeholder={"https://yoursite.com/page-1\nhttps://yoursite.com/page-2"}
                rows={6}
                className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm font-mono focus:border-primary focus:outline-none"
              />
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useIndexNow}
                    onChange={(e) => setUseIndexNow(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  IndexNow <span className="text-xs text-muted-foreground">(Bing, Yandex, Naver)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useGoogle}
                    onChange={(e) => setUseGoogle(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Google Indexing <span className="text-xs text-muted-foreground">(requires service account)</span>
                </label>
              </div>
              <button
                onClick={submit}
                disabled={submitting || outOfCredits}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting
                  ? "Submitting…"
                  : `Submit ${urls.length} URL${urls.length === 1 ? "" : "s"}`}
              </button>
              {error && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Result panel */}
          {result && (
            <div className="rounded-xl border border-border/60 bg-card">
              <div className="border-b border-border/60 p-5">
                <div className="font-semibold">
                  {result.saved
                    ? `${result.saved} URL${result.saved === 1 ? "" : "s"} successfully submitted`
                    : "Submission results"}
                </div>
              </div>
              <div className="space-y-3 p-5">
                {result.indexnow && (
                  <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                    {result.indexnow.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">IndexNow</div>
                      <div className="text-xs text-muted-foreground">{result.indexnow.detail}</div>
                    </div>
                  </div>
                )}
                {result.google?.map((g) => (
                  <div key={g.url} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                    {g.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-mono">{g.url}</div>
                      <div className="text-xs text-muted-foreground">{g.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent submissions */}
          <div className="rounded-xl border border-border/60 bg-card">
            <div className="border-b border-border/60 p-5">
              <div className="font-semibold">Recent submissions</div>
            </div>
            <div className="divide-y divide-border/60">
              {status.recent.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No submissions yet.
                </div>
              )}
              {status.recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-mono">{r.url}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.platform} · {timeAgo(new Date(r.createdAt))}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Setup panel */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border/60 bg-card">
            <div className="border-b border-border/60 p-5">
              <div className="flex items-center gap-2 font-semibold">
                <Key className="h-4 w-4 text-primary" /> Your IndexNow key
              </div>
            </div>
            <div className="space-y-4 p-5">
              {status.indexnow.key ? (
                <>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <code className="flex-1 truncate text-xs">{status.indexnow.key}</code>
                    <button
                      onClick={copyKey}
                      className="shrink-0 rounded p-1 hover:bg-background"
                      title="Copy"
                    >
                      {copied ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="text-xs leading-relaxed text-muted-foreground">
                    Save the key as{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                      {status.indexnow.key}.txt
                    </code>{" "}
                    at the root of the site you're submitting (e.g.{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                      https://yoursite.com/{status.indexnow.key}.txt
                    </code>
                    ). The file must contain only the key with no trailing newline.
                  </div>
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mb-1 inline h-3 w-3" /> If the key file isn't on
                    your domain, IndexNow returns 403.
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Set <code className="rounded bg-muted px-1 py-0.5">INDEXNOW_KEY</code> in your
                  environment, then refresh.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card">
            <div className="border-b border-border/60 p-5">
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> Google setup
              </div>
            </div>
            <div className="space-y-3 p-5 text-xs text-muted-foreground">
              <p>To enable Google Indexing:</p>
              <ol className="list-decimal space-y-1.5 pl-4">
                <li>Enable the Indexing API in Google Cloud</li>
                <li>Create a service account and download the JSON key</li>
                <li>Add the service-account email as an Owner in Search Console</li>
                <li>
                  Paste the JSON (one line) into{" "}
                  <code className="rounded bg-muted px-1 py-0.5">
                    GOOGLE_SERVICE_ACCOUNT_JSON
                  </code>
                </li>
              </ol>
              <a
                href="https://developers.google.com/search/apis/indexing-api/v3/quickstart"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Google quickstart <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}