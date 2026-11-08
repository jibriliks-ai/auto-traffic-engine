"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Video, Loader2, Upload, Download, AlertTriangle, Check, X,
  Sparkles, Film, Clock, Link2, Wand2, ExternalLink,
} from "lucide-react";

type VideoRow = {
  id: string;
  title: string | null;
  status: string;
  url: string;
  error: string | null;
  durationSeconds: number | null;
  createdAt: string;
};

type SourcePreview = {
  title: string;
  priceText: string;
  cta: string;
  brandColor: string;
  imageUrl: string | null;
  benefits: string[];
  sourceUrl?: string;
};

const BRAND_COLORS = [
  "#4f46e5", "#7c3aed", "#db2777", "#dc2626",
  "#ea580c", "#16a34a", "#0891b2", "#0f172a",
];

export default function VideoCreatorPage() {
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [priceText, setPriceText] = useState("");
  const [ctaText, setCtaText] = useState("Link in bio → Comment LINK");
  const [brandColor, setBrandColor] = useState(BRAND_COLORS[0]);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState("");

  const [urlInput, setUrlInput] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);
  const [preview, setPreview] = useState<SourcePreview | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPremium =
    (session?.user as any)?.plan === "premium" ||
    (session?.user as any)?.isAdmin === true;

  async function loadVideos() {
    setLoadingList(true);
    try {
      const res = await fetch("/api/video/list");
      const data = await res.json();
      if (res.ok) setVideos(data.videos ?? []);
    } catch {}
    finally { setLoadingList(false); }
  }

  // Auto-fill from offerId= query param on mount
  useEffect(() => {
    loadVideos();
    const params = new URLSearchParams(window.location.search);
    const offerId = params.get("offerId");
    const urlParam = params.get("url");
    if (offerId) autoFill({ offerId });
    else if (urlParam) { setUrlInput(urlParam); autoFill({ url: urlParam }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function autoFill(payload: { url?: string; offerId?: string }) {
    setAutoFilling(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch("/api/video/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Auto-fill failed");

      const c = data.content;
      setTitle(c.title ?? "");
      setPriceText(c.priceText ?? "");
      setCtaText(c.cta ?? "Link in bio → Comment LINK");
      setBrandColor(c.brandColor ?? BRAND_COLORS[0]);
      if (c.imageUrl) {
        setImageUrlInput(c.imageUrl);
        setImageData(null);
        setImageName(null);
      }
      setPreview(c);
      setSourceLabel(
        data.source?.type === "offer"
          ? `Offer: ${c.title}`
          : data.source?.url ?? payload.url ?? null
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAutoFilling(false);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError("Image must be under 5MB.");
    const reader = new FileReader();
    reader.onload = () => {
      setImageData(String(reader.result));
      setImageName(file.name);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function generate() {
    setError(null);
    if (!title.trim()) return setError("Title is required.");
    const productImageUrl = imageData ?? imageUrlInput.trim();
    if (!productImageUrl) return setError("Upload a product image or paste an image URL.");

    setGenerating(true);
    setProgress(0);
    try {
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          priceText: priceText.trim(),
          ctaText: ctaText.trim(),
          brandColor,
          productImageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start render");
      const videoId = data.id as string;

      const started = Date.now();
      pollRef.current = setInterval(async () => {
        try {
          setProgress((p) => Math.min(95, p + 2));
          const poll = await fetch(`/api/video/status/${videoId}`);
          const info = await poll.json();
          if (info.status === "done") {
            clearPoll();
            setProgress(100);
            await loadVideos();
            setGenerating(false);
            setTimeout(() => setProgress(0), 1500);
          } else if (info.status === "failed") {
            clearPoll();
            setError(info.error ?? "Render failed.");
            setGenerating(false);
            setProgress(0);
          } else if (Date.now() - started > 100_000) {
            clearPoll();
            setError("Render timed out after 100s. Try again — first render after idle is slow.");
            setGenerating(false);
            setProgress(0);
          }
        } catch {}
      }, 2000);
    } catch (e: any) {
      setError(e.message);
      setGenerating(false);
      setProgress(0);
    }
  }

  function clearPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Video Creator</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Product image + title + price + CTA → 20-second vertical MP4 (1080×1920).
          </p>
        </div>
        {!isPremium && (
          <Link href="/billing" className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20">
            <Sparkles className="h-3.5 w-3.5" /> Free plan: 1 video. Upgrade for unlimited.
          </Link>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* ── AUTO-FILL FROM URL ── */}
      <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-purple-500/5 p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Wand2 className="h-4 w-4 text-primary" />
          Auto-fill from a product URL
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Paste any product page URL (Impact, PartnerStack, Shopify, Jumia, etc). We&apos;ll
          scrape it, write a punchy hook, pick a brand color, and fill the form below.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/product-page"
            className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
            disabled={autoFilling}
          />
          <button
            onClick={() => autoFill({ url: urlInput.trim() })}
            disabled={autoFilling || !urlInput.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {autoFilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {autoFilling ? "Scanning…" : "Auto-fill"}
          </button>
        </div>

        {preview && (
          <div className="mt-4 flex gap-3 rounded-lg border border-border/60 bg-card p-3">
            {preview.imageUrl && (
              <img
                src={preview.imageUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-lg bg-muted object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase text-primary">
                AI-generated draft
              </div>
              <div className="mt-1 line-clamp-2 text-sm font-medium">{preview.title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {preview.priceText && <span>{preview.priceText}</span>}
                <span style={{ color: preview.brandColor }}>
                  ● {preview.brandColor}
                </span>
                {sourceLabel && (
                  <span className="inline-flex items-center gap-1 truncate">
                    <ExternalLink className="h-3 w-3" />
                    {sourceLabel.slice(0, 60)}
                  </span>
                )}
              </div>
              {preview.benefits.length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  <strong>Benefits suggested:</strong> {preview.benefits.join(" · ")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── MANUAL FORM + LIBRARY ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="mb-4 text-base font-semibold">
            {preview ? "Review and generate" : "Create a video"}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Product image *</label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <label className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" />
                  {imageName ? "Change file" : "Upload file"}
                  <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                </label>
                <input
                  value={imageUrlInput}
                  onChange={(e) => { setImageUrlInput(e.target.value); setImageData(null); setImageName(null); }}
                  placeholder="…or paste image URL"
                  disabled={!!imageData}
                  className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
                />
              </div>
              {imageData && (
                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" /> {imageName}
                  <button type="button" onClick={() => { setImageData(null); setImageName(null); }} className="text-rose-500 hover:underline">remove</button>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Title / Hook *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Wireless Earbuds Pro — Touch Control" maxLength={60} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Price text</label>
              <input value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="$12.99 — was $39.99 — 67% OFF" maxLength={40} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Call to action</label>
              <input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Link in bio → Comment LINK" maxLength={60} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Brand color</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {BRAND_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setBrandColor(c)} style={{ backgroundColor: c }} className={`h-8 w-8 rounded-lg transition-all ${brandColor === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`} aria-label={`Color ${c}`} />
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button onClick={generate} disabled={generating} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
                {generating ? `Rendering… ${progress}%` : "Generate 20s Video"}
              </button>
              {generating && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              First render after idle can take 45–60s (cold start). Download the MP4 before
              leaving the page — files don&apos;t persist across server restarts on the free tier.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Your videos</h2>
            <button onClick={loadVideos} className="text-xs text-muted-foreground hover:text-foreground">refresh</button>
          </div>
          {loadingList ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-primary" />
            </div>
          ) : videos.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Video className="mx-auto mb-2 h-8 w-8 opacity-40" /> No videos yet.
            </div>
          ) : (
            <div className="space-y-2">
              {videos.map((v) => (
                <div key={v.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-medium">{v.title ?? "Untitled"}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {new Date(v.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {v.status === "done" && (
                      <a href={v.url} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
                        <Download className="h-3 w-3" /> MP4
                      </a>
                    )}
                    {v.status === "rendering" && (
                      <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 text-xs font-medium text-primary">
                        <Loader2 className="h-3 w-3 animate-spin" /> Rendering
                      </span>
                    )}
                    {v.status === "failed" && (
                      <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-rose-500/10 px-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                        <X className="h-3 w-3" /> Failed
                      </span>
                    )}
                  </div>
                  {v.status === "failed" && v.error && (
                    <div className="mt-2 break-words rounded bg-rose-500/5 p-2 text-xs text-rose-600 dark:text-rose-400">
                      {v.error.slice(0, 200)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}