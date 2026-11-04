import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { aiChat } from "@/lib/ai";
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const url = normalizeUrl(body.url ?? "");
  const keyword = (body.keyword ?? "").toString().trim();
  if (!url || !keyword) {
    return NextResponse.json({ error: "URL and keyword are required" }, { status: 400 });
  }

  try {
    // 1. Fetch original page
    const originalHtml = await fetchHtml(url);
    const before = auditHtml(originalHtml, url);

    // 2. Summarise the original page for the AI
    const summary = `URL: ${url}
Current title: ${before.title || "(none)"}
Current meta description: ${before.metaDescription || "(none)"}
Current H1: ${before.h1 || "(none)"}
Word count: ${before.metrics.wordCount}
H1 count: ${before.metrics.h1Count} | H2 count: ${before.metrics.h2Count}
Images: ${before.metrics.imageCount} (with alt: ${before.metrics.imagesWithAlt})
Schema: ${before.metrics.schemaFound ? "present" : "missing"}
Internal links: ${before.metrics.internalLinks}

Original body text (first 3000 chars):
${originalHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 3000)}`;

    // 3. Ask AI for a complete, optimized HTML document
    const fixedHtml = stripCodeFences(
      await aiChat(
        [
          {
            role: "system",
            content: `You are an expert technical SEO engineer. Return a COMPLETE, production-ready HTML5 document optimized for the target keyword.

Hard requirements — a validator will reject your output otherwise:
1. Start with <!DOCTYPE html> and end with </html>. No markdown, no prose, no code fences.
2. <title> must be 50–60 characters, include the target keyword naturally.
3. <meta name="description"> must be 120–155 characters, include the keyword, with a clear CTA.
4. Exactly ONE <h1>, containing the keyword.
5. At least THREE <h2> subheadings, at least one including the keyword.
6. Body content must be 600–900 words, genuinely helpful, human-sounding, no fluff.
7. ALL <img> tags must have descriptive alt text. Use placeholder src="https://via.placeholder.com/800x400" if no real image exists.
8. Include at least TWO <a href> internal links (use relative hrefs like /about, /contact).
9. Include FAQPage JSON-LD with 4 questions (real questions people ask about the keyword), plus Article JSON-LD.
10. Preserve the original brand and tone — do not invent a fake company. Use what's given.
11. Output valid HTML only — no comments explaining what you did.`,
          },
          {
            role: "user",
            content: `Target keyword: ${keyword}

Page to optimize:
${summary}

Return the complete optimized HTML document.`,
          },
        ],
        { maxTokens: 4000, temperature: 0.5 }
      )
    );

    if (!fixedHtml || fixedHtml.length < 200) {
      return NextResponse.json(
        { error: "AI returned an unusable response. Try again." },
        { status: 502 }
      );
    }

    // 4. Re-audit the AI output
    const after = auditHtml(fixedHtml, url);

    // 5. Compute improvement bullets (issues that turned from non-pass to passed)
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
    return NextResponse.json(
      { error: e.message ?? "Failed to generate fix. Try again." },
      { status: 502 }
    );
  }
}