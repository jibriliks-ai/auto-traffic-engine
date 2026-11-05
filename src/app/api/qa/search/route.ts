import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkQALimit, recordQAActivity } from "@/lib/limits";

type QA = {
  id: string;
  platform: string;
  title: string;
  url: string;
  score: number;
  country: string;
  snippet?: string;
};

const UA = "AutoTrafficEngine/1.0 (+https://auto-traffic-engine.onrender.com)";

async function safeFetch(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`[qa/search] ${url} → HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e: any) {
    console.warn(`[qa/search] ${url} → ${e.message}`);
    return null;
  }
}

async function reddit(q: string, country: string): Promise<QA[]> {
  const data = await safeFetch(
    `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=20`
  );
  const children = data?.data?.children ?? [];
  return children.map((c: any) => ({
    id: `reddit-${c.data.id}`,
    platform: "Reddit",
    title: c.data.title,
    url: `https://reddit.com${c.data.permalink}`,
    score: c.data.score ?? 0,
    country,
    snippet: c.data.selftext?.slice(0, 200),
  }));
}

async function lemmy(host: string, q: string, country: string): Promise<QA[]> {
  const data = await safeFetch(
    `${host}/api/v3/search?q=${encodeURIComponent(q)}&type_=Posts&limit=20`
  );
  const posts = data?.posts ?? [];
  return posts.map((p: any) => ({
    id: `${host}-${p.post.id}`,
    platform: host.includes("lemmy.ml") ? "Lemmy.ml" : "Lemmy",
    title: p.post.name,
    url: p.post.url ?? `${host}/post/${p.post.id}`,
    score: p.counts?.score ?? 0,
    country,
    snippet: p.post.body?.slice(0, 200),
  }));
}

async function mbin(q: string, country: string): Promise<QA[]> {
  const data = await safeFetch(
    `https://fedia.io/api/v1/search?q=${encodeURIComponent(q)}`
  );
  const items = data?.items ?? [];
  return items
    .filter((i: any) => i.type === "entry" || i.type === "post")
    .map((i: any) => ({
      id: `mbin-${i.id}`,
      platform: "Mbin",
      title: i.title ?? i.name,
      url: i.url ?? `https://fedia.io/m/${i.id}`,
      score: i.score ?? 0,
      country,
      snippet: i.body?.slice(0, 200),
    }));
}

async function piefed(q: string, country: string): Promise<QA[]> {
  const data = await safeFetch(
    `https://piefed.social/api/v1/search?q=${encodeURIComponent(q)}`
  );
  const items = data?.posts ?? data?.items ?? [];
  return items.map((i: any) => ({
    id: `piefed-${i.id ?? i.post_id}`,
    platform: "PieFed",
    title: i.title ?? i.name,
    url: i.url ?? i.ap_id ?? "https://piefed.social",
    score: i.score ?? 0,
    country,
    snippet: i.body?.slice(0, 200),
  }));
}

async function stackexchange(q: string, country: string): Promise<QA[]> {
  const data = await safeFetch(
    `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(
      q
    )}&title=${encodeURIComponent(q)}&body=${encodeURIComponent(q)}&site=stackoverflow`
  );
  return (data?.items ?? []).map((i: any) => ({
    id: `se-${i.question_id}`,
    platform: "StackExchange",
    title: i.title,
    url: i.link,
    score: i.score ?? 0,
    country,
  }));
}

async function hackerNews(q: string, country: string): Promise<QA[]> {
  const data = await safeFetch(
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=20`
  );
  return (data?.hits ?? []).map((h: any) => ({
    id: `hn-${h.objectID}`,
    platform: "Hacker News",
    title: h.title ?? h.story_title ?? "(untitled)",
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    score: h.points ?? 0,
    country,
    snippet: h.story_text?.slice(0, 200),
  }));
}

async function devTo(q: string, country: string): Promise<QA[]> {
  const tag = q.toLowerCase().replace(/[^a-z0-9]/g, "");
  const data = await safeFetch(
    `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=15`
  );
  if (!Array.isArray(data)) return [];
  return data.map((a: any) => ({
    id: `devto-${a.id}`,
    platform: "Dev.to",
    title: a.title,
    url: a.url,
    score: (a.public_reactions_count ?? 0) + (a.comments_count ?? 0),
    country,
    snippet: a.description?.slice(0, 200),
  }));
}

async function discourse(q: string, country: string): Promise<QA[]> {
  const data = await safeFetch(
    `https://meta.discourse.org/search.json?q=${encodeURIComponent(q)}`
  );
  const topics = data?.topics ?? [];
  return topics.slice(0, 15).map((t: any) => ({
    id: `discourse-${t.id}`,
    platform: "Discourse",
    title: t.title,
    url: `https://meta.discourse.org/t/${t.slug}/${t.id}`,
    score: (t.posts_count ?? 0) + (t.like_count ?? 0),
    country,
  }));
}

async function duckDuckGo(q: string, country: string): Promise<QA[]> {
  const data = await safeFetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`
  );
  if (!data) return [];

  const results: QA[] = [];

  if (data.AbstractText) {
    results.push({
      id: `ddg-abstract-${Date.now()}`,
      platform: "DuckDuckGo",
      title: data.Heading ?? q,
      url: data.AbstractURL ?? `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
      score: 80,
      country,
      snippet: data.AbstractText?.slice(0, 300),
    });
  }

  if (data.Answer) {
    results.push({
      id: `ddg-answer-${Date.now()}`,
      platform: "DuckDuckGo",
      title: `${q} — answer`,
      url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
      score: 95,
      country,
      snippet: data.Answer?.slice(0, 300),
    });
  }

  for (const topic of data.RelatedTopics ?? []) {
    if (topic.FirstURL && topic.Text) {
      results.push({
        id: `ddg-rel-${topic.FirstURL}`,
        platform: "DuckDuckGo",
        title: topic.Text.slice(0, 100),
        url: topic.FirstURL,
        score: 60,
        country,
        snippet: topic.Text?.slice(0, 300),
      });
    }
    if (results.length >= 8) break;
  }

  return results;
}

async function quoraViaQuetre(q: string, country: string): Promise<QA[]> {
  const instance = "https://quetre.iket.me";
  const data = await safeFetch(
    `${instance}/api/v1/search?q=${encodeURIComponent(q)}`
  );
  if (!data) return [];

  const items = data?.results ?? data?.items ?? [];
  return items.slice(0, 10).map((item: any) => ({
    id: `quora-${item.id ?? item.url ?? Math.random()}`,
    platform: "Quora",
    title: item.title ?? item.question ?? "(question)",
    url: item.url?.startsWith("http") ? item.url : `${instance}${item.url ?? ""}`,
    score: item.upvotes ?? item.score ?? 0,
    country,
    snippet: item.snippet?.slice(0, 200),
  }));
}

function matchesKeyword(qa: QA, keyword: string): boolean {
  const kw = keyword.toLowerCase().trim();
  if (!kw) return false;

  const haystack = `${(qa.title ?? "").toLowerCase()} ${(qa.snippet ?? "").toLowerCase()}`;

  if (haystack.includes(kw)) return true;

  const words = kw.split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return true;
  return words.every((w) => haystack.includes(w));
}

function dedupe(results: QA[]) {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = (r.title ?? "").toLowerCase().slice(0, 60);
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;
  const plan = (session.user as any).plan ?? "free";

  const { keyword, country = "All" } = await req.json();
  if (!keyword?.trim()) {
    return NextResponse.json({ error: "Keyword required" }, { status: 400 });
  }

  // Free tier: 5 Q&A interactions per day
  const limit = await checkQALimit(userId, plan);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `You've used your ${limit.limit} free Q&A interactions for today. Upgrade to Premium for unlimited.`,
        usage: limit,
        upgradeRequired: true,
      },
      { status: 429 }
    );
  }

  const raw = await Promise.all([
    reddit(keyword, country),
    lemmy("https://lemmy.world", keyword, country),
    mbin(keyword, country),
    piefed(keyword, country),
    stackexchange(keyword, country),
    lemmy("https://lemmy.ml", keyword, country),
    hackerNews(keyword, country),
    devTo(keyword, country),
    discourse(keyword, country),
    duckDuckGo(keyword, country),
    quoraViaQuetre(keyword, country),
  ]);

  const all = raw.flat();
  const filtered = dedupe(all).filter((qa) => matchesKeyword(qa, keyword));
  const sorted = filtered.sort((a, b) => b.score - a.score).slice(0, 60);

  // Record activity only on successful search
  await recordQAActivity(userId, "search", keyword);
  const updatedLimit = await checkQALimit(userId, plan);

  return NextResponse.json({
    results: sorted,
    count: sorted.length,
    filteredOut: all.length - filtered.length,
    usage: updatedLimit,
  });
}