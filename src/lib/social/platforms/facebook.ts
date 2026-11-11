import type { PostPayload, PostResult } from "../types";

/**
 * Facebook Page posting — STUB.
 *
 * Requires: Facebook Developer app + `pages_manage_posts` permission
 * + Page access token (not user token).
 *
 * When approved:
 *   1. Set FB_APP_ID, FB_APP_SECRET on Render env
 *   2. Implement OAuth flow to get Page access token
 *   3. Replace this stub with:
 *        POST https://graph.facebook.com/v18.0/{page-id}/photos
 *        Body: { url: <publicImageUrl>, message: <caption>, access_token: <pageToken> }
 *      OR for multipart upload with source=@file
 */
export async function postToFacebook(
  credentials: { pageId: string; pageAccessToken: string },
  payload: PostPayload
): Promise<PostResult> {
  if (!credentials.pageAccessToken || !credentials.pageId) {
    return {
      ok: false,
      error:
        "Facebook not connected — requires app approval (pages_manage_posts permission).",
    };
  }
  return {
    ok: false,
    error: "Facebook client is a stub — implement Graph API call when app is approved.",
  };
}