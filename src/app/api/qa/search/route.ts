import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type QA = { id: string; platform: string; title: string; url: string; score: number; country: string };

const UA = "AutoTrafficEngine/1.0 (+https://auto-traffic-engine.onrender.com)";

async function safeFetch(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function reddit(q: string, country: string): Promise<QA[]> {
  const data = await safeFetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=20`);
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

async function lemmy(host: string, q: string, country: string): Promise<QA[]> {
  const data = await safeFetch(`${host}/api/v3/search?q=${encodeURIComponent(q)}&type_=Posts&limit=20`);
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

async function mbin(q: string, country: string): Promise<QA[]> {
  const data = await safeFetch(`https://fedia.io/api/v1/search?q=${encodeURIComponent(q)}`);
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

async function piefed(q: string, country: string): Promise<QA[]> {
  const data = await safeFetch(`https://piefed.social/api/v1/search?q=${encodeURIComponent(q)}`);
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

async function stackexchange(q: string, country: string): Promise<QA[]> {
  const data = await safeFetch(
    `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=activity&q=${encodeURIComponent(q)}&site=stackoverflow`
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

function dedupe(results: QA[]) {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { keyword, country = "All" } = await req.json();
  if (!keyword?.trim()) return NextResponse.json({ error: "Keyword required" }, { status: 400 });

  const results = await Promise.all([
    reddit(keyword, country),
    lemmy("https://lemmy.world", keyword, country),
    mbin(keyword, country),
    piefed(keyword, country),
    stackexchange(keyword, country),
    lemmy("https://lemmy.ml", keyword, country),
  ]);

  const merged = dedupe(results.flat())
    .sort((a, b) => b.score - a.score)
    .slice(0, 60);

  return NextResponse.json({ results: merged, count: merged.length });
}