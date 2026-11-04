import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type QA = {
  id: string;
  platform: string;
  title: string;
  url: string;
  score: number;
  country: string;
};

const UA =
  "AutoTrafficEngine/1.0 (+https://auto-traffic-engine.onrender.com)";

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

// ---------- 1. Reddit ----------
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
  }));
}

// ---------- 2 & 6. Lemmy (world + ml) ----------
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
  }));
}

// ---------- 3. Mbin ----------
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
    }));
}

// ---------- 4. PieFed ----------
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
  }));
}

// ---------- 5. StackExchange ----------
async function stackexchange(q: string, country: string): Promise<QA[]> {
  const data = await safeFetch(
    `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=activity&q=${encodeURIComponent(
      q
    )}&site=stackoverflow`
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

// ---------- 7. Hacker News (Algolia) ----------
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
  }));
}

// ---------- 8. Dev.to ----------
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
  }));
}

// ---------- 9. Discourse (meta.discourse.org) ----------
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

// ---------- Dedupe ----------
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

// ---------- POST handler ----------
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { keyword, country = "All" } = await req.json();
  if (!keyword?.trim()) {
    return NextResponse.json({ error: "Keyword required" }, { status: 400 });
  }

  const results = await Promise.all([
    reddit(keyword, country),
    lemmy("https://lemmy.world", keyword, country),
    mbin(keyword, country),
    piefed(keyword, country),
    stackexchange(keyword, country),
    lemmy("https://lemmy.ml", keyword, country),
    hackerNews(keyword, country),
    devTo(keyword, country),
    discourse(keyword, country),
  ]);

  const merged = dedupe(results.flat())
    .sort((a, b) => b.score - a.score)
    .slice(0, 80);

  return NextResponse.json({ results: merged, count: merged.length });
}