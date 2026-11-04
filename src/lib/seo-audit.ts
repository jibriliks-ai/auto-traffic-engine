import * as cheerio from "cheerio";

export type SeoIssue = {
  id: string;
  severity: "critical" | "warning" | "passed";
  category: string;
  message: string;
  detail?: string;
};

export type SeoMetrics = {
  titleLength: number;
  metaDescriptionLength: number;
  h1Count: number;
  h2Count: number;
  imageCount: number;
  imagesWithAlt: number;
  schemaFound: boolean;
  internalLinks: number;
  wordCount: number;
};

export type SeoAuditResult = {
  score: number;
  issues: SeoIssue[];
  metrics: SeoMetrics;
  title: string;
  metaDescription: string;
  h1: string;
  url: string;
};

export function normalizeUrl(input: string): string {
  const t = input.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/**
 * Run a full SEO audit against raw HTML.
 * Scores out of 100 across 8 weighted checks.
 */
export function auditHtml(html: string, url: string): SeoAuditResult {
  const $ = cheerio.load(html);
  const issues: SeoIssue[] = [];
  let score = 0;

  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  // ---------- 1. Title (15 pts) ----------
  const title = $("title").first().text().trim();
  const titleLength = title.length;
  if (titleLength === 0) {
    issues.push({
      id: "title",
      severity: "critical",
      category: "Title",
      message: "Missing <title> tag.",
      detail: "0 chars",
    });
  } else if (titleLength >= 50 && titleLength <= 60) {
    score += 15;
    issues.push({
      id: "title",
      severity: "passed",
      category: "Title",
      message: "Title length is optimal.",
      detail: `${titleLength} chars (50–60)`,
    });
  } else {
    score += 8;
    issues.push({
      id: "title",
      severity: "warning",
      category: "Title",
      message: `Title is ${titleLength} chars — aim for 50–60.`,
      detail: `${titleLength} chars`,
    });
  }

  // ---------- 2. Meta description (15 pts) ----------
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ?? "";
  const metaDescriptionLength = metaDescription.length;
  if (metaDescriptionLength === 0) {
    issues.push({
      id: "meta",
      severity: "critical",
      category: "Meta description",
      message: "Missing meta description.",
      detail: "0 chars",
    });
  } else if (metaDescriptionLength >= 120 && metaDescriptionLength <= 155) {
    score += 15;
    issues.push({
      id: "meta",
      severity: "passed",
      category: "Meta description",
      message: "Meta description length is optimal.",
      detail: `${metaDescriptionLength} chars (120–155)`,
    });
  } else {
    score += 8;
    issues.push({
      id: "meta",
      severity: "warning",
      category: "Meta description",
      message: `Meta description is ${metaDescriptionLength} chars — aim for 120–155.`,
      detail: `${metaDescriptionLength} chars`,
    });
  }

  // ---------- 3. H1 count (15 pts) ----------
  const h1Count = $("h1").length;
  const h1 = $("h1").first().text().trim();
  if (h1Count === 1) {
    score += 15;
    issues.push({
      id: "h1",
      severity: "passed",
      category: "Heading structure",
      message: "Exactly one H1 tag.",
      detail: `1 H1`,
    });
  } else if (h1Count === 0) {
    issues.push({
      id: "h1",
      severity: "critical",
      category: "Heading structure",
      message: "Missing H1 tag.",
      detail: "0 H1",
    });
  } else {
    score += 7;
    issues.push({
      id: "h1",
      severity: "warning",
      category: "Heading structure",
      message: `${h1Count} H1 tags — use exactly one.`,
      detail: `${h1Count} H1`,
    });
  }

  // ---------- 4. H2 count (10 pts) ----------
  const h2Count = $("h2").length;
  if (h2Count >= 2) {
    score += 10;
    issues.push({
      id: "h2",
      severity: "passed",
      category: "Subheadings",
      message: "Good use of H2 subheadings.",
      detail: `${h2Count} H2`,
    });
  } else {
    score += h2Count * 4;
    issues.push({
      id: "h2",
      severity: h2Count === 0 ? "critical" : "warning",
      category: "Subheadings",
      message: `Only ${h2Count} H2 tag${h2Count === 1 ? "" : "s"} — aim for 2+.`,
      detail: `${h2Count} H2`,
    });
  }

  // ---------- 5. Image alt text (10 pts, proportional) ----------
  const images = $("img");
  const imageCount = images.length;
  let imagesWithAlt = 0;
  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt && alt.trim().length > 0) imagesWithAlt++;
  });
  if (imageCount === 0) {
    score += 10;
    issues.push({
      id: "img-alt",
      severity: "passed",
      category: "Image accessibility",
      message: "No images — nothing to check.",
      detail: "0 images",
    });
  } else if (imagesWithAlt === imageCount) {
    score += 10;
    issues.push({
      id: "img-alt",
      severity: "passed",
      category: "Image accessibility",
      message: "All images have alt text.",
      detail: `${imagesWithAlt}/${imageCount}`,
    });
  } else {
    const pct = imagesWithAlt / imageCount;
    score += Math.round(10 * pct);
    issues.push({
      id: "img-alt",
      severity: pct < 0.5 ? "critical" : "warning",
      category: "Image accessibility",
      message: `${imageCount - imagesWithAlt} image${imageCount - imagesWithAlt === 1 ? "" : "s"} missing alt text.`,
      detail: `${imagesWithAlt}/${imageCount} have alt`,
    });
  }

  // ---------- 6. Structured data / schema (10 pts) ----------
  const schemaFound = $('script[type="application/ld+json"]').length > 0;
  if (schemaFound) {
    score += 10;
    issues.push({
      id: "schema",
      severity: "passed",
      category: "Structured data",
      message: "JSON-LD schema detected.",
      detail: "Found",
    });
  } else {
    issues.push({
      id: "schema",
      severity: "warning",
      category: "Structured data",
      message: "No JSON-LD schema — add FAQ/Article schema to win rich snippets.",
      detail: "Missing",
    });
  }

  // ---------- 7. Internal links (10 pts) ----------
  let internalLinks = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (
      href.startsWith("/") ||
      href.startsWith("#") ||
      (host && href.includes(host))
    ) {
      internalLinks++;
    }
  });
  if (internalLinks >= 2) {
    score += 10;
    issues.push({
      id: "internal-links",
      severity: "passed",
      category: "Internal linking",
      message: "Good internal linking.",
      detail: `${internalLinks} links`,
    });
  } else {
    score += internalLinks * 5;
    issues.push({
      id: "internal-links",
      severity: internalLinks === 0 ? "critical" : "warning",
      category: "Internal linking",
      message: `Only ${internalLinks} internal link${internalLinks === 1 ? "" : "s"} — add at least 2.`,
      detail: `${internalLinks} links`,
    });
  }

  // ---------- 8. Content length (15 pts) ----------
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
  if (wordCount >= 500) {
    score += 15;
    issues.push({
      id: "content",
      severity: "passed",
      category: "Content depth",
      message: "Content depth is good.",
      detail: `${wordCount} words`,
    });
  } else if (wordCount >= 250) {
    score += 8;
    issues.push({
      id: "content",
      severity: "warning",
      category: "Content depth",
      message: `Only ${wordCount} words — aim for 500+.`,
      detail: `${wordCount} words`,
    });
  } else {
    issues.push({
      id: "content",
      severity: "critical",
      category: "Content depth",
      message: `Thin content: ${wordCount} words — add 500+.`,
      detail: `${wordCount} words`,
    });
  }

  // Sort: critical → warning → passed
  const order: Record<SeoIssue["severity"], number> = {
    critical: 0,
    warning: 1,
    passed: 2,
  };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    score: Math.min(100, Math.round(score)),
    issues,
    metrics: {
      titleLength,
      metaDescriptionLength,
      h1Count,
      h2Count,
      imageCount,
      imagesWithAlt,
      schemaFound,
      internalLinks,
      wordCount,
    },
    title,
    metaDescription,
    h1,
    url,
  };
}

/**
 * Fetch a URL's HTML with a realistic UA and 15s timeout.
 */
export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AutoTrafficEngine/1.0; +https://auto-traffic-engine.onrender.com)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Site returned HTTP ${res.status}`);
  }
  return await res.text();
}