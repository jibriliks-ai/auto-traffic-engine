import sharp from "sharp";

const SIZE = 1080; // Square — works for Facebook feed, X, Instagram, Mastodon, Bluesky, Telegram

// Linux-safe font stack. DejaVu + Liberation are pre-installed on every
// Render/similar Linux container. Arial is only a last resort for dev on
// Windows/macOS. This is the fix for "text doesn't render on Linux".
const FONT_STACK = "'DejaVu Sans', 'Liberation Sans', Arial, Helvetica, sans-serif";

export interface ImageGenInput {
  productImageUrl: string;
  title: string;
  price: string;
  brandName?: string;
  ctaText: string;
  brandColor: string;
  badge?: string;
}

function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&#39;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

function wrap(text: string, max: number, maxLines = 2): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = (cur ? cur + " " : "") + w;
    if (candidate.length <= max) cur = candidate;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
    if (lines.length >= maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

async function fetchImage(url: string): Promise<Buffer> {
  if (url.startsWith("data:")) {
    const base64 = url.split(",")[1];
    if (!base64) throw new Error("Invalid data URI");
    return Buffer.from(base64, "base64");
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.slice(0, 200).includes(Buffer.from("<svg"))) {
    throw new Error("SVG not supported");
  }
  return buf;
}

async function renderSvgToPng(svg: string): Promise<Buffer | null> {
  try {
    return await sharp(Buffer.from(svg)).png().toBuffer();
  } catch (e) {
    console.warn("[imageGen] SVG render failed:", e);
    return null;
  }
}

/**
 * Generates a branded 1080×1080 product image for social media.
 *
 * Layout:
 *   - Gradient background (brand color → dark)
 *   - Product image centered, ~65% of canvas
 *   - Top-left: optional badge (e.g. "50% OFF")
 *   - Top-right: brand name
 *   - Bottom: dark gradient overlay with title + price pill + CTA
 *
 * Robustness:
 *   - If SVG text rendering fails (missing fonts), returns the image
 *     WITHOUT text overlays — still usable, never throws.
 *   - If the product image fetch fails, throws so the caller can respond 500.
 */
export async function generateSocialImage(
  input: ImageGenInput
): Promise<{ buffer: Buffer; dataUrl: string }> {
  const productBuf = await fetchImage(input.productImageUrl);
  const brandColor = input.brandColor || "#4f46e5";

  const productSize = Math.round(SIZE * 0.65);
  const resizedProduct = await sharp(productBuf)
    .resize(productSize, productSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  // Background SVG — gradients and circles don't need fonts, always work
  const bgSvg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${esc(brandColor)}"/>
        <stop offset="100%" stop-color="#0a0a0a"/>
      </linearGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
    <circle cx="${SIZE * 0.85}" cy="${SIZE * 0.15}" r="${SIZE * 0.45}" fill="rgba(255,255,255,0.05)"/>
    <circle cx="${SIZE * 0.15}" cy="${SIZE * 0.85}" r="${SIZE * 0.35}" fill="rgba(255,255,255,0.04)"/>
  </svg>`;
  const bg = await sharp(Buffer.from(bgSvg)).png().toBuffer();

  const titleLines = wrap(input.title, 22, 2);
  const priceLine = (wrap(input.price, 32, 1)[0] ?? input.price).slice(0, 40);
  const badgeW = input.badge ? Math.min(400, input.badge.length * 26 + 60) : 0;

  const overlaySvg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    ${
      input.badge
        ? `
      <rect x="40" y="40" width="${badgeW}" height="72" rx="36" fill="${esc(brandColor)}"/>
      <text x="${40 + badgeW / 2}" y="88" font-family="${FONT_STACK}" font-size="34" font-weight="900" fill="white" text-anchor="middle">${esc(input.badge)}</text>
    `
        : ""
    }

    ${
      input.brandName
        ? `
      <text x="${SIZE - 40}" y="92" font-family="${FONT_STACK}" font-size="32" font-weight="700" fill="rgba(255,255,255,0.92)" text-anchor="end">${esc(input.brandName.slice(0, 22))}</text>
    `
        : ""
    }

    <defs>
      <linearGradient id="bgrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.92)"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${SIZE - 400}" width="${SIZE}" height="400" fill="url(#bgrad)"/>

    ${titleLines
      .map(
        (l, i) => `
      <text x="${SIZE / 2}" y="${SIZE - 270 + i * 58}" font-family="${FONT_STACK}" font-size="50" font-weight="900" fill="white" text-anchor="middle">${esc(l)}</text>
    `
      )
      .join("")}

    <rect x="60" y="${SIZE - 140}" width="${SIZE - 120}" height="86" rx="20" fill="${esc(brandColor)}"/>
    <text x="${SIZE / 2}" y="${SIZE - 82}" font-family="${FONT_STACK}" font-size="48" font-weight="900" fill="white" text-anchor="middle">${esc(priceLine)}</text>

    <text x="${SIZE / 2}" y="${SIZE - 24}" font-family="${FONT_STACK}" font-size="26" font-weight="700" fill="rgba(255,255,255,0.85)" text-anchor="middle">${esc(input.ctaText)}</text>
  </svg>`;

  const overlay = await renderSvgToPng(overlaySvg);

  const compositeInputs: sharp.OverlayOptions[] = [
    { input: bg, top: 0, left: 0 },
    {
      input: resizedProduct,
      top: Math.round(SIZE * 0.15),
      left: Math.round((SIZE - productSize) / 2),
    },
  ];

  if (overlay) {
    compositeInputs.push({ input: overlay, top: 0, left: 0 });
  } else {
    // Fallback: no text overlay, still a valid product image
    console.warn("[imageGen] Overlay skipped — returning image without text");
  }

  const final = await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 3,
      background: { r: 10, g: 10, b: 10 },
    },
  })
    .composite(compositeInputs)
    .jpeg({ quality: 90, progressive: true, mozjpeg: true })
    .toBuffer();

  return {
    buffer: final,
    dataUrl: `data:image/jpeg;base64,${final.toString("base64")}`,
  };
}