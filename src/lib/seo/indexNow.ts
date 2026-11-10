import { prisma } from "@/lib/prisma";

const INDEXNOW_KEY = process.env.INDEXNOW_KEY ?? "";
const APP_DOMAIN = process.env.NEXTAUTH_URL ?? "https://growthbot-aprv.onrender.com";

// Paths that should never be indexed (auth-gated, no SEO value)
const SKIP_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/dashboard",
  "/admin",
  "/billing",
  "/help",
];

// Skip resubmission within 24 hours
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SubmitResult {
  submitted: boolean;
  reason?: string;
  endpoints?: { url: string; status: number; ok: boolean }[];
}

/**
 * Submit a single URL to IndexNow. Fans out to Bing + Yandex via
 * api.indexnow.org. Falls back to direct Bing/Yandex if the primary
 * endpoint fails.
 *
 * Skips:
 *   - Non-domain URLs (only our own host)
 *   - Auth-gated paths (/login, /dashboard, etc.)
 *   - Homepage after the first-ever submit
 *   - URLs submitted in the last 24 hours (unless force: true)
 */
export async function submitToIndexNow(
  rawUrl: string,
  opts?: { force?: boolean; type?: string }
): Promise<SubmitResult> {
  if (!INDEXNOW_KEY) {
    return { submitted: false, reason: "INDEXNOW_KEY not configured on this environment" };
  }

  // ── Normalize URL ──
  let url: string;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { submitted: false, reason: "Invalid URL" };
  }

  // Only submit our own domain
  const ourHost = new URL(APP_DOMAIN).hostname;
  if (parsed.hostname !== ourHost) {
    return { submitted: false, reason: `Not our domain: ${parsed.hostname}` };
  }

  // Strip query/hash for stable dedup key
  parsed.search = "";
  parsed.hash = "";
  url = parsed.toString();

  // Skip auth-gated paths
  if (SKIP_PATHS.some((p) => parsed.pathname === p || parsed.pathname.startsWith(p + "/"))) {
    return { submitted: false, reason: `Skipped (auth-gated): ${parsed.pathname}` };
  }

  // Skip root after first-ever submit (IndexNow best practice)
  if (parsed.pathname === "/") {
    const everSubmitted = await prisma.indexNowSubmission.findUnique({ where: { url } });
    if (everSubmitted) {
      return { submitted: false, reason: "Homepage already submitted (first-time only)" };
    }
  }

  // Dedup check (24h window unless force)
  if (!opts?.force) {
    const recent = await prisma.indexNowSubmission.findUnique({ where: { url } });
    if (recent && Date.now() - recent.submittedAt.getTime() < DEDUP_WINDOW_MS) {
      return {
        submitted: false,
        reason: `Submitted ${Math.round((Date.now() - recent.submittedAt.getTime()) / 60000)} min ago`,
      };
    }
  }

  const host = parsed.hostname;
  const keyLocation = `${APP_DOMAIN}/${INDEXNOW_KEY}.txt`;

  // IndexNow bulk-submit payload
  const payload = {
    host,
    key: INDEXNOW_KEY,
    keyLocation,
    urlList: [url],
  };

  // Try primary first (api.indexnow.org fans out to all engines).
  // Only hit Bing/Yandex directly if primary fails — avoids duplicate submissions.
  const endpoints = [
    "https://api.indexnow.org/indexnow",
    "https://www.bing.com/indexnow",
    "https://yandex.com/indexnow",
  ];

  const results: { url: string; status: number; ok: boolean }[] = [];
  let anyOk = false;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      const ok = res.ok || res.status === 200 || res.status === 202;
      results.push({ url: endpoint, status: res.status, ok });
      if (ok) anyOk = true;
      // Success on primary = stop. Only try backups if primary fails.
      if (ok && endpoint === "https://api.indexnow.org/indexnow") break;
    } catch {
      results.push({ url: endpoint, status: 0, ok: false });
    }
  }

  if (!anyOk) {
    return { submitted: false, reason: "All endpoints failed", endpoints: results };
  }

  // Record submission for future dedup
  try {
    await prisma.indexNowSubmission.upsert({
      where: { url },
      create: {
        url,
        host,
        endpoints: JSON.stringify(results),
      },
      update: {
        submittedAt: new Date(),
        endpoints: JSON.stringify(results),
      },
    });
  } catch (e) {
    console.warn(`[indexnow] Dedup write failed for ${url}:`, e);
  }

  return { submitted: true, endpoints: results };
}

/**
 * Batch submit up to 10,000 URLs in a single request.
 * Used for sitemap-wide submissions — much more efficient than 1-per-URL.
 */
export async function submitBatchToIndexNow(urls: string[]): Promise<SubmitResult> {
  if (!INDEXNOW_KEY) return { submitted: false, reason: "No key configured" };
  if (urls.length === 0) return { submitted: false, reason: "Empty batch" };

  const host = new URL(APP_DOMAIN).hostname;
  const keyLocation = `${APP_DOMAIN}/${INDEXNOW_KEY}.txt`;

  const payload = {
    host,
    key: INDEXNOW_KEY,
    keyLocation,
    urlList: urls.slice(0, 10_000),
  };

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const ok = res.ok || res.status === 200 || res.status === 202;

    if (ok) {
      const now = new Date();
      for (const u of urls) {
        await prisma.indexNowSubmission
          .upsert({
            where: { url: u },
            create: {
              url: u,
              host,
              endpoints: JSON.stringify([{ endpoint: "indexnow.org", ok: true }]),
            },
            update: { submittedAt: now },
          })
          .catch(() => {});
      }
    }

    return {
      submitted: ok,
      endpoints: [{ url: "https://api.indexnow.org/indexnow", status: res.status, ok }],
    };
  } catch (e: any) {
    return { submitted: false, reason: e?.message ?? "network error" };
  }
}

/**
 * Fire-and-forget wrapper — safe to call from any route without awaiting.
 * Never throws, never blocks the caller.
 */
export function autoSubmitAfterCreate(url: string, type?: string): void {
  submitToIndexNow(url, { type }).catch((e) =>
    console.error(`[indexnow] Auto-submit failed for ${url}:`, e?.message ?? e)
  );
}