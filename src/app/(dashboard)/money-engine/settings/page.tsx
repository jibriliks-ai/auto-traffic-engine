"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Trash2, ExternalLink, Loader2, AlertTriangle, Check,
  X, ArrowLeft, Link2, Copy,
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
  price: string | null;
  originalPrice: string | null;
  currency: string;
  category: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function SettingsPage() {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/money-engine/tracking-links");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setLinks(data.links ?? []);
      setCounts(data.counts ?? {});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function disconnect(id: string) {
    if (!confirm("Remove this link? Content already generated will still contain it.")) return;
    await fetch(`/api/money-engine/tracking-links?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/money-engine"
          className="mt-1 grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Affiliate Connections</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste your affiliate tracking link for each product you want to promote.
            No API keys. No SID. No tokens. Just your link.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Platform cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {PLATFORM_CONFIG.map((p) => {
          const count = counts[p.id] ?? 0;
          const connected = count > 0;

          return (
            <div
              key={p.id}
              className="rounded-xl border border-border/60 bg-card p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-10 w-10 place-items-center rounded-lg text-white font-bold"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {connected
                        ? `${count} ${count === 1 ? "link" : "links"} added`
                        : "No links yet"}
                    </div>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    connected
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {connected ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  {connected ? "Ready" : "Setup"}
                </span>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">{p.description}</p>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setAdding(p.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" /> Add tracking link
                </button>
                <a
                  href={p.dashboardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
                >
                  <ExternalLink className="h-3 w-3" /> Open {p.name}
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Existing links list */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Your tracking links
        </h2>
        {loading ? (
          <div className="rounded-xl border border-border/60 bg-card p-12 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
          </div>
        ) : links.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card p-12 text-center">
            <Link2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No tracking links yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Click <strong>Add tracking link</strong> above to paste your first affiliate URL.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
            <div className="divide-y divide-border/60">
              {links.map((l) => (
                <div key={l.id} className="flex items-start gap-3 p-3">
                  {l.productImageUrl ? (
                    <img
                      src={l.productImageUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg bg-muted object-cover"
                    />
                  ) : (
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted text-xs uppercase text-muted-foreground">
                      {l.platform.slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{l.label}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {l.platform}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {l.productName}
                      {l.price && ` · ${l.currency === "USD" ? "$" : ""}${l.price}`}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <code className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px]">
                        {l.trackingUrl}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(l.trackingUrl)}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        title="Copy tracking URL"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => disconnect(l.id)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-rose-600 hover:bg-rose-500/5"
                    title="Remove link"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add link modal */}
      {adding && (
        <AddLinkModal
          platform={PLATFORM_CONFIG.find((p) => p.id === adding)!}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddLinkModal({
  platform,
  onClose,
  onSaved,
}: {
  platform: (typeof PLATFORM_CONFIG)[number];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState({
    label: "",
    productName: "",
    productImageUrl: "",
    merchantUrl: "",
    trackingUrl: "",
    price: "",
    originalPrice: "",
    currency: "USD",
    category: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/money-engine/tracking-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platform.id, ...values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    values.label.trim() && values.productName.trim() &&
    values.trackingUrl.trim() && values.merchantUrl.trim();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Add {platform.name} tracking link</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <details className="mb-4 rounded-lg border border-border/60 bg-muted/30 p-3">
          <summary className="cursor-pointer text-xs font-semibold">
            How to get your link from {platform.name}
          </summary>
          <ol className="mt-2 space-y-1 pl-4 text-xs text-muted-foreground">
            {platform.howTo.map((step, i) => (
              <li key={i} className="list-decimal">{step}</li>
            ))}
          </ol>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Example: <code>{platform.linkExample}</code>
          </p>
        </details>

        <div className="space-y-3">
          <Field label="Label *" value={values.label} onChange={(v) => setValues({ ...values, label: v })} placeholder="e.g. Tecno Spark 20" />
          <Field label="Product name *" value={values.productName} onChange={(v) => setValues({ ...values, productName: v })} placeholder="Tecno Spark 20 Pro 256GB" />
          <Field label="Product image URL" value={values.productImageUrl} onChange={(v) => setValues({ ...values, productImageUrl: v })} placeholder="https://..." />
          <Field label="Merchant URL * (where buyer lands)" value={values.merchantUrl} onChange={(v) => setValues({ ...values, merchantUrl: v })} placeholder="https://jumia.com.ng/tecno-spark-20" />
          <Field label="Your tracking URL * (affiliate link)" value={values.trackingUrl} onChange={(v) => setValues({ ...values, trackingUrl: v })} placeholder="https://jumia-ng.sjv.io/c/..." />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Price" value={values.price} onChange={(v) => setValues({ ...values, price: v })} placeholder="12.99" />
            <Field label="Original price" value={values.originalPrice} onChange={(v) => setValues({ ...values, originalPrice: v })} placeholder="39.99" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Currency" value={values.currency} onChange={(v) => setValues({ ...values, currency: v })} placeholder="USD" />
            <Field label="Category" value={values.category} onChange={(v) => setValues({ ...values, category: v })} placeholder="Phones" />
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-rose-500/10 p-2 text-xs text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !canSave}
            className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save Link"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
      />
    </div>
  );
}