import { spawn } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";

/**
 * FAST_MODE = true  → 720p @ 24fps, no Ken Burns zoom. ~3-8s per render.
 * FAST_MODE = false → 1080p @ 30fps, Ken Burns zoom. ~30-60s per render.
 *
 * Flip to false only on Render Starter ($7/mo) or a plan with real CPU.
 * On free tier, FAST_MODE=true is the difference between "usable" and "abandoned".
 */
const FAST_MODE = true;

const WIDTH = FAST_MODE ? 720 : 1080;
const HEIGHT = FAST_MODE ? 1280 : 1920;
const FPS = FAST_MODE ? 24 : 30;
const DURATION = 20;

export interface RenderInput {
  id: string;
  title: string;
  priceText: string;
  ctaText: string;
  brandColor: string;
  productImageUrl: string;
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
  candidates.push(path.join(cwdRoot, "..", "..", "node_modules", "ffmpeg-static", "ffmpeg"));
  if (ffmpegStatic) candidates.push(String(ffmpegStatic));
  for (const candidate of candidates) {
    try {
      if (candidate && fsSync.existsSync(candidate)) {
        console.log(`[video] FFmpeg resolved: ${candidate}`);
        return candidate;
      }
    } catch {}
  }
  throw new Error(
    `FFmpeg binary not found. Tried:\n${candidates.join("\n")}\ncwd=${process.cwd()}`
  );
}

const FFMPEG = resolveFfmpegPath();

function runFFmpeg(args: string[], timeoutMs = 120_000): Promise<void> {
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
  const timer = setTimeout(() => controller.abort(), 15_000);
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
  const outPath = path.join(workDir, "output.mp4");

  try {
    const imgBuffer = await loadImageBuffer(input.productImageUrl);

    // Downscale before sharp processing to save cycles
    const blurRadius = FAST_MODE ? 25 : 45;
    const blurred = await sharp(imgBuffer)
      .resize(WIDTH, HEIGHT, { fit: "cover" })
      .blur(blurRadius)
      .modulate({ brightness: 0.55 })
      .toBuffer();
    const centered = await sharp(imgBuffer)
      .resize(WIDTH, HEIGHT, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    await sharp(blurred)
      .composite([{ input: centered, top: 0, left: 0 }])
      .jpeg({ quality: 88 })
      .toFile(basePath);

    const titleFontSize = FAST_MODE ? 56 : 82;
    const titleLineHeight = FAST_MODE ? 70 : 100;
    const titleLines = wrap(input.title, FAST_MODE ? 24 : 22);
    const titleSvg = `<svg width="${WIDTH}" height="${FAST_MODE ? 360 : 520}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(0,0,0,0.85)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
      </linearGradient></defs>
      <rect width="${WIDTH}" height="${FAST_MODE ? 360 : 520}" fill="url(#g)"/>
      ${titleLines
        .map(
          (l, i) =>
            `<text x="${WIDTH / 2}" y="${(FAST_MODE ? 100 : 140) + i * titleLineHeight}" font-family="Arial,Helvetica,sans-serif" font-size="${titleFontSize}" font-weight="900" fill="white" text-anchor="middle" letter-spacing="1">${esc(l)}</text>`
        )
        .join("")}
    </svg>`;
    await sharp(Buffer.from(titleSvg)).png({ compressionLevel: 1 }).toFile(topPath);

    const priceHeight = FAST_MODE ? 220 : 320;
    const priceFontSize = FAST_MODE ? 72 : 104;
    const pricePillHeight = FAST_MODE ? 140 : 200;
    const priceSvg = `<svg width="${WIDTH}" height="${priceHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="40" y="40" width="${WIDTH - 80}" height="${pricePillHeight}" rx="24" fill="${esc(input.brandColor)}"/>
      <text x="${WIDTH / 2}" y="${40 + pricePillHeight / 2 + priceFontSize / 3}" font-family="Arial,Helvetica,sans-serif" font-size="${priceFontSize}" font-weight="900" fill="white" text-anchor="middle">${esc(input.priceText || " ")}</text>
    </svg>`;
    await sharp(Buffer.from(priceSvg)).png({ compressionLevel: 1 }).toFile(midPath);

    const ctaHeight = FAST_MODE ? 340 : 480;
    const ctaFontSize = FAST_MODE ? 62 : 90;
    const ctaLineHeight = FAST_MODE ? 72 : 100;
    const ctaLines = wrap(input.ctaText, FAST_MODE ? 26 : 24);
    const ctaSvg = `<svg width="${WIDTH}" height="${ctaHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="rgba(0,0,0,0.92)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
      </linearGradient></defs>
      <rect width="${WIDTH}" height="${ctaHeight}" fill="url(#g)"/>
      ${ctaLines
        .map(
          (l, i) =>
            `<text x="${WIDTH / 2}" y="${(FAST_MODE ? 210 : 300) + i * ctaLineHeight}" font-family="Arial,Helvetica,sans-serif" font-size="${ctaFontSize}" font-weight="900" fill="white" text-anchor="middle">${esc(l)}</text>`
        )
        .join("")}
    </svg>`;
    await sharp(Buffer.from(ctaSvg)).png({ compressionLevel: 1 }).toFile(ctaPath);

    const priceY = Math.floor(HEIGHT * 0.35);
    const ctaY = HEIGHT - ctaHeight;

    // ── FILTER CHAIN ──
    // FAST_MODE: static base + fade-ins only → 3-8s render
    // Slow mode: Ken Burns zoompan → 30-60s render but smoother
    const baseFilter = FAST_MODE
      ? `[0:v]scale=${WIDTH}:${HEIGHT},setsar=1[bg]`
      : `[0:v]scale=${WIDTH}:${HEIGHT},zoompan=z='1+0.08*on/${FPS * DURATION}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${WIDTH}x${HEIGHT}:fps=${FPS}[bg]`;

    const filter =
      `${baseFilter};` +
      `[1:v]format=yuva420p,fade=t=in:st=0:d=1:alpha=1[title];` +
      `[2:v]format=yuva420p,fade=t=in:st=0.5:d=1:alpha=1[price];` +
      `[3:v]format=yuva420p,fade=t=in:st=15:d=1.5:alpha=1[cta];` +
      `[bg][title]overlay=0:0[t1];` +
      `[t1][price]overlay=0:${priceY}[t2];` +
      `[t2][cta]overlay=0:${ctaY}[o]`;

    const args = [
      "-loop", "1", "-framerate", String(FPS), "-t", String(DURATION), "-i", basePath,
      "-loop", "1", "-framerate", String(FPS), "-t", String(DURATION), "-i", topPath,
      "-loop", "1", "-framerate", String(FPS), "-t", String(DURATION), "-i", midPath,
      "-loop", "1", "-framerate", String(FPS), "-t", String(DURATION), "-i", ctaPath,
      "-filter_complex", filter,
      "-map", "[o]",
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
    ]);
  }
}