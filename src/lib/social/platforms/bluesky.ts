import type { PostPayload, PostResult } from "../types";

/**
 * Bluesky — free forever, no approval.
 * Get app password: bsky.app → Settings → Privacy → App Passwords → Add.
 * Handle = your bsky username (e.g. "you.bsky.social").
 */
export async function postToBluesky(
  credentials: { handle: string; appPassword: string },
  payload: PostPayload
): Promise<PostResult> {
  try {
    // 1. Create session
    const sessionRes = await fetch(
      "https://bsky.social/xrpc/com.atproto.server.createSession",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: credentials.handle,
          password: credentials.appPassword,
        }),
        signal: AbortSignal.timeout(20_000),
      }
    );
    const session = await sessionRes.json();
    if (!sessionRes.ok || !session.accessJwt) {
      return { ok: false, error: `Bluesky auth: ${session.message ?? sessionRes.status}` };
    }

    const headers = {
      Authorization: `Bearer ${session.accessJwt}`,
      "Content-Type": "application/json",
    };

    // 2. Upload image if present
    let embed: any = undefined;
    if (payload.imageBuffer) {
      const uploadRes = await fetch(
        "https://bsky.social/xrpc/com.atproto.repo.uploadBlob",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.accessJwt}`,
            "Content-Type": "image/jpeg",
          },
          body: new Uint8Array(payload.imageBuffer),
          signal: AbortSignal.timeout(30_000),
        }
      );
      const upload = await uploadRes.json();
      if (!uploadRes.ok) {
        return { ok: false, error: `Bluesky upload: ${upload.message ?? uploadRes.status}` };
      }
      embed = {
        $type: "app.bsky.embed.images",
        images: [
          {
            alt: payload.caption.slice(0, 200),
            image: upload.blob,
            aspectRatio: { width: 1080, height: 1080 },
          },
        ],
      };
    }

    // 3. Create post record — 300-char limit for Bluesky
    const text = payload.caption.slice(0, 300);
    const record: any = {
      $type: "app.bsky.feed.post",
      text,
      createdAt: new Date().toISOString(),
    };
    if (embed) record.embed = embed;

    const postRes = await fetch(
      "https://bsky.social/xrpc/com.atproto.repo.createRecord",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          repo: session.did,
          collection: "app.bsky.feed.post",
          record,
        }),
        signal: AbortSignal.timeout(20_000),
      }
    );
    const postData = await postRes.json();
    if (!postRes.ok) {
      return { ok: false, error: `Bluesky post: ${postData.message ?? postRes.status}` };
    }

    const rkey = postData.uri?.split("/").pop();
    return {
      ok: true,
      platformPostId: rkey,
      platformUrl: `https://bsky.app/profile/${credentials.handle}/post/${rkey}`,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Bluesky network error" };
  }
}