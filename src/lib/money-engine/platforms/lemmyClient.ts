/**
 * Lemmy posting client — STUB.
 *
 * This stub returns fake post IDs so the whole pipeline (generation, scheduling,
 * queue draining) can be tested end-to-end WITHOUT a Lemmy instance.
 *
 * To swap in the real client:
 *   1. Set LEMMY_BASE_URL and LEMMY_TOKEN env vars on Render
 *   2. Replace the stub body below with real API call:
 *        POST ${LEMMY_BASE_URL}/api/v3/post
 *        Headers: { Authorization: `Bearer ${LEMMY_TOKEN}` }
 *        Body: { name, body, community_id, url }
 *      Response contains { post_view: { post: { id: number, ap_id: string } } }
 *   3. Return { postId: String(post.id), postUrl: post.ap_id }
 */

export interface LemmyPostResult {
  postId: string;
  postUrl: string;
}

const LEMMY_BASE_URL = process.env.LEMMY_BASE_URL ?? "";
const LEMMY_TOKEN = process.env.LEMMY_TOKEN ?? "";

export async function postToLemmy(
  title: string,
  body: string,
  shortUrl: string,
  category?: string | null
): Promise<LemmyPostResult> {
  if (!LEMMY_BASE_URL || !LEMMY_TOKEN) {
    // STUB MODE — returns fake IDs so the rest of the pipeline works
    const fakeId = `stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[lemmy-stub] Would post: "${title.slice(0, 60)}..."`);
    return {
      postId: fakeId,
      postUrl: `https://lemmy.world/post/${fakeId}`,
    };
  }

  // Real client — swap this in when Lemmy creds arrive:
  //
  // const communityId = mapCategoryToCommunityId(category);
  // const res = await fetch(`${LEMMY_BASE_URL}/api/v3/post`, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: `Bearer ${LEMMY_TOKEN}`,
  //   },
  //   body: JSON.stringify({
  //     name: title,
  //     body: body,
  //     url: shortUrl,
  //     community_id: communityId,
  //   }),
  // });
  // if (!res.ok) throw new Error(`Lemmy API ${res.status}: ${await res.text()}`);
  // const data = await res.json();
  // return { postId: String(data.post_view.post.id), postUrl: data.post_view.post.ap_id };

  throw new Error(
    "Real Lemmy client not implemented — set LEMMY_BASE_URL + LEMMY_TOKEN to activate, or leave unset for stub mode"
  );
}