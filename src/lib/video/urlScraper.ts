import * as cheerio from "cheerio";

export interface ScrapedProduct {
  url: string;
  title: string;
  description: string;
  imageUrl: string | null;
  price: string | null;
  brand: string | null;
}

const FETCH_TIMEOUT_MS = 15_000;

/**
 * Fetches a product page and extracts the fields needed for video generation.
 * Works on 90% of ecommerce pages (Shopify, WooCommerce, Jumia, Amazon, Impact
 * landing pages, etc). Returns whatever it can find — the AI step fills gaps.
 */
export async function scrapeUrl(rawUrl: string): Promise<ScrapedProduct> {
  const url = normalizeUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    html = await res.text();
  } finally {
    clearTimeout(timer);
  }

  if (html.length < 500) {
    throw new Error("Page is too small to scrape — may be blocked or JS-rendered.");
  }

  const $ = cheerio.load(html);

  const title =
    firstNonEmpty([
      $('meta[property="og:title"]').attr("content"),
      $('meta[name="twitter:title"]').attr("content"),
      $("h1").first().text(),
      $("title").text(),
    ]) ?? "Product";

  const description =
    firstNonEmpty([
      $('meta[property="og:description"]').attr("content"),
      $('meta[name="description"]').attr("content"),
      $('meta[name="twitter:description"]').attr("content"),
    ]) ?? "";

  const imageRaw =
    firstNonEmpty([
      $('meta[property="og:image:secure_url"]').attr("content"),
      $('meta[property="og:image"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content"),
    ]) ?? findFirstLargeImg($);

  const imageUrl = imageRaw ? absolutize(imageRaw, url) : null;

  const price =
    firstNonEmpty([
      $('meta[property="product:price:amount"]').attr("content"),
      $('meta[property="og:price:amount"]').attr("content"),
      $('[itemprop="price"]').attr("content"),
      $('[data-price]').attr("data-price"),
      extractPriceFromText($),
    ]) ?? null;

  const brand =
    firstNonEmpty([
      $('meta[property="og:site_name"]').attr("content"),
      new URL(url).hostname.replace(/^www\./, ""),
    ]) ?? null;

  return {
    url,
    title: cleanText(title).slice(0, 200),
    description: cleanText(description).slice(0, 1000),
    imageUrl,
    price: price ? String(price).trim() : null,
    brand,
  };
}

function normalizeUrl(input: string): string {
  const t = input.trim();
  if (!t) throw new Error("URL is required");
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function firstNonEmpty(values: (string | undefined | null)[]): string | null {
  for (const v of values) {
    if (v && String(v).trim().length > 0) return String(v).trim();
  }
  return null;
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

function absolutize(maybeRelative: string, base: string): string {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

function findFirstLargeImg($: cheerio.CheerioAPI): string | null {
  const candidates: { src: string; area: number }[] = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (!src) return;
    const w = Number($(el).attr("width") ?? 0);
    const h = Number($(el).attr("height") ?? 0);
    candidates.push({ src, area: w * h });
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.area - a.area);
  return candidates[0].src;
}

function extractPriceFromText($: cheerio.CheerioAPI): string | null {
  // Look for common currency patterns in the visible text.
  // Prefer currency symbols adjacent to digits ($12.99, ₦5,000, €19, £8.50).
  const bodyText = $("body").text().slice(0, 50_000);
  const patterns = [
    /[$₦£€]\s?\d[\d,]*(?:\.\d{1,2})?/g,
  ];
  for (const re of patterns) {
    const m = bodyText.match(re);
    if (m && m.length > 0) return m[0].trim();
  }
  return null;
}