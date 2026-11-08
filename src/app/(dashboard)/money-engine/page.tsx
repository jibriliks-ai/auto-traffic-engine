"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles, RefreshCw, TrendingUp, DollarSign, Package, Cpu,
  Loader2, AlertTriangle, Settings, Wand2, X,
} from "lucide-react";

type Offer = {
  id: string;
  productType: "digital" | "physical";
  platform: string;
  title: string;
  imageUrl: string | null;
  frontEndPrice: string | null;
  originalPrice: string | null;
  commissionAmount: string | null;
  commissionPct: string | null;
  epc: string;
  orders7days: number;
  score: string;
  status: string;
  priority: string;
  isRecurring: boolean;
};
type Stats = { totalActive: number; digitalCount: number; physicalCount: number };
type GeneratedPost = { id: string; trafficModule: string; caption: string; script: string };

const TABS = [
  { key: "all", label: "All" },
  { key: "digital", label: "Digital" },
  { key: "physical", label: "Physical" },
] as const;
const MODULES = ["tiktok", "facebook", "x", "youtube"] as const;

export default function MoneyEnginePage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<"all" | "digital" | "physical">("all");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<GeneratedPost[] | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = tab === "all" ? "" : `?product_type=${tab}`;
      const res = await fetch(`/api/money-engine/offers${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load offers");
      setOffers(data.offers ?? []);
      setStats(data.stats ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function seedMock() {
    setSyncing(true);
    setError("");
    try {
      const res = await fetch("/api/money-engine/seed-mock", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }
  async function generate(offerId: string) {
    setGenerating(offerId);
    setDrafts(null);
    setDraftError(null);
    try {
      const res = await fetch("/api/money-engine/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, trafficModules: MODULES }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setDrafts(data.posts ?? []);
      if (data.errors?.length) setDraftError(data.errors.join(" · "));
    } catch (e: any) {
      setDraftError(e.message);
    } finally {
      setGenerating(null);
    }
  }

  useEffect(() => { load(); }, [tab]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Auto Money Engine</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Personalized offers from 8 affiliate networks — digital + physical.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/money-engine/settings"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <button
            onClick={seedMock}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? "Syncing…" : offers.length === 0 ? "Load Demo Offers" : "Sync Now"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{error}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Sparkles className="h-4 w-4" />} label="Active Offers" value={stats?.totalActive ?? 0} />
        <StatCard icon={<Cpu className="h-4 w-4" />} label="Digital" value={stats?.digitalCount ?? 0} />
        <StatCard icon={<Package className="h-4 w-4" />} label="Physical" value={stats?.physicalCount ?? 0} />
      </div>

      <div className="flex gap-2 border-b border-border/60">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >{t.label}</button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" /> Loading offers…
          </div>
        ) : offers.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No offers yet. Click <strong>Load Demo Offers</strong>.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {offers.map((o) => (
              <div key={o.id} className="flex flex-wrap items-start gap-3 p-4">
                <img src={o.imageUrl ?? "https://via.placeholder.com/64"} alt=""
                  className="h-14 w-14 shrink-0 rounded-lg bg-muted object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      o.productType === "digital" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}>{o.productType}</span>
                    <span className="text-xs text-muted-foreground">{o.platform}</span>
                    {o.isRecurring && (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                        Recurring
                      </span>
                    )}
                    {o.priority === "high" && (
                      <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-yellow-600 dark:text-yellow-400">
                        Winner
                      </span>
                    )}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm font-medium">{o.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {o.frontEndPrice && (
                      <span className="inline-flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> ${Number(o.frontEndPrice).toFixed(2)}
                        {o.originalPrice && <span className="line-through opacity-60">${Number(o.originalPrice).toFixed(2)}</span>}
                      </span>
                    )}
                    <span>{o.productType === "digital" ? `EPC $${Number(o.epc).toFixed(2)}` : `${o.orders7days.toLocaleString()} orders/wk`}</span>
                    {o.commissionAmount && (
                      <span className="inline-flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> ${Number(o.commissionAmount).toFixed(2)}
                        {o.commissionPct && <span className="opacity-70">({Number(o.commissionPct).toFixed(0)}%)</span>}
                      </span>
                    )}
                    <span className="font-semibold text-foreground">Score {Number(o.score).toFixed(1)}</span>
                  </div>
                </div>
                <button
                  onClick={() => generate(o.id)}
                  disabled={generating === o.id}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                >
                  {generating === o.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  {generating === o.id ? "Generating…" : "Generate"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Connect a platform in <Link href="/money-engine/settings" className="text-primary underline">Settings</Link> to unlock personalized affiliate links. Until then, generated posts are saved as drafts with link status "PENDING_CONNECTION".
      </p>

      {draftError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
          {draftError}
        </div>
      )}

      {drafts && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setDrafts(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-base font-semibold">Generated drafts ({drafts.length})</div>
              <button onClick={() => setDrafts(null)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              {drafts.map((p) => (
                <div key={p.id} className="rounded-lg border border-border/60 p-3">
                  <div className="text-xs font-semibold uppercase text-primary">{p.trafficModule}</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm">{p.caption}</div>
                  {p.script && p.trafficModule !== "x" && (
                    <details className="mt-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Script / tags</summary>
                      <div className="mt-1 whitespace-pre-wrap">{p.script}</div>
                    </details>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Saved as <strong>drafts</strong> in the database. Video rendering + auto-post arrive in Phase 3.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}