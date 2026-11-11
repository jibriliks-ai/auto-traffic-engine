import type { PostPayload, PostResult } from "../types";

/**
 * Mastodon — free forever, no approval.
 * Access token: instance.example.com → Preferences → Development → New application
 * (scopes: read, write, follow).
 * Instance URL must include https:// (e.g. "https://mastodon.social").
 */
export async function postToMastodon(
  credentials: { instanceUrl: string; accessToken: string },
  payload: PostPayload
): Promise<PostResult> {
  try {
    const base = credentials.instanceUrl.replace(/\/$/, "");
    const headers = { Authorization: `Bearer ${credentials.accessToken}` };

    let mediaIds: string[] = [];
    if (payload.imageBuffer) {
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array(payload.imageBuffer)], { type: "image/jpeg" }),
        "image.jpg"
      );
      form.append("description", payload.caption.slice(0, 400));

      const uploadRes = await fetch(`${base}/api/v2/media`, {
        method: "POST",
        headers,
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      const upload = await uploadRes.json();
      if (!uploadRes.ok) {
        return { ok: false, error: `Mastodon upload: ${upload.error ?? uploadRes.status}` };
      }
      // v2/media returns 202 while processing, 200 when done
      if (uploadRes.status === 202 && upload.url) {
        // Wait briefly, then re-fetch
        await new Promise((r) => setTimeout(r, 2000));
        await fetch(`${base}/api/v1/media/${upload.id}`, { headers }).catch(() => {});
      }
      mediaIds = [String(upload.id)];
    }

    const body: any = {
      status: payload.caption.slice(0, 500),
      visibility: "public",
    };
    if (mediaIds.length > 0) body.media_ids = mediaIds;

    const postRes = await fetch(`${base}/api/v1/statuses`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const post = await postRes.json();
    if (!postRes.ok) {
      return { ok: false, error: `Mastodon post: ${post.error ?? postRes.status}` };
    }

    return {
      ok: true,
      platformPostId: String(post.id),
      platformUrl: post.url,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Mastodon network error" };
  }
}