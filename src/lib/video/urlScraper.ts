import * as cheerio from "cheerio";

export interface ScrapedProduct {
  url: string;
  title: string;
  description: string;
  imageUrl: string | null;
  price: string | null;
  originalPrice?: string | null;
  brand: string | null;
  category?: string | null;
}

const FETCH_TIMEOUT_MS = 15_000;

export async function scrapeUrl(rawUrl: string): Promise<ScrapedProduct> {
  const url = normalizeUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  let finalUrl = url;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    finalUrl = res.url || url;
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    html = await res.text();
  } finally {
    clearTimeout(timer);
  }

  if (html.length < 500) {
    throw new Error(
      "Page is too small to scrape — may be blocked or JS-rendered."
    );
  }

  const $ = cheerio.load(html);

  const title =
    firstNonEmpty([
      $('meta[property="og:title"]').attr("content"),
      $('meta[name="twitter:title"]').attr("content"),
      $('meta[name="title"]').attr("content"),
      $('h1[itemprop="name"]').first().text(),
      $("h1").first().text(),
      $("title").text(),
    ]) ?? "Product";

  const description =
    firstNonEmpty([
      $('meta[property="og:description"]').attr("content"),
      $('meta[name="description"]').attr("content"),
      $('meta[name="twitter:description"]').attr("content"),
    ]) ?? "";

  const imageRaw = findBestImage($, finalUrl);
  const imageUrl = imageRaw ? absolutize(imageRaw, finalUrl) : null;

  const price = extractPrice($);
  const originalPrice = extractOriginalPrice($);

  const brand =
    firstNonEmpty([
      $('meta[property="og:site_name"]').attr("content"),
      $('[itemprop="brand"]').attr("content"),
      $('[itemprop="brand"]').text().trim(),
      safeHostname(finalUrl).replace(/^www\./, "").split(".")[0],
    ]) ?? null;

  const category =
    firstNonEmpty([
      $('[itemprop="category"]').attr("content"),
      $('meta[property="product:category"]').attr("content"),
    ]) ?? null;

  return {
    url: finalUrl,
    title: cleanText(title).slice(0, 200),
    description: cleanText(description).slice(0, 1200),
    imageUrl,
    price: price ? String(price).trim() : null,
    originalPrice: originalPrice ? String(originalPrice).trim() : null,
    brand,
    category,
  };
}

function normalizeUrl(input: string): string {
  const t = input.trim();
  if (!t) throw new Error("URL is required");
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown.com";
  }
}

function firstNonEmpty(
  values: (string | undefined | null)[]
): string | null {
  for (const v of values) {
    if (v && String(v).trim().length > 0) return String(v).trim();
  }
  return null;
}

function cleanText(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

function absolutize(maybeRelative: string, base: string): string {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

/**
 * Tries multiple strategies to find the largest product image.
 * Priority:
 *   1. og:image / og:image:secure_url / twitter:image
 *   2. JSON-LD Product schema image
 *   3. First large <img> in the main product container
 *   4. Largest <img> by declared width × height
 */
function findBestImage(
  $: cheerio.CheerioAPI,
  baseUrl: string
): string | null {
  // 1. Open Graph / Twitter card images
  const og =
    $('meta[property="og:image:secure_url"]').attr("content") ||
    $('meta[property="og:image"]').attr("content") ||
    $('meta[property="og:image:url"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $('meta[name="twitter:image:src"]').attr("content");
  if (og && String(og).trim().length > 5) return String(og).trim();

  // 2. JSON-LD Product schema
  try {
    const ldScripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < ldScripts.length; i++) {
      const raw = $(ldScripts[i]).html();
      if (!raw) continue;
      try {
        const obj = JSON.parse(raw);
        const items = Array.isArray(obj) ? obj : [obj];
        for (const item of items) {
          const types = item?.["@type"];
          const isProduct =
            types === "Product" ||
            (Array.isArray(types) && types.includes("Product"));
          if (isProduct) {
            const img = Array.isArray(item.image) ? item.image[0] : item.image;
            const imgUrl = typeof img === "string" ? img : img?.url;
            if (imgUrl) return absolutize(imgUrl, baseUrl);
          }
        }
      } catch {
        /* skip malformed JSON-LD */
      }
    }
  } catch {
    /* no JSON-LD scripts */
  }

  // 3. Common product image containers
  const containerSelectors = [
    '[itemprop="image"]',
    ".product-image img",
    ".product__media img",
    '[class*="product-image"] img',
    '[class*="ProductImage"] img',
    '[data-testid*="product-image"] img',
    "main img",
    "article img",
  ];
  for (const sel of containerSelectors) {
    const el = $(sel).first();
    const src =
      el.attr("src") || el.attr("data-src") || el.attr("data-lazy-src");
    if (src && !isTinyOrIcon(src)) return absolutize(src, baseUrl);
  }

  // 4. Largest image by declared area
  const candidates: { src: string; area: number }[] = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (!src || isTinyOrIcon(src)) return;
    const w = Number($(el).attr("width") ?? 0);
    const h = Number($(el).attr("height") ?? 0);
    candidates.push({ src, area: w * h });
  });
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.area - a.area);
    return candidates[0].src;
  }

  return null;
}

function isTinyOrIcon(src: string): boolean {
  const lower = src.toLowerCase();
  if (/\.(svg|ico)($|\?)/.test(lower)) return true;
  if (/sprite|logo|icon|badge|placeholder/i.test(lower)) return true;
  return false;
}

function extractPrice($: cheerio.CheerioAPI): string | null {
  const candidates = [
    $('meta[property="product:price:amount"]').attr("content"),
    $('meta[property="og:price:amount"]').attr("content"),
    $('meta[itemprop="price"]').attr("content"),
    $('[itemprop="price"]').first().text().trim(),
    $('[class*="price"]').first().text().trim(),
    $("[data-price]").first().attr("data-price"),
  ];
  for (const c of candidates) {
    if (c && /\d/.test(c)) return String(c).trim();
  }
  return extractPriceFromText($);
}

function extractOriginalPrice($: cheerio.CheerioAPI): string | null {
  const candidates = [
    $('[class*="compare-at-price"]').first().text().trim(),
    $('[class*="old-price"]').first().text().trim(),
    $("del").first().text().trim(),
    $("s").first().text().trim(),
    $('[class*="was-price"]').first().text().trim(),
  ];
  for (const c of candidates) {
    if (c && /\d/.test(c)) return String(c).trim();
  }
  return null;
}

function extractPriceFromText($: cheerio.CheerioAPI): string | null {
  const bodyText = $("body").text().slice(0, 50_000);
  const m = bodyText.match(/[$₦£€]\s?\d[\d,]*(?:\.\d{1,2})?/);
  return m ? m[0].trim() : null;
}