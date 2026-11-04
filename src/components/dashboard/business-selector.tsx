"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";

type Business = { id: string; name: string; website: string };

export function BusinessSelector() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const r = await fetch("/api/businesses");
      if (r.ok) {
        const d = await r.json();
        setBusinesses(d.businesses ?? []);
        setActiveId(d.activeBusinessId ?? null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function select(id: string) {
    setOpen(false);
    if (id === activeId) return;
    setActiveId(id);
    await fetch("/api/businesses/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  const active = businesses.find((b) => b.id === activeId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[180px] items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">
          {loading ? "Loading…" : active?.name ?? "No business"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-card p-1 shadow-lg">
            {businesses.length === 0 && (
              <div className="px-3 py-3 text-xs text-muted-foreground">
                No businesses yet — create one to get started.
              </div>
            )}
            <div className="max-h-72 overflow-auto">
              {businesses.map((b) => (
                <button
                  key={b.id}
                  onClick={() => select(b.id)}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{b.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{b.website}</div>
                  </div>
                  {b.id === activeId && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              ))}
            </div>
            <div className="my-1 border-t border-border/60" />
            <Link
              href="/businesses"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded px-3 py-2 text-sm text-primary hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" /> Manage businesses
            </Link>
          </div>
        </>
      )}
    </div>
  );
}