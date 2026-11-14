import sharp from "sharp";

const SIZE = 1080;
const FONT_STACK = "DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif";

export interface ImageGenInput {
  productImageUrl: string;
  title: string;
  price: string;
  originalPrice?: string;
  brandName?: string;
  ctaText: string;
  brandColor: string;
  badge?: string;
  urgencyLine?: string;
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
    else { if (cur) lines.push(cur); cur = w; }
    if (lines.length >= maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

async function fetchImage(url: string): Promise<Buffer> {
  if (url.startsWith("data:")) {
    if (url.startsWith("data:image/svg")) throw new Error("SVG not supported");
    const base64 = url.split(",")[1];
    if (!base64) throw new Error("Invalid data URI");
    return Buffer.from(base64, "base64");
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.slice(0, 200).includes(Buffer.from("<svg"))) throw new Error("SVG not supported");
  return buf;
}

async function safeRenderSvg(svg: string): Promise<Buffer | null> {
  try {
    return await sharp(Buffer.from(svg, "utf-8")).png().toBuffer();
  } catch (e: any) {
    console.warn("[imageGen] SVG render failed:", e?.message ?? e);
    return null;
  }
}

export async function generateSocialImage(
  input: ImageGenInput
): Promise<{ buffer: Buffer; dataUrl: string }> {
  const productBuf = await fetchImage(input.productImageUrl);
  const brandColor = input.brandColor || "#4f46e5";

  const productSize = Math.round(SIZE * 0.78);
  const resizedProduct = await sharp(productBuf)
    .resize(productSize, productSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${esc(brandColor)}"/>
        <stop offset="100%" stop-color="#0a0a0a"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.7" cy="0.3" r="0.6">
        <stop offset="0%" stop-color="rgba(255,255,255,0.10)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#glow)"/>
    <circle cx="${Math.round(SIZE * 0.90)}" cy="${Math.round(SIZE * 0.10)}" r="${Math.round(SIZE * 0.42)}" fill="rgba(255,255,255,0.05)"/>
    <circle cx="${Math.round(SIZE * 0.10)}" cy="${Math.round(SIZE * 0.90)}" r="${Math.round(SIZE * 0.35)}" fill="rgba(255,255,255,0.04)"/>
  </svg>`;
  const bg = await sharp(Buffer.from(bgSvg, "utf-8")).png().toBuffer();

  const titleLines = wrap(input.title || "", 24, 2);
  const brandLine = (input.brandName ?? "").slice(0, 24);
  const ctaLine = (input.ctaText || "").slice(0, 60);
  const urgency = (input.urgencyLine ?? "").slice(0, 40);
  const badgeLine = (input.badge ?? "").slice(0, 14);
  const badgeW = badgeLine ? Math.max(220, badgeLine.length * 30 + 40) : 0;

  const priceLine = (input.price || "").slice(0, 24);
  const originalLine = (input.originalPrice || "").slice(0, 24);
  const hasPrice = Boolean(priceLine);

  const panelTop = SIZE - 380;

  const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    ${badgeLine ? `
      <rect x="40" y="40" width="${badgeW}" height="88" rx="44" fill="#dc2626"/>
      <text x="${40 + badgeW / 2}" y="98" font-family="${FONT_STACK}" font-size="40" font-weight="900" fill="white" text-anchor="middle">${esc(badgeLine)}</text>
    ` : ""}

    ${brandLine ? `
      <rect x="${SIZE - 40 - (brandLine.length * 18 + 60)}" y="52" width="${brandLine.length * 18 + 60}" height="64" rx="16" fill="rgba(0,0,0,0.55)"/>
      <text x="${SIZE - 60}" y="96" font-family="${FONT_STACK}" font-size="30" font-weight="800" fill="white" text-anchor="end">${esc(brandLine)}</text>
    ` : ""}

    <defs>
      <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
        <stop offset="35%" stop-color="rgba(0,0,0,0.88)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.98)"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${panelTop}" width="${SIZE}" height="380" fill="url(#panel)"/>

    ${titleLines
      .map(
        (l, i) =>
          `<text x="60" y="${panelTop + 70 + i * 58}" font-family="${FONT_STACK}" font-size="52" font-weight="900" fill="white">${esc(l)}</text>`
      )
      .join("")}

    ${hasPrice ? `
      <text x="60" y="${panelTop + 70 + titleLines.length * 58 + 60}" font-family="${FONT_STACK}" font-size="60" font-weight="900" fill="${esc(brandColor)}">${esc(priceLine)}</text>
    ` : ""}

    ${originalLine ? `
      <text x="${60 + (hasPrice ? priceLine.length * 32 : 0)}" y="${panelTop + 70 + titleLines.length * 58 + 60}" font-family="${FONT_STACK}" font-size="38" font-weight="700" fill="rgba(255,255,255,0.55)" text-decoration="line-through">${esc(originalLine)}</text>
    ` : ""}

    ${urgency ? `
      <text x="60" y="${SIZE - 96}" font-family="${FONT_STACK}" font-size="30" font-weight="700" fill="rgba(255,255,255,0.75)">${esc(urgency)}</text>
    ` : ""}

    <rect x="${SIZE - 380}" y="${SIZE - 128}" width="320" height="80" rx="20" fill="${esc(brandColor)}"/>
    <text x="${SIZE - 220}" y="${SIZE - 76}" font-family="${FONT_STACK}" font-size="30" font-weight="900" fill="white" text-anchor="middle">${esc(ctaLine.slice(0, 22))}</text>
  </svg>`;

  const overlay = await safeRenderSvg(overlaySvg);

  const compositeInputs: any[] = [
    { input: bg, top: 0, left: 0 },
    {
      input: resizedProduct,
      top: Math.round(SIZE * 0.10),
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
    .jpeg({ quality: 92, progressive: true })
    .toBuffer();

  return {
    buffer: final,
    dataUrl: `data:image/jpeg;base64,${final.toString("base64")}`,
  };
}