"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Megaphone, Loader2, CheckCircle2, Copy, ExternalLink,
  Sparkles, ChevronDown, X, Building2, Send, Check,
} from "lucide-react";

type Site = { name: string; url: string; category: string; da: number };

type Listing = {
  siteIndex: number;
  siteName: string;
  siteUrl: string;
  siteCategory: string;
  title: string;
  body: string;
};

type Business = {
  id: string;
  name: string;
  website: string;
  keywords: string;
};

export default function ClassifiedsPage() {
  const [countries, setCountries] = useState<Record<string, Site[]>>({});
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessLoading, setBusinessLoading] = useState(true);

  const [country, setCountry] = useState<string>("");
  const [searchCountry, setSearchCountry] = useState("");
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [keywords, setKeywords] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState("");

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedSites, setSavedSites] = useState<Set<string>>(new Set());
  const [savingSite, setSavingSite] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/classifieds/countries")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.countries) {
          setCountries(d.countries);
          const first = Object.keys(d.countries).sort()[0];
          if (first) setCountry(first);
        }
      })
      .catch(() => {});

    fetch("/api/businesses")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.activeBusinessId && d.businesses) {
          const b = d.businesses.find((x: any) => x.id === d.activeBusinessId);
          if (b) {
            setBusiness(b);
            setKeywords((prev) => prev || b.keywords.split(",")[0].trim());
          }
        }
      })
      .catch(() => {})
      .finally(() => setBusinessLoading(false));
  }, []);

  const sitesForCountry = useMemo(
    () => (country ? countries[country] ?? [] : []),
    [country, countries]
  );

  function toggleSite(name: string) {
    setSelectedSites((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else if (next.size < 10) next.add(name);
      return next;
    });
  }

  function selectAll() {
    setSelectedSites(new Set(sitesForCountry.slice(0, 10).map((s) => s.name)));
  }

  function clearAll() {
    setSelectedSites(new Set());
  }

  async function generate() {
    setError("");
    setListings([]);
    setSavedSites(new Set());
    if (!keywords.trim()) return setError("Enter target keywords.");
    if (selectedSites.size === 0) return setError("Select at least one site.");
    if (!business) return setError("No active business. Set one up first.");

    const sites = sitesForCountry.filter((s) => selectedSites.has(s.name));

    setGenerating(true);
    try {
      const res = await fetch("/api/classifieds/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, sites }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setListings(data.listings ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  function copyText(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  async function markSubmitted(listing: Listing) {
    setSavingSite(listing.siteName);
    try {
      const res = await fetch("/api/classifieds/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: listing.siteName,
          siteUrl: listing.siteUrl,
          siteCategory: listing.siteCategory,
          country,
          title: listing.title,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSavedSites((prev) => new Set(prev).add(listing.siteName));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingSite(null);
    }
  }

  const filteredCountries = useMemo(() => {
    const all = Object.keys(countries).sort();
    if (!searchCountry.trim()) return all;
    const q = searchCountry.toLowerCase();
    return all.filter((c) => c.toLowerCase().includes(q));
  }, [countries, searchCountry]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Classifieds</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Generate unique AI ads for 65 countries × 10 sites. Pick, generate, copy, submit.
        </p>
      </div>

      {!businessLoading && (
        <>
          {business ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">
                  Targeting <strong>{business.name}</strong>
                </span>
              </div>
              <Link
                href="/businesses"
                className="shrink-0 text-xs font-medium text-primary hover:underline"
              >
                Change
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="text-sm">
                <strong>No active business.</strong> Set one up first.
              </div>
              <Link
                href="/businesses"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <Building2 className="h-3 w-3" /> Set up business
              </Link>
            </div>
          )}
        </>
      )}

      {/* Config */}
      <div className="rounded-xl border border-border/60 bg-card">
        <div className="border-b border-border/60 p-4 sm:p-5">
          <div className="font-semibold">1. Choose target sites</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Pick a country, select up to 10 sites, then generate.
          </div>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Country</label>
            <button
              onClick={() => setShowCountryPicker(true)}
              className="flex h-11 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-sm hover:bg-muted sm:max-w-xs"
            >
              <span>{country || "Select country"}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">
                Sites in {country || "…"} ({selectedSites.size}/10)
              </label>
              <div className="flex gap-2 text-xs">
                <button onClick={selectAll} className="text-primary hover:underline">
                  Select all
                </button>
                <button onClick={clearAll} className="text-muted-foreground hover:underline">
                  Clear
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {sitesForCountry.map((site) => {
                const checked = selectedSites.has(site.name);
                return (
                  <label
                    key={site.name}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                      checked
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/60 hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSite(site.name)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{site.name}</span>
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          DA {site.da}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs capitalize text-muted-foreground">
                        {site.category}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              2. Target keywords for these ads
            </label>
            <input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="email marketing, automation, small business growth"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={generate}
              disabled={
                generating || !business || !keywords.trim() || selectedSites.size === 0
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generating
                ? `Generating ${selectedSites.size} ads…`
                : `Generate ${
                    selectedSites.size || ""
                  } listing${selectedSites.size === 1 ? "" : "s"}`}
            </button>
            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Listings */}
      {listings.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-lg font-semibold">
                {listings.length} unique listing{listings.length === 1 ? "" : "s"} ready
              </div>
              <div className="text-xs text-muted-foreground">
                Copy each one → open the site → paste → mark submitted.
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {savedSites.size}/{listings.length} submitted
            </div>
          </div>

          {listings.map((listing, idx) => {
            const saved = savedSites.has(listing.siteName);
            const titleKey = `title-${idx}`;
            const bodyKey = `body-${idx}`;
            return (
              <div
                key={`${listing.siteName}-${idx}`}
                className={`rounded-xl border bg-card transition ${
                  saved
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-border/60"
                }`}
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 p-3 sm:p-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{listing.siteName}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                      {listing.siteCategory}
                    </span>
                    {saved && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="h-2.5 w-2.5" /> Submitted
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <a
                      href={listing.siteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="hidden sm:inline">Open</span>
                    </a>
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-3 p-3 sm:p-4">
                  {/* Title */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Title
                      </span>
                      <button
                        onClick={() => copyText(titleKey, listing.title)}
                        className="inline-flex items-center gap-1 rounded text-xs text-primary hover:underline"
                      >
                        {copiedKey === titleKey ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background p-2.5 text-sm">
                      {listing.title}
                    </div>
                  </div>

                  {/* Body */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Body
                      </span>
                      <button
                        onClick={() => copyText(bodyKey, listing.body)}
                        className="inline-flex items-center gap-1 rounded text-xs text-primary hover:underline"
                      >
                        {copiedKey === bodyKey ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <div className="whitespace-pre-wrap rounded-lg border border-border/60 bg-background p-2.5 text-sm leading-relaxed">
                      {listing.body}
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        copyText(`${titleKey}-both`, `${listing.title}\n\n${listing.body}`);
                        setTimeout(
                          () => copyText(`${bodyKey}-both`, `${listing.title}\n\n${listing.body}`),
                          100
                        );
                      }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
                    >
                      <Copy className="h-3 w-3" /> Copy both
                    </button>
                    <button
                      onClick={() => markSubmitted(listing)}
                      disabled={savingSite === listing.siteName || saved}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium ${
                        saved
                          ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      }`}
                    >
                      {savingSite === listing.siteName ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : saved ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      {saved ? "Submitted" : savingSite === listing.siteName ? "Saving…" : "Mark submitted"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {savedSites.size === listings.length && listings.length > 0 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
              <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                All {listings.length} ads submitted — tracking them in your dashboard.
              </div>
              <Link
                href="/dashboard"
                className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
              >
                View in dashboard →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Country picker modal */}
      {showCountryPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCountryPicker(false)}
          />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border/60 p-4">
              <div className="font-semibold">Choose country</div>
              <button
                onClick={() => setShowCountryPicker(false)}
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border-b border-border/60 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchCountry}
                  onChange={(e) => setSearchCountry(e.target.value)}
                  placeholder="Search countries…"
                  className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredCountries.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No countries match “{searchCountry}”
                </div>
              ) : (
                filteredCountries.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setCountry(c);
                      setSelectedSites(new Set());
                      setShowCountryPicker(false);
                      setSearchCountry("");
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted ${
                      country === c ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <span>{c}</span>
                    <span className="text-xs text-muted-foreground">
                      {countries[c]?.length ?? 0} sites
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}