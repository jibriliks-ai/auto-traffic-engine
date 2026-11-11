import type { PostPayload, PostResult } from "../types";

/**
 * X (Twitter) posting — STUB.
 *
 * Media uploads require the $100/month Basic API tier (Free tier = text only, 500 posts/month).
 *
 * When paid tier activated:
 *   1. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET on Render env
 *   2. Implement OAuth 1.0a signing (or use v2 with OAuth 2.0 PKCE)
 *   3. Upload media: POST https://upload.twitter.com/1.1/media/upload.json
 *   4. Post tweet: POST https://api.twitter.com/2/tweets with media_ids
 */
export async function postToX(
  _credentials: any,
  _payload: PostPayload
): Promise<PostResult> {
  return {
    ok: false,
    error:
      "X posting requires paid API tier ($100/mo Basic) for media uploads. Upgrade at developer.x.com.",
  };
}