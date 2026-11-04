export type IndexNowResult = {
  ok: boolean;
  status: number;
  detail: string;
};

/**
 * Submit URLs to IndexNow (broadcasts to Bing, Yandex, Naver, Seznam, Yep).
 * All URLs must share the same hostname — that's an IndexNow requirement.
 * The key file must already exist at {host}/{KEY}.txt or the API will 403.
 */
export async function submitToIndexNow(urls: string[]): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    throw new Error("INDEXNOW_KEY not configured. Add it to your environment variables.");
  }

  let host: string;
  let protocol: string;
  try {
    const first = new URL(urls[0]);
    host = first.hostname;
    protocol = first.protocol;
    for (const u of urls) {
      const parsed = new URL(u);
      if (parsed.hostname !== host) {
        throw new Error(
          `All URLs must be from the same host (found "${host}" and "${parsed.hostname}")`
        );
      }
    }
  } catch (e: any) {
    throw new Error(e.message ?? "Invalid URL");
  }

  const keyLocation = `${protocol}//${host}/${key}.txt`;

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key,
      keyLocation,
      urlList: urls,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const statusMap: Record<number, string> = {
    200: "URLs submitted successfully — all engines notified.",
    202: "Accepted. Key validation is pending on the search-engine side.",
    400: "Invalid request format.",
    403: "Key file not found. Upload the key to your site root and try again.",
    422: "URLs do not belong to the specified host.",
    429: "Rate limited by IndexNow. Try again later.",
  };

  return {
    ok: res.status === 200 || res.status === 202,
    status: res.status,
    detail: statusMap[res.status] ?? `Unexpected response: HTTP ${res.status}`,
  };
}