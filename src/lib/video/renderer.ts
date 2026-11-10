import { spawn } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";

const WIDTH = 720;
const HEIGHT = 1280;
const FPS = 24;
const DURATION = 20;

export interface RenderInput {
  id: string;
  title: string;
  priceText: string;
  ctaText: string;
  brandColor: string;
  productImageUrl: string;
  qrCodeDataUrl?: string;
}

export interface RenderOutput {
  filePath: string;
  fileSizeBytes: number;
  durationSeconds: number;
}

function resolveFfmpegPath(): string {
  const candidates: string[] = [];
  try {
    const resolvedPkg = require.resolve("ffmpeg-static");
    const pkgDir = path.dirname(resolvedPkg);
    candidates.push(path.join(pkgDir, "ffmpeg"));
    candidates.push(path.join(pkgDir, "ffmpeg.exe"));
  } catch {}
  const cwdRoot = process.cwd();
  candidates.push(path.join(cwdRoot, "node_modules", "ffmpeg-static", "ffmpeg"));
  candidates.push(path.join(cwdRoot, "node_modules", "ffmpeg-static", "ffmpeg.exe"));
  candidates.push(path.join(cwdRoot, "..", "node_modules", "ffmpeg-static", "ffmpeg"));
  if (ffmpegStatic) candidates.push(String(ffmpegStatic));
  for (const c of candidates) {
    try {
      if (c && fsSync.existsSync(c)) {
        console.log(`[video] FFmpeg resolved: ${c}`);
        return c;
      }
    } catch {}
  }
  throw new Error(`FFmpeg binary not found. Tried: ${candidates.join(" | ")}`);
}

const FFMPEG = resolveFfmpegPath();

function runFFmpeg(args: string[], timeoutMs = 180_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!FFMPEG) return reject(new Error("FFmpeg binary not found"));
    const proc = spawn(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (c) => {
      stderr += c.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`FFmpeg timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-600)}`));
    });
  });
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

function wrap(text: string, maxCharsPerLine: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = (cur ? cur + " " : "") + w;
    if (candidate.length <= maxCharsPerLine) cur = candidate;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

async function loadImageBuffer(url: string): Promise<Buffer> {
  if (url.startsWith("data:")) {
    if (url.startsWith("data:image/svg")) throw new Error("SVG not supported");
    const base64 = url.split(",")[1];
    if (!base64) throw new Error("Invalid data URI");
    return Buffer.from(base64, "base64");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.slice(0, 200).includes(Buffer.from("<svg")))
      throw new Error("SVG not supported");
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

export async function renderVideo(input: RenderInput): Promise<RenderOutput> {
  const workDir = path.join(os.tmpdir(), `ate-video-${input.id}`);
  await fs.mkdir(workDir, { recursive: true });

  const basePath = path.join(workDir, "base.jpg");
  const topPath = path.join(workDir, "top.png");
  const midPath = path.join(workDir, "mid.png");
  const ctaPath = path.join(workDir, "cta.png");
  const qrPath = path.join(workDir, "qr.png");
  const outPath = path.join(workDir, "output.mp4");

  try {
    const imgBuffer = await loadImageBuffer(input.productImageUrl);

    // Base: blurred bg + centered product
    const blurred = await sharp(imgBuffer)
      .resize(WIDTH, HEIGHT, { fit: "cover" })
      .blur(25)
      .modulate({ brightness: 0.55 })
      .toBuffer();
    const centered = await sharp(imgBuffer)
      .resize(WIDTH, HEIGHT, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    await sharp(blurred)
      .composite([{ input: centered, top: 0, left: 0 }])
      .jpeg({ quality: 88 })
      .toFile(basePath);

    // Title overlay (top)
    const titleLines = wrap(input.title, 24);
    const titleSvg = `<svg width="${WIDTH}" height="360" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(0,0,0,0.88)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
      </linearGradient></defs>
      <rect width="${WIDTH}" height="360" fill="url(#g)"/>
      ${titleLines
        .map(
          (l, i) =>
            `<text x="${WIDTH / 2}" y="${100 + i * 70}" font-family="Arial,Helvetica,sans-serif" font-size="56" font-weight="900" fill="white" text-anchor="middle" letter-spacing="0.5">${esc(l)}</text>`
        )
        .join("")}
    </svg>`;
    await sharp(Buffer.from(titleSvg)).png({ compressionLevel: 1 }).toFile(topPath);

    // Price pill (middle)
    const priceSvg = `<svg width="${WIDTH}" height="220" xmlns="http://www.w3.org/2000/svg">
      <rect x="30" y="40" width="${WIDTH - 60}" height="140" rx="24" fill="${esc(input.brandColor)}"/>
      <text x="${WIDTH / 2}" y="130" font-family="Arial,Helvetica,sans-serif" font-size="68" font-weight="900" fill="white" text-anchor="middle">${esc(input.priceText || " ")}</text>
    </svg>`;
    await sharp(Buffer.from(priceSvg)).png({ compressionLevel: 1 }).toFile(midPath);

    // CTA overlay (bottom)
    const ctaLines = wrap(input.ctaText, 26);
    const ctaSvg = `<svg width="${WIDTH}" height="340" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="rgba(0,0,0,0.92)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
      </linearGradient></defs>
      <rect width="${WIDTH}" height="340" fill="url(#g)"/>
      ${ctaLines
        .map(
          (l, i) =>
            `<text x="${WIDTH / 2}" y="${210 + i * 72}" font-family="Arial,Helvetica,sans-serif" font-size="60" font-weight="900" fill="white" text-anchor="middle">${esc(l)}</text>`
        )
        .join("")}
    </svg>`;
    await sharp(Buffer.from(ctaSvg)).png({ compressionLevel: 1 }).toFile(ctaPath);

    // QR code (top-right corner)
    let hasQr = false;
    if (input.qrCodeDataUrl) {
      try {
        const qrBase64 = input.qrCodeDataUrl.split(",")[1];
        const qrBuffer = Buffer.from(qrBase64, "base64");
        await sharp(qrBuffer)
          .resize(140, 140)
          .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png({ compressionLevel: 1 })
          .toFile(qrPath);
        hasQr = true;
      } catch (e) {
        console.warn(`[video] QR failed: ${e}`);
      }
    }

    const priceY = Math.floor(HEIGHT * 0.35);
    const ctaY = HEIGHT - 340;

    // Filter chain — static base with fade-ins on overlays
    const filterParts = [
      `[0:v]scale=${WIDTH}:${HEIGHT},setsar=1[bg]`,
      `[1:v]format=yuva420p,fade=t=in:st=0:d=1:alpha=1[title]`,
      `[2:v]format=yuva420p,fade=t=in:st=0.5:d=1:alpha=1[price]`,
      `[3:v]format=yuva420p,fade=t=in:st=15:d=1.5:alpha=1[cta]`,
      `[bg][title]overlay=0:0[t1]`,
      `[t1][price]overlay=0:${priceY}[t2]`,
      `[t2][cta]overlay=0:${ctaY}[t3]`,
    ];

    const inputs = [
      "-loop", "1", "-framerate", String(FPS), "-t", String(DURATION), "-i", basePath,
      "-loop", "1", "-framerate", String(FPS), "-t", String(DURATION), "-i", topPath,
      "-loop", "1", "-framerate", String(FPS), "-t", String(DURATION), "-i", midPath,
      "-loop", "1", "-framerate", String(FPS), "-t", String(DURATION), "-i", ctaPath,
    ];

    if (hasQr) {
      inputs.push("-loop", "1", "-framerate", String(FPS), "-t", String(DURATION), "-i", qrPath);
      filterParts.push(`[4:v]format=yuva420p,fade=t=in:st=10:d=1:alpha=1[qr]`);
      filterParts.push(`[t3][qr]overlay=${WIDTH - 180}:30[out]`);
    } else {
      filterParts.push(`[t3]null[out]`);
    }

    const args = [
      ...inputs,
      "-filter_complex", filterParts.join(";"),
      "-map", "[out]",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "stillimage",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-r", String(FPS),
      "-t", String(DURATION),
      "-movflags", "+faststart",
      "-y",
      outPath,
    ];

    await runFFmpeg(args);

    const stat = await fs.stat(outPath);
    return {
      filePath: outPath,
      fileSizeBytes: stat.size,
      durationSeconds: DURATION,
    };
  } finally {
    await Promise.all([
      fs.unlink(basePath).catch(() => {}),
      fs.unlink(topPath).catch(() => {}),
      fs.unlink(midPath).catch(() => {}),
      fs.unlink(ctaPath).catch(() => {}),
      fs.unlink(qrPath).catch(() => {}),
    ]);
  }
}