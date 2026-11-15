"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, AlertTriangle, Copy, Check, Sparkles,
  MessageSquare, Video, Music, Image as ImageIcon, Youtube, Instagram,
} from "lucide-react";
import { TAG_MAP, type Niche } from "@/lib/money-engine/qaPromptBuilder";

type Platform = "answer" | "threads" | "pinterest" | "youtube" | "instagram";

const NICHES: Niche[] = [
  "physical", "digital", "finance", "jobs", "beauty", "tech", "general",
];

const PLATFORMS: { id: Platform; label: string; icon: any; color: string }[] = [
  { id: "answer", label: "Q&A Answer", icon: MessageSquare, color: "#4f46e5" },
  { id: "threads", label: "Threads", icon: MessageSquare, color: "#000000" },
  { id: "pinterest", label: "Pinterest", icon: ImageIcon, color: "#e60023" },
  { id: "youtube", label: "YouTube Shorts", icon: Youtube, color: "#ff0000" },
  { id: "instagram", label: "Instagram Reels", icon: Instagram, color: "#e4405f" },
];

type TrackingLink = { id: string; productName: string; label: string };

export default function QAEnginePage() {
  const [niche, setNiche] = useState<Niche>("general");
  const [productId, setProductId] = useState<string>("");
  const [products, setProducts] = useState<TrackingLink[]>([]);
  const [question, setQuestion] = useState("");
  const [platform, setPlatform] = useState<Platform>("answer");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ platform: string; content: any } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/money-engine/tracking-links")
      .then((r) => r.json())
      .then((d) => setProducts(d.links ?? []))
      .catch(() => {});
  }, []);

  async function generate() {
    if (!question.trim()) {
      setError("Enter a question first");
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/money-engine/qa/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, niche, productId: productId || null, question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResult({ platform: data.platform, content: data.content });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start gap-3">
        <Link href="/money-engine" className="mt-1 grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Q&A Content Engine</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate honest, niche-safe engagement content for 5 platforms. Reuses your saved affiliate links.
          </p>
        </div>
      </div>

      {/* Shared inputs */}
      <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Niche</label>
            <select value={niche} onChange={(e) => setNiche(e.target.value as Niche)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
              {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Product (optional)</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
              <option value="">— No product —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.productName || p.label}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className="text-xs font-medium text-muted-foreground">Question / prompt *</label>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Best earbuds for the gym?" className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
        </div>
      </div>

      {/* Platform tabs */}
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          const active = platform === p.id;
          return (
            <button key={p.id} onClick={() => setPlatform(p.id)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
              <Icon className="h-4 w-4" />
              {p.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button onClick={generate} disabled={generating || !question.trim()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 sm:w-auto sm:px-6">
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {generating ? "Generating…" : `Generate ${PLATFORMS.find((p) => p.id === platform)?.label}`}
      </button>

      {result && (
        <ResultDisplay platform={result.platform} content={result.content} copied={copied} onCopy={copy} />
      )}

      {/* TikTok teaser */}
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-center">
        <Video className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">TikTok comment generator</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Coming in the next update — find busy videos by tag + generate safe comments.
        </p>
      </div>
    </div>
  );
}

function ResultDisplay({
  platform, content, copied, onCopy,
}: {
  platform: string;
  content: any;
  copied: string | null;
  onCopy: (k: string, t: string) => void;
}) {
  const rows: { key: string; label: string; value: string }[] = [];

  if (platform === "answer" && content.answer) {
    rows.push({ key: "answer", label: "Answer", value: content.answer });
  } else if (platform === "threads") {
    if (content.question) rows.push({ key: "q", label: "Question post", value: content.question });
    if (content.tip) rows.push({ key: "t", label: "Tip post", value: content.tip });
    if (content.engagement) rows.push({ key: "e", label: "Engagement post", value: content.engagement });
  } else if (platform === "pinterest") {
    if (content.title) rows.push({ key: "ti", label: "Pin title", value: content.title });
    if (content.description) rows.push({ key: "de", label: "Description", value: content.description });
    if (content.imagePrompt) rows.push({ key: "ip", label: "Image prompt", value: content.imagePrompt });
    if (Array.isArray(content.hashtags)) rows.push({ key: "ht", label: "Hashtags", value: content.hashtags.join(" ") });
  } else if (platform === "youtube") {
    if (content.script) rows.push({ key: "sc", label: "30s script", value: content.script });
    if (content.title) rows.push({ key: "ti", label: "Title", value: content.title });
    if (content.description) rows.push({ key: "de", label: "Description", value: content.description });
    if (Array.isArray(content.hashtags)) rows.push({ key: "ht", label: "Hashtags", value: content.hashtags.join(" ") });
  } else if (platform === "instagram") {
    if (content.caption) rows.push({ key: "ca", label: "Caption", value: content.caption });
    if (Array.isArray(content.hashtags)) rows.push({ key: "ht", label: "Hashtags", value: content.hashtags.join(" ") });
    if (content.bestTime) rows.push({ key: "bt", label: "Best time", value: content.bestTime });
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key} className="rounded-lg border border-border/60 bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-primary">{r.label}</span>
            <button onClick={() => onCopy(r.key, r.value)} className="inline-flex h-7 items-center gap-1 rounded-md bg-primary/10 px-2 text-xs font-semibold text-primary hover:bg-primary/20">
              {copied === r.key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              Copy
            </button>
          </div>
          <div className="mt-2 whitespace-pre-wrap text-sm">{r.value}</div>
        </div>
      ))}
    </div>
  );
}