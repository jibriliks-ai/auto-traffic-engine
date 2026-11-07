// src/lib/qa-sources.ts
//
// Q&A source fetchers for the Q&A Finder module.
// - Reddit:   ALWAYS (global + country-mapped subreddits)
// - HackerNews, StackExchange, Dev.to: ALWAYS
// - Lemmy:    ONLY when country is Europe or America
// - All sources run in parallel with an 8s timeout each.
// - AI ranking step filters to genuine questions + relevance.

import { aiChat } from "@/lib/ai";

export type QA = {
  id: string;
  platform: string;
  title: string;
  url: string;
  score: number;
  country: string;
  snippet?: string;
  createdUtc?: number;
};

export type FetchResult = {
  items: QA[];
  failedSources: string[];
  succeededSources: string[];
};

const FETCH_TIMEOUT_MS = 8_000;
const USER_AGENT =
  "AutoTrafficEngine/1.0 (Q&A Finder; +https://growthbot-aprv.onrender.com)";

async function fetchJson(
  url: string,
  extraHeaders: Record<string, string> = {}
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...extraHeaders,
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Country → subreddit map ----------
// Ensures Reddit always returns relevant results for the chosen country.
const COUNTRY_SUBS: Record<string, string[]> = {
  usa: [
    "Entrepreneur",
    "smallbusiness",
    "startups",
    "SaaS",
    "marketing",
    "SEO",
    "juststart",
  ],
  uk: ["ukbusiness", "smallbusinessuk", "UKPersonalFinance", "unitedkingdom"],
  canada: [
    "PersonalFinanceCanada",
    "canadabusiness",
    "CanadianInvestor",
    "CanadaSmallBusiness",
  ],
  india: [
    "indianstartups",
    "IndiaBusiness",
    "IndiaInvestments",
    "developersIndia",
    "india",
  ],
  nigeria: ["Nigeria", "NigeriaBusiness", "AfricaBusiness"],
  "south africa": ["southafrica", "PersonalFinanceZA", "SouthAfricaBusiness"],
  germany: ["deutschestartups", "Finanzen", "gruenden"],
  australia: ["AusFinance", "AusBusiness", "ausentrepreneur", "Australia"],
  // Europe & America still hit Reddit too, per the user's rule.
  europe: ["europe", "europeanunion", "Entrepreneur"],
  america: ["Entrepreneur", "smallbusiness", "startups"],
  all: ["Entrepreneur", "smallbusiness", "startups", "SaaS", "marketing", "SEO"],
};

function subsForCountry(country: string): string[] {
  return COUNTRY_SUBS[country.trim().toLowerCase()] ?? COUNTRY_SUBS.all;
}

// ---------- Reddit (ALWAYS) ----------
async function fetchReddit(keyword: string, country: string): Promise<QA[]> {
  const q = encodeURIComponent(keyword);
  const subs = subsForCountry(country).slice(0, 4);

  const urls = [
    // Global Reddit search — always first
    `https://www.reddit.com/search.json?q=${q}&sort=relevance&t=year&limit=15`,
    // Subreddit-scoped searches in parallel
    ...subs.map(
      (s) =>
        `https://www.reddit.com/r/${s}/search.json?q=${q}&restrict_sr=1&sort=relevance&t=year&limit=10`
    ),
  ];

  const settled = await Promise.allSettled(urls.map((u) => fetchJson(u)));
  const out: QA[] = [];

  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    const children = r.value?.data?.children ?? [];
    for (const child of children) {
      const p = child?.data;
      if (!p || !p.title || p.over_18 || p.stickied) continue;
      out.push({
        id: `reddit-${p.id}`,
        platform: "Reddit",
        title: p.title,
        url: `https://reddit.com${p.permalink}`,
        score: p.score ?? 0,
        country,
        snippet: p.selftext ? String(p.selftext).slice(0, 240) : undefined,
        createdUtc: p.created_utc,
      });
    }
  }
  return out;
}

// ---------- Lemmy (Europe / America only) ----------
const LEMMY_INSTANCES = ["lemmy.world", "lemm.ee", "sh.itjust.works"];

async function fetchLemmy(keyword: string, country: string): Promise<QA[]> {
  const q = encodeURIComponent(keyword);
  const settled = await Promise.allSettled(
    LEMMY_INSTANCES.map((host) =>
      fetchJson(
        `https://${host}/api/v3/search?q=${q}&type_=Posts&sort=TopMonth&limit=15`
      )
    )
  );

  const out: QA[] = [];
  settled.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    const items = r.value?.posts ?? [];
    for (const item of items) {
      const p = item?.post;
      if (!p || !p.name) continue;
      const score =
        (item.counts?.score ?? 0) + (item.counts?.comments ?? 0);
      out.push({
        id: `lemmy-${p.id}`,
        platform: "Lemmy",
        title: p.name,
        url:
          p.url ||
          `https://${LEMMY_INSTANCES[i]}/post/${p.id}`,
        score,
        country,
        snippet: p.body ? String(p.body).slice(0, 240) : undefined,
        createdUtc: p.published
          ? Math.floor(new Date(p.published).getTime() / 1000)
          : undefined,
      });
    }
  });
  return out;
}

// ---------- Hacker News (ALWAYS) ----------
async function fetchHackerNews(keyword: string, country: string): Promise<QA[]> {
  const q = encodeURIComponent(keyword);
  const data = await fetchJson(
    `https://hn.algolia.com/api/v1/search?query=${q}&tags=story&hitsPerPage=10`
  );
  const hits: any[] = data?.hits ?? [];
  return hits
    .filter((h) => h?.title && h?.objectID)
    .map<QA>((h) => ({
      id: `hn-${h.objectID}`,
      platform: "HackerNews",
      title: h.title,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      score: h.points ?? 0,
      country,
      snippet: h.story_text
        ? String(h.story_text).replace(/<[^>]+>/g, "").slice(0, 240)
        : undefined,
      createdUtc: h.created_at_i,
    }));
}

// ---------- StackExchange (ALWAYS) ----------
async function fetchStackExchange(
  keyword: string,
  country: string
): Promise<QA[]> {
  const q = encodeURIComponent(keyword);
  const sites = ["stackoverflow", "superuser", "webapps", "webmasters"];
  const settled = await Promise.allSettled(
    sites.map((site) =>
      fetchJson(
        `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${q}&site=${site}&pagesize=5`
      )
    )
  );
  const out: QA[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    const items = r.value?.items ?? [];
    for (const item of items) {
      if (!item?.title || !item?.link) continue;
      out.push({
        id: `se-${item.question_id}`,
        platform: "StackExchange",
        title: item.title,
        url: item.link,
        score: item.score ?? 0,
        country,
        createdUtc: item.creation_date,
      });
    }
  }
  return out;
}

// ---------- Dev.to (ALWAYS) ----------
async function fetchDevTo(keyword: string, country: string): Promise<QA[]> {
  const tag = encodeURIComponent(
    keyword.toLowerCase().replace(/\s+/g, "").slice(0, 20)
  );
  try {
    const data = await fetchJson(
      `https://dev.to/api/articles?tag=${tag}&per_page=5`
    );
    if (!Array.isArray(data)) return [];
    return data
      .filter((a: any) => a?.title && a?.url)
      .map<QA>((a: any) => ({
        id: `devto-${a.id}`,
        platform: "Dev.to",
        title: a.title,
        url: a.url,
        score:
          (a.positive_reactions_count ?? 0) + (a.comments_count ?? 0),
        country,
        snippet: a.description,
        createdUtc: a.published_at
          ? Math.floor(new Date(a.published_at).getTime() / 1000)
          : undefined,
      }));
  } catch {
    return [];
  }
}

// ---------- Dedupe by URL + title Jaccard similarity ----------
function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleSim(a: string, b: string): number {
  const A = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const B = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function dedupe(items: QA[]): QA[] {
  const seenUrls = new Set<string>();
  const out: QA[] = [];
  for (const item of items) {
    const urlKey = item.url.split("?")[0].toLowerCase();
    if (seenUrls.has(urlKey)) continue;
    if (out.some((o) => titleSim(o.title, item.title) > 0.85)) continue;
    seenUrls.add(urlKey);
    out.push(item);
  }
  return out;
}

// ---------- AI ranking (the "correct AI mode" step) ----------
function extractJson(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
  }
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) {
    try {
      return JSON.parse(brace[0]);
    } catch {}
  }
  return null;
}

async function rankWithAI(
  items: QA[],
  keyword: string,
  country: string
): Promise<QA[]> {
  // Only run AI when we actually have a meaningful pool to rank
  if (items.length <= 10) return items;

  const sample = items.slice(0, 40).map((i) => ({
    id: i.id,
    title: i.title,
    snippet: i.snippet ?? "",
  }));

  const systemPrompt =
    "You are a search-quality classifier for a Q&A finder. " +
    "You will receive a JSON list of items and a topic. " +
    "Return ONLY valid JSON of the form: " +
    '{"ids": ["<id1>", "<id2>", ...]} — no prose, no markdown. ' +
    "Include only items that are (a) genuine questions or problem-statements " +
    "someone is asking for help with, AND (b) clearly about the topic. " +
    "Order by relevance to the topic, highest first. " +
    "Aim for 10-20 ids. If fewer than 3 items qualify, return whatever qualifies.";

  const userPrompt =
    `Topic: ${keyword}\n` +
    `Country context: ${country}\n\n` +
    `Items:\n${JSON.stringify(sample)}`;

  let ranked: QA[] | null = null;
  try {
    const raw = await aiChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 800, temperature: 0.1 }
    );
    const parsed = extractJson(raw);
    const ids: string[] = Array.isArray(parsed?.ids)
      ? parsed.ids.filter((x: any) => typeof x === "string")
      : [];
    if (ids.length === 0) return items;

    const byId = new Map(items.map((i) => [i.id, i]));
    const picked: QA[] = [];
    for (const id of ids) {
      const it = byId.get(id);
      if (it) picked.push(it);
    }
    if (picked.length < 3) return items;
    ranked = picked;
  } catch {
    ranked = null;
  }

  // If AI ranking succeeded, return the ranked subset.
  // If not, return the original list unchanged.
  return ranked ?? items;
}

// ---------- Public orchestrator ----------
export async function fetchQAPool(
  keyword: string,
  country: string
): Promise<FetchResult> {
  const isEuropeOrAmerica = ["europe", "america"].includes(
    country.trim().toLowerCase()
  );

  const jobs: { name: string; run: () => Promise<QA[]> }[] = [
    { name: "Reddit", run: () => fetchReddit(keyword, country) },
    { name: "HackerNews", run: () => fetchHackerNews(keyword, country) },
    { name: "StackExchange", run: () => fetchStackExchange(keyword, country) },
    { name: "Dev.to", run: () => fetchDevTo(keyword, country) },
  ];
  if (isEuropeOrAmerica) {
    jobs.push({ name: "Lemmy", run: () => fetchLemmy(keyword, country) });
  }

  const settled = await Promise.allSettled(jobs.map((j) => j.run()));

  const all: QA[] = [];
  const failedSources: string[] = [];
  const succeededSources: string[] = [];

  settled.forEach((r, i) => {
    const name = jobs[i].name;
    if (r.status === "fulfilled" && r.value.length > 0) {
      succeededSources.push(name);
      all.push(...r.value);
    } else {
      failedSources.push(name);
    }
  });

  let unique = dedupe(all);

  // Sort: score desc, then newest
  unique.sort((a, b) => {
    const s = (b.score ?? 0) - (a.score ?? 0);
    if (s !== 0) return s;
    return (b.createdUtc ?? 0) - (a.createdUtc ?? 0);
  });

  // Final guarantee: if every source failed, fall back to a bare
  // global Reddit search so the user never sees an empty page.
  if (unique.length === 0) {
    try {
      const data = await fetchJson(
        `https://www.reddit.com/search.json?q=${encodeURIComponent(
          keyword
        )}&sort=relevance&limit=10`
      );
      const children: any[] = data?.data?.children ?? [];
unique = children
  .filter((c: any) => c?.data?.title && !c?.data?.over_18)
  .map((c: any) => ({
    id: `reddit-${c.data.id}`,
    platform: "Reddit",
    title: c.data.title,
    url: `https://reddit.com${c.data.permalink}`,
    score: c.data.score ?? 0,
    country,
    snippet: c.data.selftext
      ? String(c.data.selftext).slice(0, 240)
      : undefined,
    createdUtc: c.data.created_utc,
  })) as QA[];
      if (unique.length > 0) succeededSources.push("Reddit (fallback)");
    } catch {
      /* ignore */
    }
  }

  // AI rank/filter step. Safe: if it fails or returns garbage, we
  // fall back to the deterministic list. Uses the auto-switching
  // aiChat so it works with OpenAI or DeepSeek without config change.
  const ranked = await rankWithAI(unique, keyword, country);

  // Cap at 25 final results
  return {
    items: ranked.slice(0, 25),
    failedSources,
    succeededSources,
  };
}