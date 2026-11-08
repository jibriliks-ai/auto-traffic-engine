"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Building2, Plus, Loader2, Check, AlertTriangle, ExternalLink,
  Globe, FileText, Tag, ChevronDown, ChevronUp, Bug,
} from "lucide-react";

type Business = {
  id: string;
  name: string;
  website: string | null;
  description: string | null;
  keywords: string | null;
  createdAt: string;
};

type Usage = {
  allowed: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
  isPremium: boolean;
  isAdmin?: boolean;
};

export default function BusinessesPage() {
  const { data: session } = useSession();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);

  const role = (session?.user as any)?.role ?? "user";
  const plan = (session?.user as any)?.plan ?? "free";
  const isAdmin =
    (session?.user as any)?.isAdmin === true ||
    role === "admin" ||
    plan === "premium";

  // Max businesses the user can create (informational; the server is the source of truth)
  const softCap = isAdmin ? Infinity : plan === "premium" ? 3 : 1;
  const atSoftCap = businesses.length >= softCap;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/businesses");
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`API returned non-JSON (status ${res.status}): ${text.slice(0, 150)}`);
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setBusinesses(data.businesses ?? []);
      setActiveId(data.activeBusinessId ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createBusiness(formData: {
    name: string;
    website: string;
    description: string;
    keywords: string;
  }) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Server returned non-JSON (status ${res.status}): ${text.slice(0, 200)}`
        );
      }

      if (!res.ok) {
        throw new Error(
          `${data.error ?? "Failed to create"} (status ${res.status})`
        );
      }

      setSuccess(`Created "${data.business?.name ?? formData.name}" successfully!`);
      setShowForm(false);
      if (data.usage) setUsage(data.usage);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function switchActive(id: string) {
    setError(null);
    try {
      const res = await fetch("/api/businesses/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to switch");
      }
      setActiveId(id);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Businesses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the businesses Auto Traffic Engine promotes for you.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDebug((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
            title="Show debug info"
          >
            <Bug className="h-3.5 w-3.5" /> Debug
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setError(null);
              setSuccess(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add Business
          </button>
        </div>
      </div>

      {/* Debug panel */}
      {showDebug && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-xs">
          <div className="mb-2 font-semibold text-amber-700 dark:text-amber-400">Debug Info</div>
          <div className="grid gap-1 font-mono text-muted-foreground">
            <div>Email: <span className="text-foreground">{session?.user?.email ?? "—"}</span></div>
            <div>Role: <span className="text-foreground">{role}</span></div>
            <div>Plan: <span className="text-foreground">{plan}</span></div>
            <div>isAdmin: <span className="text-foreground">{String((session?.user as any)?.isAdmin)}</span></div>
            <div>Businesses count: <span className="text-foreground">{businesses.length}</span></div>
            <div>Soft cap (UI): <span className="text-foreground">{softCap === Infinity ? "unlimited" : softCap}</span></div>
            <div>Usage from API: <span className="text-foreground">{JSON.stringify(usage)}</span></div>
          </div>
          {(!isAdmin || plan !== "premium") && (
            <div className="mt-2 text-amber-700 dark:text-amber-400">
              ⚠ Your session does NOT report role=admin + plan=premium. Sign out and sign back in.
            </div>
          )}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1 break-words">{error}</div>
          <button onClick={() => setError(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Success banner */}
      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">{success}</div>
          <button onClick={() => setSuccess(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* List */}
      <div className="rounded-xl border border-border/60 bg-card">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
            Loading businesses…
          </div>
        ) : businesses.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No businesses yet. Click <strong>Add Business</strong> to get started.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {businesses.map((b) => {
              const isActive = b.id === activeId;
              return (
                <div key={b.id} className="flex items-start gap-3 p-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{b.name}</span>
                      {isActive && (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                          Active
                        </span>
                      )}
                    </div>
                    {b.website && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        <a href={b.website} target="_blank" rel="noreferrer" className="hover:underline">
                          {b.website}
                        </a>
                      </div>
                    )}
                    {b.description && (
                      <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                        <FileText className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="line-clamp-2">{b.description}</span>
                      </div>
                    )}
                    {b.keywords && (
                      <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                        <Tag className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="line-clamp-1">{b.keywords}</span>
                      </div>
                    )}
                  </div>
                  {!isActive && (
                    <button
                      onClick={() => switchActive(b.id)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
                    >
                      <ExternalLink className="h-3 w-3" /> Set active
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info footer */}
      <p className="text-xs text-muted-foreground">
        {isAdmin
          ? "Admin account — unlimited businesses."
          : plan === "premium"
          ? `${businesses.length} / 3 businesses used (Premium).`
          : `${businesses.length} / 1 business used (Free). Upgrade to Premium for up to 3.`}
      </p>

      {/* Create form modal */}
      {showForm && (
        <CreateBusinessModal
          onClose={() => setShowForm(false)}
          onSubmit={createBusiness}
          saving={saving}
        />
      )}
    </div>
  );
}

function CreateBusinessModal({
  onClose,
  onSubmit,
  saving,
}: {
  onClose: () => void;
  onSubmit: (data: { name: string; website: string; description: string; keywords: string }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), website: website.trim(), description: description.trim(), keywords: keywords.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg space-y-3 rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Add Business</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted">
            ✕
          </button>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Business name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Acme Coffee Co."
            className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Website</label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
            type="url"
            className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What does your business do?"
            className="mt-1 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Keywords (comma-separated)</label>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="coffee, espresso, beans"
            className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}