import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { aiChat } from "@/lib/ai";
import { getActiveBusiness } from "@/lib/business";
import { auditHtml, fetchHtml, normalizeUrl } from "@/lib/seo-audit";

export const runtime = "nodejs";
export const maxDuration = 60;

function stripCodeFences(raw: string): string {
  let html = raw.trim();
  html = html.replace(/^```(?:html)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  const start = html.search(/<!doctype|<html/i);
  if (start > 0) html = html.slice(start);
  return html.trim();
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // 1. Check AI key exists
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
  if (!hasOpenAI && !hasDeepSeek) {
    return NextResponse.json(
      {
        error:
          "No AI key configured. Add OPENAI_API_KEY or DEEPSEEK_API_KEY in your Render Environment, then redeploy.",
      },
      { status: 500 }
    );
  }
  console.log(`[seo/fix] AI provider: ${hasOpenAI ? "OpenAI" : "DeepSeek"}`);

  const body = await req.json().catch(() => ({}));
  const url = normalizeUrl(body.url ?? "");
  const keyword = (body.keyword ?? "").toString().trim();
  if (!url || !keyword) {
    return NextResponse.json({ error: "URL and keyword are required." }, { status: 400 });
  }

  const userId = (session.user as any).id;

  try {
    // 2. Fetch original page
    console.log(`[seo/fix] Fetching: ${url}`);
    let originalHtml: string;
    try {
      originalHtml = await fetchHtml(url);
      console.log(`[seo/fix] Fetched ${originalHtml.length} bytes`);
    } catch (e: any) {
      return NextResponse.json(
        {
          error: `Could not fetch ${url} — ${e.message}. The site may block bots or be offline.`,
        },
        { status: 502 }
      );
    }

    const before = auditHtml(originalHtml, url);

    const { active: business } = await getActiveBusiness(userId);

    const summary = `URL: ${url}
Business: ${business?.name ?? "(none set)"}
Business website: ${business?.website ?? "(none set)"}
Current title: ${before.title || "(none)"}
Current meta description: ${before.metaDescription || "(none)"}
Current H1: ${before.h1 || "(none)"}
Word count: ${before.metrics.wordCount}
H1: ${before.metrics.h1Count} | H2: ${before.metrics.h2Count}
Images: ${before.metrics.imageCount} (alt: ${before.metrics.imagesWithAlt})
Schema: ${before.metrics.schemaFound ? "yes" : "missing"}
Internal links: ${before.metrics.internalLinks}

Original body text (first 3000 chars):
${originalHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 3000)}`;

    // 3. Call AI
    console.log(`[seo/fix] Calling AI (keyword: ${keyword})...`);
    const startTime = Date.now();

    let fixedHtml: string;
    try {
      fixedHtml = stripCodeFences(
        await aiChat(
          [
            {
              role: "system",
              content: `You are an expert technical SEO engineer. Return a COMPLETE, production-ready HTML5 document optimized for the target keyword.

Hard requirements — a validator will reject your output otherwise:
1. Start with <!DOCTYPE html> and end with </html>. No markdown, no prose, no code fences.
2. <title> 50-60 chars, include keyword.
3. <meta name="description"> 120-155 chars, include keyword + CTA.
4. Exactly ONE <h1> containing the keyword.
5. At least THREE <h2> subheadings, at least one with the keyword.
6. Body content 600-900 words, genuinely helpful, human-sounding.
7. ALL <img> tags have descriptive alt. Use src="https://via.placeholder.com/800x400" if no real image.
8. At least TWO internal <a href> links (use relative like /about, /contact).
9. Include FAQPage JSON-LD with 4 questions + Article JSON-LD.
10. Preserve brand tone from the original — do not invent a fake company.
11. Output valid HTML only — no commentary, no explanations.`,
            },
            {
              role: "user",
              content: `Target keyword: ${keyword}\n\nPage to optimize:\n${summary}\n\nReturn the complete optimized HTML.`,
            },
          ],
          { maxTokens: 4000, temperature: 0.5 }
        )
      );
    } catch (e: any) {
      console.error(`[seo/fix] AI error:`, e);
      return NextResponse.json(
        {
          error: `AI failed: ${e.message ?? "unknown"}. Check your OPENAI_API_KEY / DEEPSEEK_API_KEY and billing status on the provider.`,
        },
        { status: 502 }
      );
    }

    console.log(`[seo/fix] AI responded in ${Date.now() - startTime}ms, ${fixedHtml.length} bytes`);

    if (!fixedHtml || fixedHtml.length < 500) {
      return NextResponse.json(
        { error: `AI returned too short a response (${fixedHtml?.length ?? 0} bytes). Try again.` },
        { status: 502 }
      );
    }

    // 4. Re-audit
    const after = auditHtml(fixedHtml, url);

    const improvements: string[] = [];
    for (const issue of after.issues) {
      if (issue.severity !== "passed") continue;
      const beforeIssue = before.issues.find((b) => b.id === issue.id);
      if (beforeIssue && beforeIssue.severity !== "passed") {
        improvements.push(`${issue.category}: ${issue.message}`);
      }
    }

    return NextResponse.json({
      fixedHtml,
      keyword,
      before: { score: before.score, metrics: before.metrics },
      after: { score: after.score, metrics: after.metrics },
      improvements,
    });
  } catch (e: any) {
    console.error(`[seo/fix] Unhandled:`, e);
    return NextResponse.json(
      { error: `Server error: ${e.message ?? String(e)}` },
      { status: 500 }
    );
  }
}