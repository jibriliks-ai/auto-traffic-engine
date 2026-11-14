"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Plus,
  Loader2,
  AlertTriangle,
  X,
  Crown,
  Lock,
  Share2,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Link2,
  Sparkles,
  Package,
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
  generatedImage: string | null;
  generatedSnippets: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function MoneyEnginePage() {
  const { data: session, status } = useSession();
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [snippetsFor, setSnippetsFor] = useState<TrackingLink | null>(null);

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
    if (
      !confirm(
        "Delete this link? Content already generated keeps working, but the /go/ redirect will stop."
      )
    )
      return;
    await fetch(`/api/money-engine/tracking-links/${id}`, { method: "DELETE" });
    load();
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
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Auto Money Engine
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your affiliate links once. We handle the rest — branded images,
            marketing copy, cloaked redirects, social posting.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add link
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

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
              onDelete={() => deleteLink(l.id)}
              onShowSnippets={() => setSnippetsFor(l)}
            />
          ))}
        </div>
      )}

      {adding && (
        <AddLinkModal
          onClose={() => setAdding(false)}
          onSuccess={() => {
            setAdding(false);
            load();
          }}
        />
      )}

      {snippetsFor && (
        <SnippetsModal
          link={snippetsFor}
          onClose={() => setSnippetsFor(null)}
        />
      )}
    </div>
  );
}

function LinkCard({
  link,
  onDelete,
  onShowSnippets,
}: {
  link: TrackingLink;
  onDelete: () => void;
  onShowSnippets: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isReady = link.scrapeStatus === "success" && link.shortUrl;

  function copyUrl() {
    if (!link.shortUrl) return;
    navigator.clipboard.writeText(link.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="relative aspect-square bg-muted">
        {link.generatedImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={link.generatedImage}
            alt={link.productName}
            className="h-full w-full object-cover"
          />
        ) : link.productImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={link.productImageUrl}
            alt={link.productName}
            className="h-full w-full object-cover opacity-80"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <Package className="h-10 w-10 opacity-40" />
          </div>
        )}
        <button
          onClick={onDelete}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-black/60 text-white hover:bg-black/80"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-1 text-[10px] font-bold uppercase text-primary-foreground">
          {link.platform}
        </span>
      </div>

      <div className="p-4">
        <div className="line-clamp-2 text-sm font-semibold">
          {link.productName}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {link.price && (
            <span className="font-semibold text-foreground">{link.price}</span>
          )}
          {link.originalPrice && (
            <span className="line-through">{link.originalPrice}</span>
          )}
        </div>

        {link.shortUrl && (
          <div className="mt-3 flex items-center gap-1 rounded-lg bg-muted/50 p-2">
            <code className="flex-1 truncate text-[11px]">{link.shortUrl}</code>
            <button
              onClick={copyUrl}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
              title="Copy cloaked URL"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          {isReady ? (
            <button
              onClick={onShowSnippets}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <Sparkles className="h-3 w-3" /> Post to social
            </button>
          ) : (
            <div className="flex h-8 flex-1 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
              {link.scrapeStatus === "pending"
                ? "Processing…"
                : "Setup failed"}
            </div>
          )}
          <a
            href={link.merchantUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs font-medium hover:bg-muted"
            title="Open product page"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
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
        Paste your first affiliate link. We&apos;ll scrape the product page,
        generate a branded image, write marketing copy for 4 platforms, and
        create a cloaked /go/ URL that hides your real affiliate link from
        social media.
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
  const [stage, setStage] = useState<"form" | "scraping" | "generating" | "error">(
    "form"
  );
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!trackingUrl.trim() || !merchantUrl.trim()) {
      setError("Both URLs are required");
      return;
    }

    setStage("scraping");
    setError(null);

    const genTimer = setTimeout(() => setStage("generating"), 8000);

    try {
      const res = await fetch("/api/money-engine/tracking-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, trackingUrl, merchantUrl }),
      });
      const data = await res.json();
      clearTimeout(genTimer);
      if (!res.ok || !data.ok) {
        setStage("error");
        setError(data.error ?? "Failed to process link");
        return;
      }
      onSuccess();
    } catch (e: any) {
      clearTimeout(genTimer);
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
                <label className="text-xs font-medium text-muted-foreground">
                  Platform
                </label>
                <div className="mt-1 flex gap-2">
                  {PLATFORM_CONFIG.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPlatform(p.id)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
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
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Never shown publicly — used only as the /go/ redirect target
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Product page URL
                </label>
                <input
                  value={merchantUrl}
                  onChange={(e) => setMerchantUrl(e.target.value)}
                  placeholder="https://jumia.com.ng/tecno-spark-20"
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Where the product image and details come from
                </p>
              </div>

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

        {(stage === "scraping" || stage === "generating") && (
          <div className="py-6 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h3 className="mt-4 text-base font-semibold">
              {stage === "scraping"
                ? "Reading product page…"
                : "Generating content…"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {stage === "scraping"
                ? "Extracting title, image, price, and brand"
                : "Creating branded image + marketing copy for 4 platforms"}
            </p>
            <p className="mt-3 text-[11px] text-muted-foreground">
              This takes 15–30 seconds
            </p>
          </div>
        )}

        {stage === "error" && (
          <div className="py-4 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
            <h3 className="mt-3 text-base font-semibold">Something went wrong</h3>
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

function SnippetsModal({
  link,
  onClose,
}: {
  link: TrackingLink;
  onClose: () => void;
}) {
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
          customImageBase64: link.generatedImage,
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
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
        onClick={onClose}
      >
        <div className="w-full max-w-md rounded-2xl bg-card p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <p className="mt-3 text-sm">No snippets generated yet.</p>
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
    {
      key: "facebook",
      label: "Facebook",
      text: snippets.facebook?.caption ?? "",
    },
    {
      key: "x",
      label: "X (Twitter)",
      text: (snippets.x?.tweets ?? []).join("\n\n"),
    },
    {
      key: "youtube",
      label: "YouTube",
      text: `${snippets.youtube?.title ?? ""}\n\n${
        snippets.youtube?.description ?? ""
      }`,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
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

        {link.generatedImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={link.generatedImage}
            alt=""
            className="mb-4 w-full rounded-lg border border-border/60"
          />
        )}

        <div className="space-y-3">
          {modules.map((m) => (
            <div
              key={m.key}
              className="rounded-lg border border-border/60 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-primary">
                  {m.label}
                </span>
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
                      <span className="text-rose-600">
                        ✗ {r.result?.error}
                      </span>
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
          Add your Impact and WarriorPlus affiliate links. We generate branded
          images, marketing copy for 4 platforms, and cloaked /go/ redirects that
          protect you from social media bans.
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