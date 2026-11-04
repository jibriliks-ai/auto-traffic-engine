"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2, Plus, Pencil, Trash2, Check, Loader2, Crown, X, Save, Globe,
} from "lucide-react";

type Business = {
  id: string;
  name: string;
  website: string;
  keywords: string;
  description: string;
  createdAt: string;
};

type Limits = { plan: string; count: number; limit: number; allowed: boolean };

export default function BusinessesPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", website: "", keywords: "", description: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/businesses");
      const d = await r.json();
      setBusinesses(d.businesses ?? []);
      setActiveId(d.activeBusinessId ?? null);
      setLimits(d.limits ?? null);
    } catch {
      setError("Failed to load businesses.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditingId(null);
    setForm({ name: "", website: "", keywords: "", description: "" });
    setShowForm(true);
    setError("");
  }

  function openEdit(b: Business) {
    setEditingId(b.id);
    setForm({
      name: b.name,
      website: b.website,
      keywords: b.keywords,
      description: b.description,
    });
    setShowForm(true);
    setError("");
  }

  async function save() {
    setError("");
    setSaving(true);
    try {
      const url = editingId ? `/api/businesses/${editingId}` : "/api/businesses";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setShowForm(false);
      setEditingId(null);
      setForm({ name: "", website: "", keywords: "", description: "" });
      await load();
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function setActive(id: string) {
    if (id === activeId) return;
    await fetch("/api/businesses/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setActiveId(id);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this business? Submissions linked to it will be orphaned.")) return;
    await fetch(`/api/businesses/${id}`, { method: "DELETE" });
    await load();
    router.refresh();
  }

  const canAdd = limits?.allowed ?? false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Businesses</h1>
          <p className="mt-1 text-muted-foreground">
            Every module targets the currently active business. Manage them here.
          </p>
        </div>
        <button
          onClick={openNew}
          disabled={!canAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add business
        </button>
      </div>

      {limits && (
        <div
          className={`rounded-xl border p-4 ${
            limits.plan === "premium"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-primary/30 bg-primary/5"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              {limits.plan === "premium" ? (
                <>
                  <Crown className="h-4 w-4 text-emerald-500" />
                  <span><strong>Premium plan</strong> — unlimited businesses</span>
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>
                    <strong>{limits.count} / {limits.limit}</strong> business
                    {limits.limit === 1 ? "" : "es"} used on Free plan
                  </span>
                </>
              )}
            </div>
            {limits.plan === "free" && !limits.allowed && (
              <Link
                href="/billing"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <Crown className="h-3 w-3" /> Upgrade to add more
              </Link>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-semibold">{editingId ? "Edit business" : "New business"}</div>
            <button
              onClick={() => { setShowForm(false); setError(""); }}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Business name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Acme Marketing Co."
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Website URL</label>
              <input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://acme.com"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Target keywords</label>
              <input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="email marketing, automation, small business growth"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
              />
              <div className="mt-1 text-xs text-muted-foreground">Comma-separated</div>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does your business do? Who is it for? What makes it different?"
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none"
              />
              <div className="mt-1 text-xs text-muted-foreground">Min 20 chars — used by AI to tailor content</div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : editingId ? "Save changes" : "Create business"}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(""); }}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : businesses.length === 0 && !showForm ? (
        <div className="rounded-xl border border-border/60 bg-card p-12 text-center">
          <Building2 className="mx-auto mb-4 h-10 w-10 text-muted-foreground/40" />
          <div className="text-lg font-medium">No businesses yet</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first business to unlock the full power of every module.
          </p>
          <button
            onClick={openNew}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add your first business
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {businesses.map((b) => {
            const isActive = b.id === activeId;
            return (
              <div
                key={b.id}
                className={`rounded-xl border bg-card p-5 ${
                  isActive ? "border-primary/60 ring-1 ring-primary/20" : "border-border/60"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-semibold">{b.name}</div>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                          <Check className="h-3 w-3" /> Active
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Globe className="h-3.5 w-3.5" />
                      <span className="truncate">{b.website}</span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <strong>Keywords:</strong> {b.keywords}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {b.description}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!isActive && (
                      <button
                        onClick={() => setActive(b.id)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        Set active
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(b)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => remove(b.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}