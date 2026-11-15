import type { PostPayload, PostResult } from "../types";

/**
 * Threads (Meta) posting client.
 * Requires Meta app with threads_basic + threads_content_publish permissions.
 * API: https://developers.facebook.com/docs/threads
 */
export async function postToThreads(
  credentials: { userId: string; accessToken: string },
  payload: PostPayload
): Promise<PostResult> {
  try {
    if (!credentials.userId || !credentials.accessToken) {
      return {
        ok: false,
        error: "Threads credentials incomplete — userId + accessToken required",
      };
    }

    const text = payload.caption.slice(0, 500);

    if (payload.imageBuffer) {
      return {
        ok: false,
        error:
          "Threads requires imageUrl (public HTTPS), not imageBuffer. Use postToThreadsWithImage.",
      };
    }

    const createRes = await fetch(
      `https://graph.threads.net/v1.0/${credentials.userId}/threads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          media_type: "TEXT",
          text,
          access_token: credentials.accessToken,
        }).toString(),
        signal: AbortSignal.timeout(20_000),
      }
    );
    const createData = await createRes.json().catch(() => ({}));
    if (!createRes.ok || !createData.id) {
      return {
        ok: false,
        error: `Threads create failed (${createRes.status}): ${createData.error?.message ?? "unknown"}`,
      };
    }

    const publishRes = await fetch(
      `https://graph.threads.net/v1.0/${credentials.userId}/threads_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: createData.id,
          access_token: credentials.accessToken,
        }).toString(),
        signal: AbortSignal.timeout(20_000),
      }
    );
    const publishData = await publishRes.json().catch(() => ({}));
    if (!publishRes.ok || !publishData.id) {
      return {
        ok: false,
        error: `Threads publish failed (${publishRes.status}): ${publishData.error?.message ?? "unknown"}`,
      };
    }

    return {
      ok: true,
      platformPostId: String(publishData.id),
      platformUrl: `https://www.threads.net/`,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Threads network error" };
  }
}

export async function postToThreadsWithImage(
  credentials: { userId: string; accessToken: string },
  payload: { text: string; imageUrl: string }
): Promise<PostResult> {
  try {
    if (!credentials.userId || !credentials.accessToken) {
      return { ok: false, error: "Threads credentials incomplete" };
    }

    const createRes = await fetch(
      `https://graph.threads.net/v1.0/${credentials.userId}/threads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          media_type: "IMAGE",
          image_url: payload.imageUrl,
          text: payload.text.slice(0, 500),
          access_token: credentials.accessToken,
        }).toString(),
        signal: AbortSignal.timeout(20_000),
      }
    );
    const createData = await createRes.json().catch(() => ({}));
    if (!createRes.ok || !createData.id) {
      return {
        ok: false,
        error: `Threads create failed: ${createData.error?.message ?? createRes.status}`,
      };
    }

    const publishRes = await fetch(
      `https://graph.threads.net/v1.0/${credentials.userId}/threads_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: createData.id,
          access_token: credentials.accessToken,
        }).toString(),
        signal: AbortSignal.timeout(20_000),
      }
    );
    const publishData = await publishRes.json().catch(() => ({}));
    if (!publishRes.ok || !publishData.id) {
      return { ok: false, error: `Threads publish failed` };
    }

    return {
      ok: true,
      platformPostId: String(publishData.id),
      platformUrl: `https://www.threads.net/`,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Threads error" };
  }
}