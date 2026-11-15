import type { PostPayload, PostResult } from "../types";

/**
 * Pinterest API v5 posting client.
 * Requires Pinterest developer app + `pins:write` scope + board ID.
 * API: https://developers.pinterest.com/docs/api/v5/
 */
export async function postToPinterest(
  credentials: { accessToken: string; boardId: string },
  payload: PostPayload & { title?: string }
): Promise<PostResult> {
  try {
    if (!credentials.accessToken || !credentials.boardId) {
      return {
        ok: false,
        error: "Pinterest credentials incomplete — accessToken + boardId required",
      };
    }

    if (!payload.imageUrl) {
      return {
        ok: false,
        error:
          "Pinterest requires imageUrl (public HTTPS). Pass the endpoint URL of the branded image.",
      };
    }

    const title = (payload.title ?? payload.caption).slice(0, 100);
    const description = payload.caption.slice(0, 800);

    const res = await fetch("https://api.pinterest.com/v5/pins", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        board_id: credentials.boardId,
        title,
        description,
        media_source: {
          source_type: "image_url",
          url: payload.imageUrl,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) {
      return {
        ok: false,
        error: `Pinterest failed (${res.status}): ${
          data.message ?? JSON.stringify(data).slice(0, 200)
        }`,
      };
    }

    return {
      ok: true,
      platformPostId: String(data.id),
      platformUrl: `https://www.pinterest.com/pin/${data.id}/`,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Pinterest network error" };
  }
}