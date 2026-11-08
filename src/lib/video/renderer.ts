import { spawn } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import os from "os";

const FFMPEG = String(ffmpegStatic ?? "");

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
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

function runFFmpeg(args: string[], timeoutMs = 150_000): Promise<void> {
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

    // Background: blurred product fills frame, centered product on top
    const blurred = await sharp(imgBuffer)
      .resize(WIDTH, HEIGHT, { fit: "cover" })
      .blur(45)
      .modulate({ brightness: 0.55 })
      .toBuffer();
    const centered = await sharp(imgBuffer)
      .resize(WIDTH, HEIGHT, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    await sharp(blurred)
      .composite([{ input: centered, top: 0, left: 0 }])
      .jpeg({ quality: 92 })
      .toFile(basePath);

    // Title overlay
    const titleLines = wrap(input.title, 22);
    const titleSvg = `<svg width="${WIDTH}" height="520" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(0,0,0,0.85)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
      </linearGradient></defs>
      <rect width="${WIDTH}" height="520" fill="url(#g)"/>
      ${titleLines
        .map(
          (l, i) =>
            `<text x="${WIDTH / 2}" y="${140 + i * 100}" font-family="Arial,Helvetica,sans-serif" font-size="82" font-weight="900" fill="white" text-anchor="middle" letter-spacing="1">${esc(l)}</text>`
        )
        .join("")}
    </svg>`;
    await sharp(Buffer.from(titleSvg)).png().toFile(topPath);

    // Price pill
    const priceSvg = `<svg width="${WIDTH}" height="320" xmlns="http://www.w3.org/2000/svg">
      <rect x="50" y="60" width="${WIDTH - 100}" height="200" rx="28" fill="${esc(input.brandColor)}"/>
      <text x="${WIDTH / 2}" y="210" font-family="Arial,Helvetica,sans-serif" font-size="104" font-weight="900" fill="white" text-anchor="middle">${esc(input.priceText || " ")}</text>
    </svg>`;
    await sharp(Buffer.from(priceSvg)).png().toFile(midPath);

    // CTA overlay
    const ctaLines = wrap(input.ctaText, 24);
    const ctaSvg = `<svg width="${WIDTH}" height="480" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="rgba(0,0,0,0.92)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
      </linearGradient></defs>
      <rect width="${WIDTH}" height="480" fill="url(#g)"/>
      ${ctaLines
        .map(
          (l, i) =>
            `<text x="${WIDTH / 2}" y="${300 + i * 100}" font-family="Arial,Helvetica,sans-serif" font-size="90" font-weight="900" fill="white" text-anchor="middle">${esc(l)}</text>`
        )
        .join("")}
    </svg>`;
    await sharp(Buffer.from(ctaSvg)).png().toFile(ctaPath);

    // ── FILTER CHAIN ──
    // 0 = base (Ken Burns zoom 1.0 → 1.08 over 20s)
    // 1 = title (fade in 0-1s)
    // 2 = price (fade in 0.5-1.5s)
    // 3 = CTA (fade in 15-16.5s)
    const totalFrames = FPS * DURATION;
    const filter =
      `[0:v]scale=${WIDTH}:${HEIGHT},zoompan=z='1+0.08*on/${totalFrames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${WIDTH}x${HEIGHT}:fps=${FPS}[bg];` +
      `[1:v]format=yuva420p,fade=t=in:st=0:d=1:alpha=1[title];` +
      `[2:v]format=yuva420p,fade=t=in:st=0.5:d=1:alpha=1[price];` +
      `[3:v]format=yuva420p,fade=t=in:st=15:d=1.5:alpha=1[cta];` +
      `[bg][title]overlay=0:0[t1];` +
      `[t1][price]overlay=0:${Math.floor(HEIGHT * 0.38)}[t2];` +
      `[t2][cta]overlay=0:${HEIGHT - 480}[o]`;

    const args = [
      "-loop", "1", "-framerate", String(FPS), "-t", String(DURATION), "-i", basePath,
      "-loop", "1", "-framerate", String(FPS), "-t", String(DURATION), "-i", topPath,
      "-loop", "1", "-framerate", String(FPS), "-t", String(DURATION), "-i", midPath,
      "-loop", "1", "-framerate", String(FPS), "-t", String(DURATION), "-i", ctaPath,
      "-filter_complex", filter,
      "-map", "[o]",
      "-c:v", "libx264",
      "-preset", "fast",
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