"use client";

import { useEffect, useState } from "react";
import {
  Send, Loader2, Check, X, AlertTriangle, Link2, Trash2,
  ExternalLink, MessageCircle, Twitter, Facebook, Music,
  Settings as SettingsIcon,
} from "lucide-react";

type Platform = "telegram" | "bluesky" | "mastodon" | "facebook" | "x";

type Connection = {
  platform: Platform;
  accountName: string | null;
  isConnected: boolean;
  lastVerifiedAt: string | null;
};

type PlatformConfig = {
  id: Platform;
  name: string;
  icon: React.ReactNode;
  color: string;
  hint: string;
  fields: { key: string; label: string; placeholder: string; secret: boolean }[];
  free: boolean;
};

const PLATFORMS: PlatformConfig[] = [
  {
    id: "telegram",
    name: "Telegram",
    icon: <Send className="h-5 w-5" />,
    color: "#0088cc",
    hint: "Message @BotFather → /newbot → copy token. Then message @userinfobot for your chat_id.",
    free: true,
    fields: [
      { key: "botToken", label: "Bot Token", placeholder: "1234567890:ABCdef...", secret: true },
      { key: "chatId", label: "Chat ID", placeholder: "123456789", secret: false },
    ],
  },
  {
    id: "bluesky",
    name: "Bluesky",
    icon: <MessageCircle className="h-5 w-5" />,
    color: "#0560ff",
    hint: "bsky.app → Settings → Privacy → App Passwords → Create App Password.",
    free: true,
    fields: [
      { key: "handle", label: "Handle", placeholder: "you.bsky.social", secret: false },
      { key: "appPassword", label: "App Password", placeholder: "xxxx-xxxx-xxxx-xxxx", secret: true },
    ],
  },
  {
    id: "mastodon",
    name: "Mastodon",
    icon: <MessageCircle className="h-5 w-5" />,
    color: "#6364ff",
    hint: "Your instance → Preferences → Development → New Application → copy access token.",
    free: true,
    fields: [
      { key: "instanceUrl", label: "Instance URL", placeholder: "https://mastodon.social", secret: false },
      { key: "accessToken", label: "Access Token", placeholder: "your token", secret: true },
    ],
  },
  {
    id: "facebook",
    name: "Facebook Page",
    icon: <Facebook className="h-5 w-5" />,
    color: "#1877f2",
    hint: "Requires Meta app approval for pages_manage_posts permission (1-2 day review).",
    free: false,
    fields: [
      { key: "pageId", label: "Page ID", placeholder: "1234567890", secret: false },
      { key: "pageAccessToken", label: "Page Access Token", placeholder: "EAAG...", secret: true },
    ],
  },
  {
    id: "x",
    name: "X (Twitter)",
    icon: <Twitter className="h-5 w-5" />,
    color: "#000000",
    hint: "Requires $100/mo Basic API tier for media uploads. Free tier is text-only.",
    free: false,
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "xxxx", secret: true },
      { key: "apiSecret", label: "API Secret", placeholder: "xxxx", secret: true },
      { key: "accessToken", label: "Access Token", placeholder: "xxxx", secret: true },
      { key: "accessSecret", label: "Access Secret", placeholder: "xxxx", secret: true },
    ],
  },
];

type PostHistory = {
  id: string;
  platform: string;
  status: string;
  caption: string;
  platformUrl: string | null;
  error: string | null;
  createdAt: string;
};

export default function SocialPage() {
  const [connections, setConnections] = useState<Record<string, Connection>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Platform | null>(null);
  const [history, setHistory] = useState<PostHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  async function loadConnections() {
    setLoading(true);
    try {
      const res = await fetch("/api/social/connections");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      const map: Record<string, Connection> = {};
      for (const c of data.connections ?? []) map[c.platform] = c;
      setConnections(map);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/social/history?limit=20");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.posts ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadConnections();
    loadHistory();
  }, []);

  async function disconnect(platform: Platform) {
    if (!confirm(`Disconnect ${platform}?`)) return;
    try {
      const res = await fetch(`/api/social/connections?platform=${platform}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      await loadConnections();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Social Poster</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect platforms once. Post offers + branded images to all of them in one click.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Connect cards */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Connect platforms
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PLATFORMS.map((p) => {
            const conn = connections[p.id];
            const isConnected = conn?.isConnected ?? false;
            return (
              <div key={p.id} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="grid h-10 w-10 place-items-center rounded-lg text-white"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        {p.name}
                        {p.free && (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                            Free
                          </span>
                        )}
                      </div>
                      {conn?.accountName && (
                        <div className="text-xs text-muted-foreground">{conn.accountName}</div>
                      )}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      isConnected
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isConnected ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {isConnected ? "Connected" : "Not connected"}
                  </span>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">{p.hint}</p>

                <div className="mt-3 flex gap-2">
                  {isConnected ? (
                    <button
                      onClick={() => disconnect(p.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-rose-600 hover:bg-rose-500/5"
                    >
                      <Trash2 className="h-3 w-3" /> Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditing(p.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90"
                    >
                      <Link2 className="h-3 w-3" /> Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Post history */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent posts
        </h2>
        <div className="rounded-xl border border-border/60 bg-card">
          {historyLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No posts yet. Go to{" "}
              <a href="/money-engine" className="text-primary underline">
                Money Engine
              </a>{" "}
              and click <strong>Post to Social</strong> on a generated draft.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {history.map((h) => (
                <div key={h.id} className="flex items-start gap-3 p-3">
                  <div
                    className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                      h.status === "posted"
                        ? "bg-emerald-500"
                        : h.status === "failed"
                        ? "bg-rose-500"
                        : "bg-muted"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold capitalize">{h.platform}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {new Date(h.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm">{h.caption}</div>
                    {h.status === "failed" && h.error && (
                      <div className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                        {h.error.slice(0, 200)}
                      </div>
                    )}
                  </div>
                  {h.platformUrl && (
                    <a
                      href={h.platformUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Connect modal */}
      {editing && (
        <ConnectModal
          platform={PLATFORMS.find((p) => p.id === editing)!}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadConnections();
          }}
        />
      )}
    </div>
  );
}

function ConnectModal({
  platform,
  onClose,
  onSaved,
}: {
  platform: PlatformConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/social/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platform.id,
          accountName: values[platform.fields[0].key] || platform.name,
          credentials: values,
        }),
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

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="grid h-8 w-8 place-items-center rounded-lg text-white"
              style={{ backgroundColor: platform.color }}
            >
              {platform.icon}
            </div>
            <h3 className="text-base font-semibold">Connect {platform.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">{platform.hint}</p>

        <div className="space-y-3">
          {platform.fields.map((f) => (
            <div key={f.key}>
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              <input
                type={f.secret ? "password" : "text"}
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          ))}
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
            disabled={saving || platform.fields.some((f) => !values[f.key]?.trim())}
            className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}