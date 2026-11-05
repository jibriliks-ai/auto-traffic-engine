"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Loader2, CheckCircle2, Copy, ExternalLink,
  Sparkles, ChevronDown, X, Building2, Send, Check, Search, Globe,
} from "lucide-react";

type Site = { name: string; url: string; category: string; da: number };

type Listing = {
  siteIndex: number;
  siteName: string;
  siteUrl: string;
  siteCategory: string;
  title: string;
  body: string;
  // translation bookkeeping
  originalTitle?: string;
  originalBody?: string;
  translatedTo?: string;
};

type Business = {
  id: string;
  name: string;
  website: string;
  keywords: string;
};

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "ar", label: "Arabic" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "hi", label: "Hindi" },
  { code: "yo", label: "Yoruba" },
  { code: "ig", label: "Igbo" },
  { code: "ha", label: "Hausa" },
  { code: "sw", label: "Swahili" },
  { code: "ru", label: "Russian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "tr", label: "Turkish" },
  { code: "nl", label: "Dutch" },
];

function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export default function ClassifiedsPage() {
  const [countries, setCountries] = useState<Record<string, Site[]>>({});
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessLoading, setBusinessLoading] = useState(true);

  const [country, setCountry] = useState<string>("");
  const [searchCountry, setSearchCountry] = useState("");
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [keywords, setKeywords] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [translateTo, setTranslateTo] = useState("");

  const [generating, setGenerating] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState("");

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedSites, setSavedSites] = useState<Set<string>>(new Set());
  const [savingSite, setSavingSite] = useState<string | null>(null);
  const [translatingIdx, setTranslatingIdx] = useState<number | null>(null);

  // Load countries + active business
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

      // Store originals so translate can always start from the AI's output
      const enriched: Listing[] = (data.listings ?? []).map((l: Listing) => ({
        ...l,
        originalTitle: l.title,
        originalBody: l.body,
      }));
      setListings(enriched);
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

  async function translateListing(index: number) {
    if (!translateTo) {
      setError("Choose a target language first.");
      return;
    }
    const listing = listings[index];
    if (!listing) return;

    // Always translate from the AI's original output
    const sourceTitle = listing.originalTitle ?? listing.title;
    const sourceBody = listing.originalBody ?? listing.body;

    setTranslatingIdx(index);
    setError("");
    try {
      const [titleRes, bodyRes] = await Promise.all([
        fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sourceTitle, to: translateTo }),
        }),
        fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sourceBody, to: translateTo }),
        }),
      ]);

      const [titleData, bodyData] = await Promise.all([
        titleRes.json(),
        bodyRes.json(),
      ]);

      if (!titleRes.ok || !bodyRes.ok) {
        throw new Error(titleData.error ?? bodyData.error ?? "Translation failed");
      }

      setListings((prev) =>
        prev.map((l, i) =>
          i === index
            ? {
                ...l,
                title: titleData.translated,
                body: bodyData.translated,
                translatedTo: translateTo,
              }
            : l
        )
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTranslatingIdx(null);
    }
  }

  function resetTranslation(index: number) {
    setListings((prev) =>
      prev.map((l, i) =>
        i === index
          ? {
              ...l,
              title: l.originalTitle ?? l.title,
              body: l.originalBody ?? l.body,
              translatedTo: undefined,
            }
          : l
      )
    );
  }

  const filteredCountries = useMemo(() => {
    const all = Object.keys(countries).sort();
    if (!searchCountry.trim()) return all;
    const q = searchCountry.toLowerCase();
    return all.filter((c) => c.toLowerCase().includes(q));
  }, [countries, searchCountry]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Classifieds</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Generate unique AI ads for 65 countries × 10 sites. Pick, generate, translate, submit.
        </p>
      </div>

      {/* Business banner */}
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

      {/* Config card */}
      <div className="rounded-xl border border-border/60 bg-card">
        <div className="border-b border-border/60 p-4 sm:p-5">
          <div className="font-semibold">1. Choose target sites</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Pick a country, select up to 10 sites, then generate.
          </div>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          {/* Country selector */}
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

          {/* Sites grid */}
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

          {/* Keywords */}
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

          {/* Target language (optional) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              3. Translate generated ads to (optional)
            </label>
            <select
              value={translateTo}
              onChange={(e) => setTranslateTo(e.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none sm:max-w-xs"
            >
              <option value="">Keep AI language (no translation)</option>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-muted-foreground">
              You can also translate individual listings after generation.
            </div>
          </div>

          {/* Generate button */}
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
                Copy → open site → paste → mark submitted.
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {savedSites.size}/{listings.length} submitted
            </div>
          </div>

          {listings.map((listing, idx) => {
            const saved = savedSites.has(listing.siteName);
            const translating = translatingIdx === idx;
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
                {/* Card header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 p-3 sm:p-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{listing.siteName}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                      {listing.siteCategory}
                    </span>
                    {listing.translatedTo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                        <Globe className="h-2.5 w-2.5" /> {languageLabel(listing.translatedTo)}
                      </span>
                    )}
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

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        copyText(
                          `both-${idx}`,
                          `${listing.title}\n\n${listing.body}`
                        )
                      }
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
                    >
                      {copiedKey === `both-${idx}` ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy both
                        </>
                      )}
                    </button>

                    {!listing.translatedTo && (
                      <button
                        onClick={() => translateListing(idx)}
                        disabled={!translateTo || translating}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
                        title={
                          translateTo
                            ? `Translate to ${languageLabel(translateTo)}`
                            : "Pick a language above first"
                        }
                      >
                        {translating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Globe className="h-3 w-3" />
                        )}
                        {translating ? "Translating…" : "Translate"}
                      </button>
                    )}

                    {listing.translatedTo && (
                      <button
                        onClick={() => resetTranslation(idx)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
                      >
                        Reset to original
                      </button>
                    )}

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
                      {saved
                        ? "Submitted"
                        : savingSite === listing.siteName
                        ? "Saving…"
                        : "Mark submitted"}
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