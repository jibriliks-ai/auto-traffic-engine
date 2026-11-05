import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { aiChat } from "@/lib/ai";
import { getActiveBusiness } from "@/lib/business";

export const runtime = "nodejs";
export const maxDuration = 60;

function stripFences(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return s.trim();
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const userId = (session.user as any).id;

  const hasAI = !!process.env.OPENAI_API_KEY || !!process.env.DEEPSEEK_API_KEY;
  if (!hasAI) {
    return NextResponse.json(
      {
        error:
          "No AI key configured. Add OPENAI_API_KEY or DEEPSEEK_API_KEY in Render Environment, then redeploy.",
      },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const keywords = (body.keywords ?? "").toString().trim();
  const sites: Array<{ name: string; url: string; category: string; da: number }> =
    Array.isArray(body.sites) ? body.sites.slice(0, 10) : [];

  if (!keywords) {
    return NextResponse.json({ error: "Keywords are required." }, { status: 400 });
  }
  if (sites.length === 0) {
    return NextResponse.json({ error: "Select at least one site." }, { status: 400 });
  }

  const { active: business } = await getActiveBusiness(userId);
  if (!business) {
    return NextResponse.json(
      { error: "No active business. Go to /businesses and set one up first." },
      { status: 400 }
    );
  }

  const siteList = sites
    .map((s, i) => `${i + 1}. ${s.name} (${s.category}, DA ${s.da})`)
    .join("\n");

  const prompt = `You are a classified ads expert. Generate ${sites.length} UNIQUE classified ads for a business.

Business:
- Name: ${business.name}
- Website: ${business.website}
- Description: ${business.description}
- Keywords: ${business.keywords}

Target keywords for these ads: ${keywords}

Sites (each has a different audience/category — write differently for each):
${siteList}

Requirements:
- Each ad: title (max 70 chars) + body (80–140 words)
- Body must include the business name and the website URL naturally
- Each ad must be genuinely different from the others (no copy-paste with slight tweaks)
- Match the site's audience — if category is "vehicles", focus on auto; if "jobs", focus on hiring; if "real estate", focus on property
- Include the target keywords in the body naturally
- No spam, no ALL CAPS shouting, no "click here" — real sales copy
- Include a clear CTA at the end (visit website / call / message)

Output STRICT JSON array (no prose, no markdown fences):
[
  { "siteIndex": 0, "title": "…", "body": "…" },
  { "siteIndex": 1, "title": "…", "body": "…" }
]

Where siteIndex is the 1-based index minus 0 from the site list above (so site 1 → index 0, site 2 → index 1, etc.).`;

  try {
    console.log(`[classifieds/generate] generating ${sites.length} listings for business=${business.name}`);
    const raw = await aiChat(
      [
        { role: "system", content: "You are a classified ads copywriter. Output ONLY valid JSON." },
        { role: "user", content: prompt },
      ],
      { maxTokens: 4000, temperature: 0.7 }
    );

    const cleaned = stripFences(raw);
    let listings: Array<{ siteIndex: number; title: string; body: string }>;
    try {
      listings = JSON.parse(cleaned);
    } catch (e: any) {
      console.error(`[classifieds/generate] JSON parse failed:`, cleaned.slice(0, 300));
      return NextResponse.json(
        { error: `AI returned invalid JSON. Try again. (${e.message})` },
        { status: 502 }
      );
    }

    if (!Array.isArray(listings) || listings.length === 0) {
      return NextResponse.json({ error: "AI returned no listings." }, { status: 502 });
    }

    const enriched = listings.map((l) => {
      const site = sites[l.siteIndex];
      return {
        siteIndex: l.siteIndex,
        siteName: site?.name ?? "Unknown",
        siteUrl: site?.url ?? "",
        siteCategory: site?.category ?? "general",
        title: String(l.title ?? "").trim(),
        body: String(l.body ?? "").trim(),
      };
    });

    return NextResponse.json({ listings: enriched, count: enriched.length });
  } catch (e: any) {
    console.error(`[classifieds/generate] AI error:`, e);
    return NextResponse.json(
      { error: `AI failed: ${e.message ?? "unknown"}. Check your AI key and billing.` },
      { status: 502 }
    );
  }
}