"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Plus, Loader2, AlertTriangle, X, Crown, Lock, Share2, Copy, Check,
  Trash2, ExternalLink, Link2, Sparkles, Package, Pencil, Upload,
  RefreshCw, Image as ImageIcon, MessageSquare, ArrowRight, Video,
  Download, Play,
} from "lucide-react";
import { PLATFORM_CONFIG } from "@/lib/money-engine/platforms";

type TrackingLink = {
  id: string;
  platform: string;
  label: string;
  productName: string;
  productImageUrl: string | null;
  merchantUrl: string;
  trackingUrl: string;
  slug: string | null;
  shortUrl: string | null;
  price: string | null;
  originalPrice: string | null;
  currency: string;
  category: string | null;
  description: string | null;
  scrapeStatus: string;
  scrapeError: string | null;
  generatedSnippets: string | null;
  hasImage: boolean;
  isActive: boolean;
  createdAt: string;
};

type ActiveTab = "links" | "qa";

export default function MoneyEnginePage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<ActiveTab>("links");
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TrackingLink | null>(null);
  const [snippetsFor, setSnippetsFor] = useState<TrackingLink | null>(null);
  const [salesCopyFor, setSalesCopyFor] = useState<TrackingLink | null>(null);
  const [videoFor, setVideoFor] = useState<TrackingLink | null>(null);
  const [regeneratingImage, setRegeneratingImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const plan = (session?.user as any)?.plan ?? "free";
  const isAdmin = (session?.user as any)?.isAdmin === true;
  const isUnlocked = isAdmin || plan === "premium";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/money-engine/tracking-links");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setLinks(data.links ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "authenticated" && isUnlocked) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isUnlocked]);

  async function deleteLink(id: string) {
    if (!confirm("Delete this link? The /go/ redirect will stop working immediately.")) return;
    await fetch(`/api/money-engine/tracking-links/${id}`, { method: "DELETE" });
    load();
  }

  async function regenerateImage(link: TrackingLink) {
    setRegeneratingImage(link.id);
    setImageError(null);
    try {
      const res = await fetch(`/api/money-engine/tracking-links/${link.id}/regenerate-image`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      await load();
    } catch (e: any) {
      setImageError(e.message);
      alert(`Regenerate image failed:\n\n${e.message}`);
    } finally {
      setRegeneratingImage(null);
    }
  }

  if (status === "loading") {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!isUnlocked) return <UpgradeGate />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Auto Money Engine</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add affiliate links, generate branded images, videos, and content for every platform.
          </p>
        </div>
        {activeTab === "links" && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add link
          </button>
        )}
      </div>

      <div className="flex gap-1 rounded-lg border border-border/60 bg-card p-1">
        <button
          onClick={() => setActiveTab("links")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "links"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          My Links
        </button>
        <button
          onClick={() => setActiveTab("qa")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "qa"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Q&A Content Engine
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === "links" && (
        <>
          {loading ? (
            <div className="rounded-xl border border-border/60 bg-card p-16 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            </div>
          ) : links.length === 0 ? (
            <EmptyState onAdd={() => setAdding(true)} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {links.map((l) => (
                <LinkCard
                  key={l.id}
                  link={l}
                  regeneratingImage={regeneratingImage === l.id}
                  onDelete={() => deleteLink(l.id)}
                  onEdit={() => setEditing(l)}
                  onShowSnippets={() => setSnippetsFor(l)}
                  onSalesCopy={() => setSalesCopyFor(l)}
                  onRegenerateImage={() => regenerateImage(l)}
                  onMakeVideo={() => setVideoFor(l)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "qa" && <QATabPlaceholder />}

      {adding && (
        <AddLinkModal
          onClose={() => setAdding(false)}
          onSuccess={() => {
            setAdding(false);
            load();
          }}
        />
      )}

      {editing && (
        <EditLinkModal
          link={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {snippetsFor && (
        <SnippetsModal link={snippetsFor} onClose={() => setSnippetsFor(null)} />
      )}

      {salesCopyFor && (
        <SalesCopyModal link={salesCopyFor} onClose={() => setSalesCopyFor(null)} />
      )}

      {videoFor && (
        <VideoModal link={videoFor} onClose={() => setVideoFor(null)} />
      )}
    </div>
  );
}

function QATabPlaceholder() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border/60 bg-card p-12 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <MessageSquare className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-semibold">Q&A Content Engine</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Generate honest, niche-safe engagement content for 5 platforms — Q&A answers,
        Threads posts, Pinterest pins, YouTube Shorts scripts, and Instagram Reels captions.
      </p>
      <Link
        href="/money-engine/qa"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <MessageSquare className="h-4 w-4" /> Launch Q&A Content Engine
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function LinkCard({
  link,
  regeneratingImage,
  onDelete,
  onEdit,
  onShowSnippets,
  onSalesCopy,
  onRegenerateImage,
  onMakeVideo,
}: {
  link: TrackingLink;
  regeneratingImage: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onShowSnippets: () => void;
  onSalesCopy: () => void;
  onRegenerateImage: () => void;
  onMakeVideo: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  // Any image source makes the Image / Video buttons usable
  const hasAnyImage = link.hasImage || Boolean(link.productImageUrl);
  const canPost = link.scrapeStatus === "success" && !!link.shortUrl;
  const canSalesCopy = Boolean(link.shortUrl) || Boolean(link.productName);

  function copyUrl() {
    if (!link.shortUrl) return;
    navigator.clipboard.writeText(link.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="relative aspect-square bg-muted">
        {link.hasImage && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/money-engine/tracking-links/${link.id}/image?v=${new Date(link.createdAt).getTime()}`}
            alt={link.productName}
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
            loading="lazy"
          />
        ) : link.productImageUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={link.productImageUrl}
            alt={link.productName}
            className="h-full w-full object-cover opacity-80"
            onError={() => setImgFailed(true)}
            loading="lazy"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <Package className="h-10 w-10 opacity-40" />
          </div>
        )}

        <div className="absolute right-2 top-2 flex gap-1.5">
          <button
            onClick={onEdit}
            className="grid h-8 w-8 place-items-center rounded-lg bg-black/60 text-white hover:bg-black/80"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="grid h-8 w-8 place-items-center rounded-lg bg-black/60 text-white hover:bg-rose-600"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-1 text-[10px] font-bold uppercase text-primary-foreground">
          {link.platform}
        </span>
      </div>

      <div className="p-4">
        <div className="line-clamp-2 text-sm font-semibold">{link.productName}</div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {link.price && <span className="font-semibold text-foreground">{link.price}</span>}
          {link.originalPrice && <span className="line-through">{link.originalPrice}</span>}
        </div>

        {link.shortUrl && (
          <div className="mt-3 flex items-center gap-1 rounded-lg bg-muted/50 p-2">
            <code className="flex-1 truncate text-[11px]">{link.shortUrl}</code>
            <button
              onClick={copyUrl}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
              title="Copy cloaked URL"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        )}

        {/* Row 1: Post / Video / Sales */}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <button
            onClick={onShowSnippets}
            disabled={!canPost}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            title="Generate and post social media captions"
          >
            <Sparkles className="h-3 w-3" /> Post
          </button>
          <button
            onClick={onMakeVideo}
            disabled={!hasAnyImage}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-violet-500/15 text-xs font-semibold text-violet-600 hover:bg-violet-500/25 disabled:opacity-50 dark:text-violet-400"
            title="Create a 20-second video ad"
          >
            <Video className="h-3 w-3" /> Video
          </button>
          <button
            onClick={onSalesCopy}
            disabled={!canSalesCopy}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-emerald-500/10 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-400"
            title="Generate Lemmy + Answer sales copy"
          >
            <MessageSquare className="h-3 w-3" /> Sales
          </button>
        </div>

        {/* Row 2: Image / Product / Upload */}
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          <button
            onClick={onRegenerateImage}
            disabled={regeneratingImage || !hasAnyImage}
            className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-border text-[11px] font-medium hover:bg-muted disabled:opacity-50"
            title="Regenerate branded marketing image"
          >
            {regeneratingImage ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ImageIcon className="h-3 w-3" />
            )}
            Image
          </button>
          <a
            href={link.merchantUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-border text-[11px] font-medium hover:bg-muted"
            title="Open product page"
          >
            <ExternalLink className="h-3 w-3" /> Product
          </a>
          <button
            onClick={onEdit}
            className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-border text-[11px] font-medium hover:bg-muted"
            title="Upload image or re-scrape"
          >
            <Upload className="h-3 w-3" /> Setup
          </button>
        </div>

        {link.scrapeStatus === "failed" && link.scrapeError && (
          <div className="mt-2 rounded-md bg-rose-500/10 p-2 text-[11px] text-rose-600 dark:text-rose-400">
            {link.scrapeError.slice(0, 100)}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border/60 bg-card p-12 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Link2 className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-semibold">No links yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Paste your first affiliate link. We&apos;ll scrape the product page, generate a
        branded image, write marketing copy for 4 platforms, and create a cloaked /go/
        URL that hides your real affiliate link from social media.
      </p>
      <button
        onClick={onAdd}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Add your first link
      </button>
    </div>
  );
}

// ─── Video Modal ───

function VideoModal({ link, onClose }: { link: TrackingLink; onClose: () => void }) {
  const [status, setStatus] = useState<"idle" | "rendering" | "done" | "error">("idle");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  async function generate() {
    setStatus("rendering");
    setError(null);
    setProgress(0);

    try {
      const res = await fetch(`/api/money-engine/tracking-links/${link.id}/generate-video`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setVideoId(data.id);

      const started = Date.now();
      const interval = setInterval(async () => {
        try {
          setProgress((p) => Math.min(95, p + 3));
          const poll = await fetch(`/api/video/status/${data.id}`);
          const info = await poll.json();
          if (info.status === "done") {
            clearInterval(interval);
            setStatus("done");
            setVideoUrl(info.url);
            setProgress(100);
          } else if (info.status === "failed") {
            clearInterval(interval);
            setStatus("error");
            setError(info.error ?? "Render failed");
          } else if (Date.now() - started > 120_000) {
            clearInterval(interval);
            setStatus("error");
            setError("Render timed out after 2 minutes. Try again.");
          }
        } catch {
          /* keep polling */
        }
      }, 2000);
    } catch (e: any) {
      setStatus("error");
      setError(e.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">20-second video ad</div>
            <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {link.productName}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={status === "rendering"}
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === "idle" && (
          <>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
                  <Video className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Vertical MP4 · 20s · 720p</div>
                  <div className="text-xs text-muted-foreground">
                    Product image + price + CTA + QR code with your cloaked URL
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              First render on free tier can take 30–60 seconds. You&apos;ll be able to download the MP4 when it&apos;s ready.
            </p>
            <button
              onClick={generate}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <Video className="h-4 w-4" /> Generate 20s Video
            </button>
          </>
        )}

        {status === "rendering" && (
          <div className="py-6 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-600" />
            <h3 className="mt-4 text-base font-semibold">Rendering video…</h3>
            <p className="mt-2 text-sm text-muted-foreground">{progress}% complete</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-violet-600 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Usually 15–30s on warm servers, 45–75s cold
            </p>
          </div>
        )}

        {status === "done" && videoUrl && (
          <div>
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
              className="w-full rounded-lg border border-border"
            />
            <div className="mt-4 flex gap-2">
              <a
                href={videoUrl}
                download
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <Download className="h-4 w-4" /> Download MP4
              </a>
              <button
                onClick={() => {
                  setStatus("idle");
                  setVideoId(null);
                  setVideoUrl(null);
                  setProgress(0);
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" /> New
              </button>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Video saved to your <Link href="/video" className="underline">Video library</Link>.
              On the free tier, download now — files expire on server restart.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="py-4 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
            <h3 className="mt-3 text-base font-semibold">Video failed</h3>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => {
                setStatus("idle");
                setError(null);
              }}
              className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sales Copy Modal ───

function SalesCopyModal({ link, onClose }: { link: TrackingLink; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copy, setCopy] = useState<{
    lemmy: { title: string; body: string };
    answer: { question: string; answer: string };
    cloakedUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/money-engine/tracking-links/${link.id}/sales-copy`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setCopy({ lemmy: data.lemmy, answer: data.answer, cloakedUrl: data.cloakedUrl });
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [link.id]);

  function copyText(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Sales copy — Lemmy + Answer</div>
            <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {link.productName}
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading && (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Generating sales copy…</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
            <strong>Generation failed:</strong> {error}
          </div>
        )}

        {copy && !loading && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-primary">Lemmy post</span>
                <button
                  onClick={() => copyText("lemmy", `${copy.lemmy.title}\n\n${copy.lemmy.body}`)}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-primary/10 px-2 text-xs font-semibold text-primary hover:bg-primary/20"
                >
                  {copied === "lemmy" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  Copy
                </button>
              </div>
              <div className="mt-2">
                <div className="text-sm font-semibold">{copy.lemmy.title}</div>
                <div className="mt-2 whitespace-pre-wrap text-sm">{copy.lemmy.body}</div>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-primary">Answer Q&A</span>
                <button
                  onClick={() =>
                    copyText("answer", `Q: ${copy.answer.question}\n\nA: ${copy.answer.answer}`)
                  }
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-primary/10 px-2 text-xs font-semibold text-primary hover:bg-primary/20"
                >
                  {copied === "answer" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  Copy
                </button>
              </div>
              <div className="mt-2">
                <div className="text-sm font-semibold">{copy.answer.question}</div>
                <div className="mt-2 whitespace-pre-wrap text-sm">{copy.answer.answer}</div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Copy and paste manually into Lemmy and Apache Answer. The URL included is your
              cloaked <code className="rounded bg-muted px-1">/go/</code> link.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Snippets Modal ───

function SnippetsModal({ link, onClose }: { link: TrackingLink; onClose: () => void }) {
  const [posting, setPosting] = useState<string | null>(null);
  const [postResult, setPostResult] = useState<any>(null);

  let snippets: any = null;
  if (link.generatedSnippets) {
    try {
      snippets = JSON.parse(link.generatedSnippets);
    } catch {}
  }

  async function post(platformKey: string, caption: string) {
    setPosting(platformKey);
    setPostResult(null);
    try {
      const res = await fetch("/api/social/post-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: null,
          caption,
          platforms: ["telegram", "bluesky", "mastodon"],
          useGeneratedImage: false,
          customImageUrl: `/api/money-engine/tracking-links/${link.id}/image`,
        }),
      });
      const data = await res.json();
      setPostResult(data);
    } catch (e: any) {
      setPostResult({ error: e.message });
    } finally {
      setPosting(null);
    }
  }

  if (!snippets) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl bg-card p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <p className="mt-3 text-sm">No snippets yet. Edit the link → Re-scrape to generate them.</p>
          <button
            onClick={onClose}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const modules = [
    { key: "tiktok", label: "TikTok", text: snippets.tiktok?.caption ?? "" },
    { key: "facebook", label: "Facebook", text: snippets.facebook?.caption ?? "" },
    { key: "x", label: "X (Twitter)", text: (snippets.x?.tweets ?? []).join("\n\n") },
    {
      key: "youtube",
      label: "YouTube",
      text: `${snippets.youtube?.title ?? ""}\n\n${snippets.youtube?.description ?? ""}`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Marketing content</div>
            <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {link.productName}
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {link.hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/money-engine/tracking-links/${link.id}/image`}
            alt=""
            className="mb-4 w-full rounded-lg border border-border/60"
          />
        )}

        <div className="space-y-3">
          {modules.map((m) => (
            <div key={m.key} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-primary">{m.label}</span>
                <button
                  onClick={() => post(m.key, m.text)}
                  disabled={posting === m.key}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-primary/10 px-2 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
                >
                  {posting === m.key ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Share2 className="h-3 w-3" />
                  )}
                  Post
                </button>
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm">{m.text}</div>
            </div>
          ))}
        </div>

        {postResult && (
          <div className="mt-4 rounded-lg bg-muted/30 p-3 text-xs">
            {postResult.error ? (
              <div className="text-rose-600">{postResult.error}</div>
            ) : (
              <div className="space-y-1">
                {(postResult.results ?? []).map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="font-medium capitalize">{r.platform}:</span>
                    {r.result?.ok ? (
                      <span className="text-emerald-600">✓ posted</span>
                    ) : (
                      <span className="text-rose-600">✗ {r.result?.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Link Modal ───

function AddLinkModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [platform, setPlatform] = useState<string>("impact");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [merchantUrl, setMerchantUrl] = useState("");
  const [manualImage, setManualImage] = useState<string | null>(null);
  const [stage, setStage] = useState<"form" | "processing" | "error">("form");
  const [error, setError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be under 8MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("File must be an image");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setManualImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!trackingUrl.trim() || !merchantUrl.trim()) {
      setError("Both URLs are required");
      return;
    }
    setStage("processing");
    setProgressMsg("Reading product page…");
    setError(null);

    const timer1 = setTimeout(() => setProgressMsg("Generating branded image…"), 6000);
    const timer2 = setTimeout(() => setProgressMsg("Writing marketing copy…"), 14000);

    try {
      const res = await fetch("/api/money-engine/tracking-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          trackingUrl,
          merchantUrl,
          manualImageBase64: manualImage,
        }),
      });
      const data = await res.json();
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (!res.ok || !data.ok) {
        setStage("error");
        setError(data.error ?? "Failed to process link");
        return;
      }
      onSuccess();
    } catch (e: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setStage("error");
      setError(e.message);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={stage === "form" ? onClose : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        {stage === "form" && (
          <>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold">Add affiliate link</h2>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Platform</label>
                <div className="mt-1 flex gap-2">
                  {PLATFORM_CONFIG.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPlatform(p.id)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                        platform === p.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Your affiliate link
                </label>
                <input
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="https://jumia-ng.sjv.io/c/123456/789/12345"
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Product page URL
                </label>
                <input
                  value={merchantUrl}
                  onChange={(e) => setMerchantUrl(e.target.value)}
                  placeholder="https://jumia.com.ng/tecno-spark-20"
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Product image (optional)
                </label>
                <label className="mt-1 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border text-xs font-medium hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" />
                  {manualImage ? "Change image" : "Upload if scraping fails"}
                  <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                </label>
              </div>

              {manualImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={manualImage}
                  alt="preview"
                  className="h-32 w-full rounded-lg border border-border object-cover"
                />
              )}

              {error && (
                <div className="rounded-lg bg-rose-500/10 p-2 text-xs text-rose-600 dark:text-rose-400">
                  {error}
                </div>
              )}

              <button
                onClick={submit}
                disabled={!trackingUrl.trim() || !merchantUrl.trim()}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" /> Detect and generate
              </button>
            </div>
          </>
        )}

        {stage === "processing" && (
          <div className="py-6 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h3 className="mt-4 text-base font-semibold">{progressMsg}</h3>
            <p className="mt-2 text-sm text-muted-foreground">15–30 seconds</p>
          </div>
        )}

        {stage === "error" && (
          <div className="py-4 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
            <h3 className="mt-3 text-base font-semibold">Failed</h3>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => {
                setStage("form");
                setError(null);
              }}
              className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Edit Link Modal ───

function EditLinkModal({
  link,
  onClose,
  onSuccess,
}: {
  link: TrackingLink;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [label, setLabel] = useState(link.label);
  const [productName, setProductName] = useState(link.productName);
  const [trackingUrl, setTrackingUrl] = useState(link.trackingUrl);
  const [merchantUrl, setMerchantUrl] = useState(link.merchantUrl);
  const [price, setPrice] = useState(link.price ?? "");
  const [originalPrice, setOriginalPrice] = useState(link.originalPrice ?? "");
  const [category, setCategory] = useState(link.category ?? "");
  const [description, setDescription] = useState(link.description ?? "");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/money-engine/tracking-links/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          productName,
          trackingUrl,
          merchantUrl,
          price: price || null,
          originalPrice: originalPrice || null,
          category,
          description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSuccessMsg("Saved");
      setTimeout(() => onSuccess(), 500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/money-engine/tracking-links/${link.id}/regenerate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Regenerate failed");
      setSuccessMsg("Regenerated");
      setTimeout(() => onSuccess(), 500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRegenerating(false);
    }
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be under 8MB");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/money-engine/tracking-links/${link.id}/upload-image`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setSuccessMsg("Uploaded + regenerated");
      setTimeout(() => onSuccess(), 800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  const busy = saving || regenerating || uploading;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold">Edit link</h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Product name</label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Affiliate URL</label>
            <input
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Product page URL</label>
            <input
              value={merchantUrl}
              onChange={(e) => setMerchantUrl(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Changing this clears scraped data — click Re-scrape after saving
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Price</label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Original price</label>
              <input
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-border bg-background p-2 text-sm"
            />
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="text-xs font-semibold">Product image</div>
            <div className="mt-2 flex gap-2">
              <label
                className={`inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border text-xs font-medium hover:bg-muted ${
                  uploading ? "opacity-50" : ""
                }`}
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {uploading ? "Uploading…" : link.hasImage ? "Replace image" : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={uploadImage}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              <button
                onClick={regenerate}
                disabled={regenerating || !link.shortUrl}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                {regenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {regenerating ? "Re-scraping…" : "Re-scrape"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-500/10 p-2 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="rounded-lg bg-emerald-500/10 p-2 text-xs text-emerald-600 dark:text-emerald-400">
              {successMsg}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Upgrade Gate ───

function UpgradeGate() {
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-purple-500/10 p-8 text-center sm:p-12">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-primary/20 text-primary">
          <Lock className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Auto Money Engine — Premium
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Add your Impact and WarriorPlus affiliate links. We generate branded images, videos,
          marketing copy for 4 platforms, cloaked /go/ redirects that protect you from social
          media bans, and a full Q&A Content Engine for engagement.
        </p>
        <Link
          href="/billing"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Crown className="h-4 w-4" /> Upgrade — $35/mo
        </Link>
      </div>
    </div>
  );
}