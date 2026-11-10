import path from "path";
import fs from "fs/promises";
import os from "os";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

export interface RenderRemotionInput {
  id: string;
  productImageUrl: string;
  productName: string;
  hookText: string;
  benefits: string[];
  priceText: string;
  originalPriceText: string;
  ctaText: string;
  brandColor: string;
  qrCodeUrl: string;
}

export interface RenderRemotionOutput {
  filePath: string;
  fileSizeBytes: number;
  durationSeconds: number;
}

let cachedBundle: string | null = null;

async function getBundle(): Promise<string> {
  if (cachedBundle) return cachedBundle;

  // Prefer the bundle built at deploy time (see scripts/prebundle-remotion.mjs)
  const preBundled = path.join(process.cwd(), ".remotion-bundle");
  try {
    await fs.access(preBundled);
    cachedBundle = preBundled;
    console.log(`[video] Using pre-built bundle: ${preBundled}`);
    return preBundled;
  } catch {
    console.log(`[video] No pre-built bundle — bundling on demand (slow)`);
    cachedBundle = await bundle({
      entryPoint: path.join(
        process.cwd(),
        "src",
        "components",
        "video",
        "remotionRoot.tsx"
      ),
    });
    return cachedBundle;
  }
}

export async function renderRemotionVideo(
  input: RenderRemotionInput
): Promise<RenderRemotionOutput> {
  const workDir = path.join(os.tmpdir(), `ate-rm-${input.id}`);
  await fs.mkdir(workDir, { recursive: true });
  const outputPath = path.join(workDir, "video.mp4");

  const serveUrl = await getBundle();

  const inputProps = {
    productImageUrl: input.productImageUrl,
    productName: input.productName,
    hookText: input.hookText,
    benefits: input.benefits,
    priceText: input.priceText,
    originalPriceText: input.originalPriceText,
    ctaText: input.ctaText,
    brandColor: input.brandColor,
    qrCodeUrl: input.qrCodeUrl,
  };

  const composition = await selectComposition({
    serveUrl,
    id: "VideoTemplate",
    inputProps,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outputPath,
    inputProps,
    onBrowserLog: (log) => console.log(`[remotion] ${log.text}`),
    // Single-threaded to prevent CPU thrashing / OOM on Render free tier
    concurrency: 1,
  });

  const stat = await fs.stat(outputPath);
  return {
    filePath: outputPath,
    fileSizeBytes: stat.size,
    durationSeconds: 10,
  };
}