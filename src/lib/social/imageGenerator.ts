import sharp from "sharp";

const SIZE = 1080;

// Linux-safe font stack. DejaVu + Liberation are preinstalled on every
// Render container. Arial is only reached on Windows/macOS dev machines.
const FONT_STACK =
  "DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif";

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
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&#39;";
      case '"':
        return "&quot;";
      default:
        return c;
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
    if (url.startsWith("data:image/svg")) {
      throw new Error("SVG product images are not supported — use JPEG or PNG");
    }
    const base64 = url.split(",")[1];
    if (!base64) throw new Error("Invalid data URI");
    return Buffer.from(base64, "base64");
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.slice(0, 200).includes(Buffer.from("<svg"))) {
    throw new Error("SVG product images are not supported — use JPEG or PNG");
  }
  return buf;
}

/**
 * Renders an SVG string to a PNG buffer. Never throws.
 * Returns null if SVG rendering fails (missing fonts, malformed SVG,
 * librsvg quirks). Callers should treat null as "no overlay" and
 * continue — the final image is still valid.
 */
async function safeRenderSvg(svg: string): Promise<Buffer | null> {
  try {
    return await sharp(Buffer.from(svg, "utf-8")).png().toBuffer();
  } catch (e: any) {
    console.warn(
      "[imageGen] SVG render failed (continuing without overlay):",
      e?.message ?? e
    );
    return null;
  }
}

/**
 * Generates a branded 1080×1080 product image for social media.
 *
 * Layers (bottom → top):
 *   1. Brand-color → dark gradient with decorative circles
 *   2. Product image centered (~65% of canvas, aspect-preserved)
 *   3. Text overlay (badge, brand, title, price pill, CTA)
 *
 * Behaviour:
 *   - If product image fetch fails → throws (caller responds 500)
 *   - If overlay SVG fails → returns image WITHOUT text (still valid JPEG)
 *   - If overlay succeeds → returns full branded image
 *
 * Returns: { buffer, dataUrl }
 */
export async function generateSocialImage(
  input: ImageGenInput
): Promise<{ buffer: Buffer; dataUrl: string }> {
  const productBuf = await fetchImage(input.productImageUrl);
  const brandColor = input.brandColor || "#4f46e5";

  // 1. Product image — resize to 65% of canvas, preserve aspect, transparent pad
  const productSize = Math.round(SIZE * 0.65);
  const resizedProduct = await sharp(productBuf)
    .resize(productSize, productSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // 2. Background — gradient + decorative circles (no text, no fonts needed)
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${esc(brandColor)}"/>
        <stop offset="100%" stop-color="#0a0a0a"/>
      </linearGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
    <circle cx="${Math.round(SIZE * 0.85)}" cy="${Math.round(
    SIZE * 0.15
  )}" r="${Math.round(SIZE * 0.45)}" fill="rgba(255,255,255,0.05)"/>
    <circle cx="${Math.round(SIZE * 0.15)}" cy="${Math.round(
    SIZE * 0.85
  )}" r="${Math.round(SIZE * 0.35)}" fill="rgba(255,255,255,0.04)"/>
  </svg>`;
  const bg = await sharp(Buffer.from(bgSvg, "utf-8")).png().toBuffer();

  // 3. Overlay — text layers
  const titleLines = wrap(input.title || "", 22, 2);
  const priceLine = (wrap(input.price || "", 32, 1)[0] ?? "").slice(0, 40);
  const brandLine = (input.brandName ?? "").slice(0, 22);
  const ctaLine = (input.ctaText || "").slice(0, 60);
  const badgeLine = (input.badge ?? "").slice(0, 16);
  const badgeW = badgeLine ? Math.min(400, badgeLine.length * 26 + 60) : 0;

  const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    ${
      badgeLine
        ? `<rect x="40" y="40" width="${badgeW}" height="72" rx="36" fill="${esc(
            brandColor
          )}"/>
      <text x="${40 + badgeW / 2}" y="88" font-family="${FONT_STACK}" font-size="34" font-weight="900" fill="white" text-anchor="middle">${esc(
            badgeLine
          )}</text>`
        : ""
    }

    ${
      brandLine
        ? `<text x="${SIZE - 40}" y="92" font-family="${FONT_STACK}" font-size="32" font-weight="700" fill="rgba(255,255,255,0.92)" text-anchor="end">${esc(
            brandLine
          )}</text>`
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
        (l, i) =>
          `<text x="${SIZE / 2}" y="${
            SIZE - 270 + i * 58
          }" font-family="${FONT_STACK}" font-size="50" font-weight="900" fill="white" text-anchor="middle">${esc(
            l
          )}</text>`
      )
      .join("")}

    ${
      priceLine
        ? `<rect x="60" y="${SIZE - 140}" width="${
            SIZE - 120
          }" height="86" rx="20" fill="${esc(brandColor)}"/>
      <text x="${SIZE / 2}" y="${
            SIZE - 82
          }" font-family="${FONT_STACK}" font-size="48" font-weight="900" fill="white" text-anchor="middle">${esc(
            priceLine
          )}</text>`
        : ""
    }

    ${
      ctaLine
        ? `<text x="${SIZE / 2}" y="${
            SIZE - 24
          }" font-family="${FONT_STACK}" font-size="26" font-weight="700" fill="rgba(255,255,255,0.85)" text-anchor="middle">${esc(
            ctaLine
          )}</text>`
        : ""
    }
  </svg>`;

  const overlay = await safeRenderSvg(overlaySvg);

  // 4. Composite — inference only, no explicit sharp type annotations
    const compositeInputs: any[] = [
    { input: bg, top: 0, left: 0 },
    {
      input: resizedProduct,
      top: Math.round(SIZE * 0.15),
      left: Math.round((SIZE - productSize) / 2),
    },
  ];

  if (overlay) {
    compositeInputs.push({ input: overlay, top: 0, left: 0 });
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
    .jpeg({ quality: 90, progressive: true })
    .toBuffer();

  return {
    buffer: final,
    dataUrl: `data:image/jpeg;base64,${final.toString("base64")}`,
  };
}