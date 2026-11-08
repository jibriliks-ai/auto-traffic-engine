"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Plug, ShieldCheck, Trash2, X } from "lucide-react";
import { PLATFORM_CONFIG, PlatformConfig } from "@/lib/money-engine/platforms";

type AccountState = {
  platform: string;
  isConnected: boolean;
  affiliateUsername: string | null;
  affiliateId: string | null;
  accountId: string | null;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasAccessToken: boolean;
  lastVerifiedAt: string | null;
};

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Record<string, AccountState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/money-engine/accounts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      const map: Record<string, AccountState> = {};
      for (const a of data.accounts as AccountState[]) map[a.platform] = a;
      setAccounts(map);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start gap-3">
        <Link
          href="/money-engine"
          className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Connect Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keys are AES-256-GCM encrypted in the database and only decrypted server-side during sync.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" /> Loading…
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {PLATFORM_CONFIG.map((p) => (
            <PlatformCard
              key={p.id}
              config={p}
              state={accounts[p.id]}
              onSaved={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlatformCard({
  config,
  state,
  onSaved,
}: {
  config: PlatformConfig;
  state?: AccountState;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const connected = state?.isConnected ?? false;

  function setField(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/money-engine/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: config.id, ...values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setValues({});
      onSaved();
      setMsg("Saved. Live API test runs on Phase 2.");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!confirm(`Disconnect ${config.name}?`)) return;
    setSaving(true);
    try {
      await fetch(`/api/money-engine/accounts?platform=${config.id}`, { method: "DELETE" });
      onSaved();
      setMsg("Disconnected.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Plug className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">{config.name}</div>
              <div className="text-xs text-muted-foreground capitalize">{config.category}</div>
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
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{config.hint}</p>

      <div className="mt-4 space-y-3">
        {config.fields.map((f) => {
          const hasSaved =
            (f.key === "apiKey" && state?.hasApiKey) ||
            (f.key === "apiSecret" && state?.hasApiSecret) ||
            (f.key === "accessToken" && state?.hasAccessToken) ||
            (f.key === "affiliateUsername" && state?.affiliateUsername) ||
            (f.key === "affiliateId" && state?.affiliateId) ||
            (f.key === "accountId" && state?.accountId);

          return (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              <input
                type={f.secret ? "password" : "text"}
                placeholder={hasSaved ? "•••••• (saved — leave blank to keep)" : f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(e) => setField(f.key, e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving || Object.values(values).every((v) => !v.trim())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
          Save
        </button>
        {connected && (
          <button
            onClick={disconnect}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-500/5 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" /> Disconnect
          </button>
        )}
      </div>

      {msg && <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{msg}</div>}
      {err && <div className="mt-2 text-xs text-rose-600 dark:text-rose-400">{err}</div>}
    </div>
  );
}