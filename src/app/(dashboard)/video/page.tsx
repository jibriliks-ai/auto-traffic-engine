"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Video as VideoIcon, Loader2, Upload, Download, AlertTriangle,
  Check, X, Sparkles, Film, Clock, Wand2, ExternalLink, Play,
  Image as ImageIcon, Zap,
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
  { hex: "#4f46e5", name: "Indigo" },
  { hex: "#7c3aed", name: "Violet" },
  { hex: "#db2777", name: "Pink" },
  { hex: "#dc2626", name: "Red" },
  { hex: "#ea580c", name: "Orange" },
  { hex: "#16a34a", name: "Green" },
  { hex: "#0891b2", name: "Cyan" },
  { hex: "#0f172a", name: "Slate" },
];

export default function VideoCreatorPage() {
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [priceText, setPriceText] = useState("");
  const [ctaText, setCtaText] = useState("Link in bio → Comment LINK");
  const [brandColor, setBrandColor] = useState(BRAND_COLORS[0].hex);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState("");

  const [urlInput, setUrlInput] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);
  const [preview, setPreview] = useState<SourcePreview | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<VideoRow | null>(null);
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

  useEffect(() => {
    loadVideos();

    const params = new URLSearchParams(window.location.search);
    const oid = params.get("offerId");
    const urlParam = params.get("url");

    if (oid) {
      setOfferId(oid);
      autoFill({ offerId: oid });
    } else if (urlParam) {
      setUrlInput(urlParam);
      autoFill({ url: urlParam });
    }
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
      setBrandColor(c.brandColor ?? BRAND_COLORS[0].hex);
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
    const url = urlInput.trim();
    const currentOfferId =
      offerId || new URLSearchParams(window.location.search).get("offerId");

    if (!url && !currentOfferId) {
      return setError("Paste a product URL or open from an offer.");
    }

    setGenerating(true);
    setProgress(0);
    try {
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url || undefined,
          offerId: currentOfferId || undefined,
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
            setTimeout(() => setProgress(0), 1200);
          } else if (info.status === "failed") {
            clearPoll();
            setError(info.error ?? "Render failed.");
            setGenerating(false);
            setProgress(0);
          } else if (Date.now() - started > 600_000) {
            clearPoll();
            setError(
              "Render timed out after 6 minutes. Remotion on free tier is slow — try again."
            );
            setGenerating(false);
            setProgress(0);
          }
        } catch {}
      }, 3000);
    } catch (e: any) {
      setError(e.message);
      setGenerating(false);
      setProgress(0);
    }
  }

  function clearPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  const canGenerate =
    !generating &&
    (urlInput.trim().length > 0 ||
      offerId !== null ||
      (typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("offerId") !== null));

  return (
    <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Film className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">
              Video Creator
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground sm:pl-11">
            Paste a product URL → AI-generated 20-second animated advert (1080×1920, MP4).
          </p>
        </div>
        {!isPremium ? (
          <Link
            href="/billing"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="sm:hidden">Upgrade</span>
            <span className="hidden sm:inline">Free: 1 video · Upgrade for unlimited</span>
          </Link>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Zap className="h-3.5 w-3.5" /> Unlimited
          </span>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{error}</span>
          <button
            onClick={() => setError(null)}
            className="shrink-0 opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Auto-fill from URL */}
      <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Wand2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold sm:text-base">
              Auto-fill from a product URL
            </h2>
            <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
              Paste any product page — Jumia, AliExpress, Shopify, Impact, PartnerStack. We
              scrape it, write a punchy hook, and pick a brand color for you.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && urlInput.trim() && autoFill({ url: urlInput.trim() })
            }
            placeholder="https://example.com/product-page"
            className="h-11 w-full flex-1 rounded-xl border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
            disabled={autoFilling}
          />
          <button
            onClick={() => autoFill({ url: urlInput.trim() })}
            disabled={autoFilling || !urlInput.trim()}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-background px-5 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
          >
            {autoFilling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {autoFilling ? "Scanning…" : "Auto-fill"}
          </button>
        </div>

        {preview && (
          <div className="mt-4 flex gap-3 rounded-xl border border-border/60 bg-card p-3">
            {preview.imageUrl && (
              <img
                src={preview.imageUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-lg bg-muted object-cover sm:h-20 sm:w-20"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                <Check className="h-3 w-3" /> AI-generated draft
              </div>
              <div className="mt-1 line-clamp-2 text-sm font-medium">{preview.title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {preview.priceText && <span>{preview.priceText}</span>}
                <span className="inline-flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: preview.brandColor }}
                  />
                  {preview.brandColor}
                </span>
              </div>
              {sourceLabel && (
                <div className="mt-1 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{sourceLabel}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Form + Library grid */}
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[1fr_380px]">
        {/* Form */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            {preview ? "Optional overrides" : "Video settings"}
          </h2>

          <div className="space-y-4 sm:space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Product image (optional — auto-filled from URL)
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  {imageName ? "Change" : "Upload file"}
                  <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                </label>
                <div className="relative flex-1">
                  <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={imageUrlInput}
                    onChange={(e) => {
                      setImageUrlInput(e.target.value);
                      setImageData(null);
                      setImageName(null);
                    }}
                    placeholder="or paste image URL"
                    disabled={!!imageData}
                    className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>
              {imageData && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{imageName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setImageData(null);
                      setImageName(null);
                    }}
                    className="shrink-0 font-medium text-rose-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Title / Hook
                </label>
                <span className="text-[10px] text-muted-foreground">{title.length}/60</span>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Wireless Earbuds Pro — Touch Control"
                maxLength={60}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Price text
              </label>
              <input
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="$12.99 — was $39.99 — 67% OFF"
                maxLength={40}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Call to action
              </label>
              <input
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="Link in bio → Comment LINK"
                maxLength={60}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                Brand color
              </label>
              <div className="flex flex-wrap gap-2">
                {BRAND_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setBrandColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`h-10 w-10 rounded-xl transition-all ${
                      brandColor === c.hex
                        ? "ring-2 ring-foreground ring-offset-2 ring-offset-card"
                        : "hover:scale-105"
                    }`}
                    aria-label={c.name}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={generate}
                disabled={!canGenerate}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rendering… {progress}%
                  </>
                ) : (
                  <>
                    <Film className="h-4 w-4" />
                    Generate 20s Video
                  </>
                )}
              </button>

              {generating && (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Remotion render takes 60–180s on free tier. Download works while the page is open.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Library */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <VideoIcon className="h-4 w-4 text-primary" />
              Your videos
            </h2>
            <button
              onClick={loadVideos}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Refresh
            </button>
          </div>

          {loadingList ? (
            <div className="grid place-items-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mb-2 h-5 w-5 animate-spin text-primary" />
              Loading…
            </div>
          ) : videos.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-muted text-muted-foreground">
                <VideoIcon className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium">No videos yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your generated videos will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {videos.map((v) => (
                <div
                  key={v.id}
                  className="group rounded-xl border border-border/60 p-2.5 transition-colors hover:border-primary/40 hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => v.status === "done" && setPlayingVideo(v)}
                      disabled={v.status !== "done"}
                      className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted"
                      aria-label={v.status === "done" ? "Play video" : "Not ready"}
                    >
                      {v.status === "done" ? (
                        <>
                          <video
                            src={v.url}
                            preload="metadata"
                            muted
                            playsInline
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                            <Play className="h-5 w-5 fill-white text-white" />
                          </div>
                        </>
                      ) : v.status === "rendering" ? (
                        <div className="grid h-full w-full place-items-center">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      ) : (
                        <div className="grid h-full w-full place-items-center text-rose-500">
                          <X className="h-5 w-5" />
                        </div>
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-medium leading-tight">
                        {v.title ?? "Untitled"}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatRelative(new Date(v.createdAt))}</span>
                        {v.durationSeconds && (
                          <>
                            <span>·</span>
                            <span>{v.durationSeconds}s</span>
                          </>
                        )}
                      </div>
                    </div>

                    {v.status === "done" && (
                      <a
                        href={v.url}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground hover:opacity-90"
                        title="Download MP4"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                    {v.status === "failed" && (
                      <span className="shrink-0 rounded-md bg-rose-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-rose-600 dark:text-rose-400">
                        Failed
                      </span>
                    )}
                  </div>

                  {v.status === "failed" && v.error && (
                    <div className="mt-2 rounded-lg bg-rose-500/5 p-2 text-[11px] text-rose-600 dark:text-rose-400">
                      <div className="line-clamp-3 break-words">{v.error.slice(0, 240)}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full-screen video player */}
      {playingVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2"
          onClick={() => setPlayingVideo(null)}
        >
          <button
            onClick={() => setPlayingVideo(null)}
            className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <video
            src={playingVideo.url}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}